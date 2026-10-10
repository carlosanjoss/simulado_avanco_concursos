const PAGE_BATCH_SIZE = 5;
const MAX_PDF_PAGES = 400;
const REQUEST_ATTEMPTS = 3;

export interface PdfProcessingProgress {
  phase: 'opening' | 'extracting' | 'ocr' | 'embedding' | 'finalizing';
  currentPage: number;
  totalPages: number;
  currentBatch: number;
  totalBatches: number;
  message: string;
}

interface PdfTextItem {
  str?: string;
  hasEOL?: boolean;
}

async function requestJson<T>(url: string, init: RequestInit, attempts = REQUEST_ATTEMPTS): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(data.error || `Erro HTTP ${response.status}`);
        if (!retryable || attempt === attempts) throw error;
        lastError = error;
      } else {
        return data as T;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Falha de conexão');
      if (attempt === attempts) throw lastError;
    }
    await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** (attempt - 1)));
  }
  throw lastError || new Error('Falha ao processar requisição');
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function cleanupPdfProcessing(documentId: string): Promise<void> {
  await fetch(`/api/pdf-processing/session?documentId=${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export async function processPdfInBrowser(
  file: File,
  onProgress: (progress: PdfProcessingProgress) => void,
  options: { allowOcr?: boolean } = {},
): Promise<{ documentId: string; totalPages: number; chunkCount: number; ocrPages: number }> {
  onProgress({
    phase: 'opening', currentPage: 0, totalPages: 0, currentBatch: 0, totalBatches: 0,
    message: 'Abrindo e validando o PDF no navegador...',
  });

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const fileHash = await sha256(arrayBuffer);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  if (totalPages > MAX_PDF_PAGES) {
    await loadingTask.destroy();
    throw new Error(`O PDF possui ${totalPages} páginas. O limite é ${MAX_PDF_PAGES}.`);
  }
  const totalBatches = Math.ceil(totalPages / PAGE_BATCH_SIZE);

  const session = await requestJson<{ documentId: string; reused?: boolean; ocrPages?: number; chunkCount?: number }>('/api/pdf-processing/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileHash,
      fileSize: file.size,
      totalPages,
      totalBatches,
    }),
  });

  if (session.reused) {
    await loadingTask.destroy();
    onProgress({ phase: 'finalizing', currentPage: totalPages, totalPages, currentBatch: totalBatches, totalBatches, message: 'Material encontrado na biblioteca. Reutilizando o processamento existente...' });
    return { documentId: session.documentId, totalPages, chunkCount: session.chunkCount || 0, ocrPages: session.ocrPages || 0 };
  }

  let documentId = session.documentId;
  let ocrWorker: { recognize(image: HTMLCanvasElement): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> } | null = null;
  let ocrPages = 0;
  try {
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
      const pageStart = batchIndex * PAGE_BATCH_SIZE + 1;
      const pageEnd = Math.min(totalPages, pageStart + PAGE_BATCH_SIZE - 1);
      const pages: Array<{ pageNumber: number; text: string }> = [];

      for (let pageNumber = pageStart; pageNumber <= pageEnd; pageNumber += 1) {
        onProgress({
          phase: 'extracting', currentPage: pageNumber - 1, totalPages,
          currentBatch: batchIndex + 1, totalBatches,
          message: `Extraindo texto da página ${pageNumber} de ${totalPages}...`,
        });
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        let text = (textContent.items as PdfTextItem[])
          .map((item) => `${item.str || ''}${item.hasEOL ? '\n' : ' '}`)
          .join('')
          .replace(/[^\S\n]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (text.length < 40) {
          if (options.allowOcr === false) {
            throw new Error('Este PDF precisa de OCR, recurso disponível no plano Pro. Envie um PDF com texto selecionável ou faça upgrade.');
          }
          onProgress({
            phase: 'ocr', currentPage: pageNumber, totalPages,
            currentBatch: batchIndex + 1, totalBatches,
            message: `Aplicando OCR na página digitalizada ${pageNumber} de ${totalPages}...`,
          });
          const viewport = page.getViewport({ scale: 1.75 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const canvasContext = canvas.getContext('2d', { alpha: false });
          if (!canvasContext) throw new Error('Não foi possível preparar a página para OCR.');
          await page.render({ canvas, canvasContext, viewport }).promise;
          if (!ocrWorker) {
            const { createWorker } = await import('tesseract.js');
            ocrWorker = await createWorker('por');
          }
          const recognized = await ocrWorker.recognize(canvas);
          text = recognized.data.text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
          ocrPages += 1;
          canvas.width = 1;
          canvas.height = 1;
        }
        pages.push({ pageNumber, text });
        page.cleanup();
      }

      onProgress({
        phase: 'embedding', currentPage: pageEnd, totalPages,
        currentBatch: batchIndex + 1, totalBatches,
        message: `Vetorizando lote ${batchIndex + 1} de ${totalBatches}...`,
      });
      await requestJson('/api/pdf-processing/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, batchIndex, pages }),
      });
    }

    onProgress({
      phase: 'finalizing', currentPage: totalPages, totalPages,
      currentBatch: totalBatches, totalBatches,
      message: 'Conferindo os lotes e preparando a busca semântica...',
    });
    const completed = await requestJson<{ chunkCount: number }>('/api/pdf-processing/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, ocrPages }),
    });
    if (ocrWorker) await ocrWorker.terminate();
    await loadingTask.destroy();
    return { documentId, totalPages, chunkCount: completed.chunkCount, ocrPages };
  } catch (error) {
    if (ocrWorker) await ocrWorker.terminate().catch(() => undefined);
    await loadingTask.destroy().catch(() => undefined);
    await cleanupPdfProcessing(documentId);
    documentId = '';
    throw error;
  }
}

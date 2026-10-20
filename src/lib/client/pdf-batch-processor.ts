import { averageOcrConfidence, normalizeOcrConfidence, shouldUseOcrForPage, type OcrLanguage } from '@/lib/ocr';

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
  ocrConfidence?: number;
  ocrReason?: 'empty' | 'partial';
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
  options: { allowOcr?: boolean; ocrLanguage?: OcrLanguage; reviewOcrPage?: (page: { pageNumber: number; text: string; confidence: number; reason: 'empty' | 'partial' }) => Promise<{ text: string; reviewed: boolean }> } = {},
): Promise<{ documentId: string; totalPages: number; chunkCount: number; ocrPages: number; ocrConfidence: number | null }> {
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

  const session = await requestJson<{ documentId: string; reused?: boolean; ocrPages?: number; chunkCount?: number; processedBatches?: number; maxOcrPages?: number; ocrConfidence?: number | null }>('/api/pdf-processing/session', {
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
    return { documentId: session.documentId, totalPages, chunkCount: session.chunkCount || 0, ocrPages: session.ocrPages || 0, ocrConfidence: session.ocrConfidence ?? null };
  }

  let documentId = session.documentId;
  const language = options.ocrLanguage || 'por';
  let ocrWorker: { recognize(image: HTMLCanvasElement): Promise<{ data: { text: string; confidence?: number } }>; terminate(): Promise<unknown> } | null = null;
  let ocrPages = session.ocrPages || 0;
  const ocrConfidences: number[] = session.ocrConfidence === null || session.ocrConfidence === undefined ? [] : Array(ocrPages).fill(session.ocrConfidence);
  const maxOcrPages = session.maxOcrPages || 40;
  try {
    for (let batchIndex = session.processedBatches || 0; batchIndex < totalBatches; batchIndex += 1) {
      const pageStart = batchIndex * PAGE_BATCH_SIZE + 1;
      const pageEnd = Math.min(totalPages, pageStart + PAGE_BATCH_SIZE - 1);
      const pages: Array<{ pageNumber: number; text: string; ocr?: { confidence: number; language: OcrLanguage; reason: 'empty' | 'partial'; reviewed: boolean } }> = [];

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
        const assessment = shouldUseOcrForPage({ text, textItems: textContent.items.length });
        let ocrMetadata: { confidence: number; language: OcrLanguage; reason: 'empty' | 'partial'; reviewed: boolean } | undefined;
        if (assessment.required) {
          if (options.allowOcr === false) {
            throw new Error('Este PDF precisa de OCR, recurso disponível no plano Pro. Envie um PDF com texto selecionável ou faça upgrade.');
          }
          onProgress({
            phase: 'ocr', currentPage: pageNumber, totalPages,
            currentBatch: batchIndex + 1, totalBatches,
            message: `Aplicando OCR na página ${assessment.reason === 'partial' ? 'parcialmente digitalizada' : 'digitalizada'} ${pageNumber} de ${totalPages}...`,
            ocrReason: assessment.reason || 'empty',
          });
          if (ocrPages >= maxOcrPages) throw new Error(`Este material ultrapassa o limite de ${maxOcrPages} páginas OCR por geração. Divida o PDF ou use um arquivo com texto selecionável.`);
          const viewport = page.getViewport({ scale: 2.1 });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const canvasContext = canvas.getContext('2d', { alpha: false });
          if (!canvasContext) throw new Error('Não foi possível preparar a página para OCR.');
          await page.render({ canvas, canvasContext, viewport }).promise;
          improveCanvasForOcr(canvasContext, canvas.width, canvas.height);
          if (!ocrWorker) {
            const { createWorker } = await import('tesseract.js');
            ocrWorker = await createWorker(language);
          }
          const recognized = await ocrWorker.recognize(canvas);
          text = recognized.data.text.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
          const confidence = normalizeOcrConfidence(recognized.data.confidence);
          let reviewed = false;
          if (options.reviewOcrPage) {
            const review = await options.reviewOcrPage({ pageNumber, text, confidence, reason: assessment.reason || 'empty' });
            text = review.text.trim();
            reviewed = review.reviewed;
          }
          ocrMetadata = { confidence, language, reason: assessment.reason || 'empty', reviewed };
          ocrConfidences.push(confidence);
          ocrPages += 1;
          onProgress({ phase: 'ocr', currentPage: pageNumber, totalPages, currentBatch: batchIndex + 1, totalBatches, message: `OCR concluído na página ${pageNumber} com ${confidence}% de confiança.`, ocrConfidence: confidence, ocrReason: assessment.reason || 'empty' });
          canvas.width = 1;
          canvas.height = 1;
        }
        pages.push({ pageNumber, text, ...(ocrMetadata ? { ocr: ocrMetadata } : {}) });
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
      body: JSON.stringify({ documentId, ocrPages, ocrLanguage: language, ocrConfidence: averageOcrConfidence(ocrConfidences) ?? session.ocrConfidence ?? null }),
    });
    if (ocrWorker) await ocrWorker.terminate();
    await loadingTask.destroy();
    return { documentId, totalPages, chunkCount: completed.chunkCount, ocrPages, ocrConfidence: averageOcrConfidence(ocrConfidences) ?? session.ocrConfidence ?? null };
  } catch (error) {
    if (ocrWorker) await ocrWorker.terminate().catch(() => undefined);
    await loadingTask.destroy().catch(() => undefined);
    throw error;
  }
}

function improveCanvasForOcr(context: CanvasRenderingContext2D, width: number, height: number): void {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  for (let index = 0; index < data.length; index += 4) {
    const gray = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
    data[index] = contrasted; data[index + 1] = contrasted; data[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
}

const PENDING_PDF_DB = 'avanco-pdf-processing';
export async function savePendingPdf(file: File, language: OcrLanguage): Promise<void> {
  if (!('indexedDB' in window)) return;
  const database = await openPendingDatabase();
  await new Promise<void>((resolve, reject) => { const transaction = database.transaction('pending', 'readwrite'); transaction.objectStore('pending').put({ id: 'current', file, language, savedAt: Date.now() }); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  database.close();
}
export async function loadPendingPdf(): Promise<{ file: File; language: OcrLanguage } | null> {
  if (!('indexedDB' in window)) return null;
  const database = await openPendingDatabase();
  const value = await new Promise<{ file: File; language: OcrLanguage; savedAt: number } | undefined>((resolve, reject) => { const request = database.transaction('pending', 'readonly').objectStore('pending').get('current'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  database.close();
  if (!value || Date.now() - value.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
  return { file: value.file, language: value.language };
}
export async function clearPendingPdf(): Promise<void> {
  if (!('indexedDB' in window)) return;
  const database = await openPendingDatabase();
  await new Promise<void>((resolve, reject) => { const transaction = database.transaction('pending', 'readwrite'); transaction.objectStore('pending').delete('current'); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
  database.close();
}
function openPendingDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const request = indexedDB.open(PENDING_PDF_DB, 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('pending')) request.result.createObjectStore('pending', { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}

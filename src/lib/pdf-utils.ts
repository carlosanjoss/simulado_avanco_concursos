import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Buffer } from 'buffer';

// Suppress pdfjs-dist canvas warnings in serverless environments
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
  // @ts-ignore - suppress canvas warnings
  globalThis.__PDFJS_DISABLE_CANVAS_WARNINGS__ = true;
}

export const MAX_PDF_PAGES = 400;

export interface PDFExtractResult {
  text: string;
  pages: Array<{ pageNumber: number; text: string }>;
  pageCount: number;
  info: Record<string, unknown>;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<PDFExtractResult> {
  try {
    const data = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    if (data.numPages > MAX_PDF_PAGES) {
      throw new Error('PDF_TOO_MANY_PAGES');
    }
    
    let fullText = '';
    const pages: Array<{ pageNumber: number; text: string }> = [];
    for (let pageNum = 1; pageNum <= data.numPages; pageNum++) {
      const page = await data.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .join(' ');
      const cleanedPageText = cleanExtractedText(pageText);
      pages.push({ pageNumber: pageNum, text: cleanedPageText });
      fullText += cleanedPageText + '\n\n';
    }

    const cleanedText = cleanExtractedText(fullText);

    return {
      text: cleanedText,
      pages,
      pageCount: data.numPages,
      info: data.fingerprints ? { fingerprints: data.fingerprints } : {},
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'PDF_TOO_MANY_PAGES') throw error;
    console.error('PDF extraction failed:', error instanceof Error ? error.message : 'Erro desconhecido');
    throw new Error(`Falha ao extrair texto do PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\f/g, '\n\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function validatePDFFile(file: File): { valid: boolean; error?: string } {
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'Apenas arquivos PDF são permitidos' };
  }
  
  const maxSize = 20 * 1024 * 1024; // 20 MB
  if (file.size > maxSize) {
    return { valid: false, error: 'Arquivo muito grande. Tamanho máximo: 20 MB' };
  }
  
  return { valid: true };
}

export function validatePDFBuffer(buffer: Buffer): { valid: boolean; error?: string } {
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return { valid: false, error: 'O arquivo enviado não possui uma assinatura PDF válida.' };
  }
  return { valid: true };
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateTextForTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + '\n\n[TEXTO TRUNCADO PARA LIMITE DE TOKENS]';
}

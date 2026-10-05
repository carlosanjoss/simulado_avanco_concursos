import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { extractTextFromPDF, MAX_PDF_PAGES, validatePDFBuffer, validatePDFFile } from '@/lib/pdf-utils';

describe('PDF validation', () => {
  it('accepts a valid PDF file and signature', () => {
    const file = new File(['%PDF-1.7'], 'material.pdf', { type: 'application/pdf' });
    expect(validatePDFFile(file)).toEqual({ valid: true });
    expect(validatePDFBuffer(Buffer.from('%PDF-1.7'))).toEqual({ valid: true });
  });

  it('rejects a renamed non-PDF and files above 20 MB', () => {
    const renamed = new File(['hello'], 'material.pdf', { type: 'text/plain' });
    const large = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' });
    expect(validatePDFFile(renamed).valid).toBe(false);
    expect(validatePDFFile(large).valid).toBe(false);
    expect(validatePDFBuffer(Buffer.from('hello')).valid).toBe(false);
  });

  it('extracts text and counts pages with PDF.js', async () => {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    document.addPage().drawText('Conteudo da primeira pagina', { font });
    document.addPage().drawText('Conteudo da segunda pagina', { font });
    const result = await extractTextFromPDF(Buffer.from(await document.save()));
    expect(result.pageCount).toBe(2);
    expect(result.text).toContain('Conteudo da primeira pagina');
    expect(result.text).toContain('Conteudo da segunda pagina');
  });

  it('rejects documents above the 400-page processing limit', async () => {
    const document = await PDFDocument.create();
    for (let page = 0; page <= MAX_PDF_PAGES; page += 1) document.addPage();
    await expect(extractTextFromPDF(Buffer.from(await document.save()))).rejects.toThrow('PDF_TOO_MANY_PAGES');
  });
});

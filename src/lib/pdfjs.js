import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { SimpleLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs';

// Form-widget + annotation styling (the .annotationLayer rules we rely on for positioning).
import 'pdfjs-dist/web/pdf_viewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;

export { AnnotationLayer, AnnotationMode } from 'pdfjs-dist';

// AnnotationLayer requires a link service; for a form filler it's a no-op, so a
// single shared instance is all anyone needs.
export const linkService = new SimpleLinkService();

// Opens a PDF, pointing at the font/cMap assets served from public/ (needed to
// render standard fonts and to draw typed text into form fields on export).
export function loadPdfDocument(data) {
  const base = import.meta.env.BASE_URL;
  return getDocument({
    data,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
  }).promise;
}

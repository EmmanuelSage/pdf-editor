import { GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { SimpleLinkService } from 'pdfjs-dist/web/pdf_viewer.mjs';

// Form-widget + annotation styling (the .annotationLayer rules we rely on for positioning).
import 'pdfjs-dist/web/pdf_viewer.css';

GlobalWorkerOptions.workerSrc = workerUrl;

export { getDocument, AnnotationLayer, AnnotationMode } from 'pdfjs-dist';

// AnnotationLayer requires a link service; for a form filler it's a no-op, so a
// single shared instance is all anyone needs.
export const linkService = new SimpleLinkService();

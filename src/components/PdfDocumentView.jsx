import PdfPageView from './PdfPageView';

export default function PdfDocumentView({ pdf, scale }) {
  return (
    <div className="doc">
      {Array.from({ length: pdf.numPages }, (_, i) => (
        <PdfPageView key={i + 1} pdf={pdf} pageNumber={i + 1} scale={scale} />
      ))}
    </div>
  );
}

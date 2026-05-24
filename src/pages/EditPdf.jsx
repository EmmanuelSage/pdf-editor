import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDocument } from '../lib/pdfjs';
import { downloadBytes } from '../lib/download';
import Dropzone from '../components/Dropzone';
import PdfDocumentView from '../components/PdfDocumentView';

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;

export default function EditPdf() {
  const [pdf, setPdf] = useState(null);
  const [fileName, setFileName] = useState('');
  const [scale, setScale] = useState(1.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The open document owns worker resources; release them when it's replaced or
  // when we leave the page.
  useEffect(() => () => pdf?.destroy(), [pdf]);

  const openFile = useCallback(async (file) => {
    setError('');
    setBusy(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const base = import.meta.env.BASE_URL;
      const doc = await getDocument({
        data,
        // Served from public/ — needed to render standard fonts and to draw
        // typed text into form fields on export.
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
      }).promise;
      setPdf(doc);
      setFileName(file.name);
    } catch (err) {
      setError(`Could not open this PDF: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const download = useCallback(async () => {
    if (!pdf) return;
    setError('');
    setBusy(true);
    try {
      // saveDocument() merges annotationStorage (the typed field values) back into the PDF.
      const bytes = await pdf.saveDocument();
      downloadBytes(bytes, `${fileName.replace(/\.pdf$/i, '')} - filled.pdf`);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [pdf, fileName]);

  const closeDoc = useCallback(() => {
    setPdf(null);
    setFileName('');
    setError('');
  }, []);

  const zoom = (delta) =>
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));

  return (
    <div className="app">
      <header className="toolbar">
        <Link to="/" className="back-link">← Home</Link>
        <span className="tool-title">Edit document</span>
        {pdf && (
          <>
            <span className="file" title={fileName}>{fileName}</span>
            <span className="pages">{pdf.numPages} pages</span>
            <span className="spacer" />
            <div className="zoom-group">
              <button onClick={() => zoom(-ZOOM_STEP)} aria-label="Zoom out">−</button>
              <span className="zoom-val">{Math.round(scale * 100)}%</span>
              <button onClick={() => zoom(ZOOM_STEP)} aria-label="Zoom in">+</button>
            </div>
            <button className="primary" onClick={download} disabled={busy}>
              Download filled PDF
            </button>
            <button onClick={closeDoc}>Close</button>
          </>
        )}
      </header>

      {error && <div className="error-bar">{error}</div>}

      <main className="stage">
        {pdf ? (
          <PdfDocumentView pdf={pdf} scale={scale} />
        ) : (
          <Dropzone onFile={openFile} />
        )}
        {busy && <div className="busy">Working…</div>}
      </main>
    </div>
  );
}

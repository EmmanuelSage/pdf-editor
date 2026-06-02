import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadPdfDocument } from '../lib/pdfjs';
import { downloadBytes } from '../lib/download';
import { saveEditSession, loadEditSession, clearEditSession } from '../lib/sessionStore';
import Dropzone from '../components/Dropzone';
import PdfDocumentView from '../components/PdfDocumentView';

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;
const AUTOSAVE_DELAY = 1000;
const SAVE = { idle: 'idle', saving: 'saving', saved: 'saved' };

export default function EditPdf() {
  const [pdf, setPdf] = useState(null);
  const [fileName, setFileName] = useState('');
  const [scale, setScale] = useState(1.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const [saveState, setSaveState] = useState(SAVE.idle);

  const stageRef = useRef(null);
  // Latest fileName/scale for the autosave callback, so it doesn't have to
  // re-subscribe (and cancel a pending save) every time they change.
  const metaRef = useRef({ fileName, scale });
  useEffect(() => { metaRef.current = { fileName, scale }; }, [fileName, scale]);

  // The open document owns worker resources; release them when it's replaced or
  // when we leave the page.
  useEffect(() => () => pdf?.destroy(), [pdf]);

  const applyDocument = useCallback((doc, name, docScale) => {
    setPdf(doc);
    setFileName(name);
    if (docScale) setScale(docScale);
    setSaveState(SAVE.idle);
  }, []);

  // Restore an autosaved draft on first load so a refresh doesn't lose work.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let session;
      try {
        session = await loadEditSession();
      } catch (err) {
        console.warn('Could not read saved draft:', err);
        return;
      }
      if (cancelled || !session) return;
      let doc;
      try {
        doc = await loadPdfDocument(session.bytes);
      } catch {
        await clearEditSession();
        return;
      }
      if (cancelled) {
        doc.destroy();
        return;
      }
      applyDocument(doc, session.fileName, session.scale);
      setRestored(true);
    })();
    return () => { cancelled = true; };
  }, [applyDocument]);

  // Autosave the filled PDF (debounced) whenever a form field changes. Reloading
  // re-opens these bytes with the values already in place. Saves are serialized
  // so a slow save can't land after a newer one and restore stale values.
  useEffect(() => {
    const stage = stageRef.current;
    if (!pdf || !stage) return undefined;
    let timer;
    let saving = false;
    let pending = false;

    const save = async () => {
      if (saving) { pending = true; return; }
      saving = true;
      try {
        do {
          pending = false;
          if (pdf.annotationStorage.size === 0) break;
          setSaveState(SAVE.saving);
          const bytes = await pdf.saveDocument();
          const { fileName, scale } = metaRef.current;
          await saveEditSession({ fileName, bytes, scale, savedAt: Date.now() });
          setSaveState(SAVE.saved);
        } while (pending);
      } catch {
        setSaveState(SAVE.idle);
      } finally {
        saving = false;
      }
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(save, AUTOSAVE_DELAY);
    };

    stage.addEventListener('input', schedule);
    stage.addEventListener('change', schedule);
    return () => {
      clearTimeout(timer);
      stage.removeEventListener('input', schedule);
      stage.removeEventListener('change', schedule);
    };
  }, [pdf]);

  const openFile = useCallback(async (file) => {
    setError('');
    setBusy(true);
    try {
      const buffer = await file.arrayBuffer();
      // PDF.js transfers (detaches) the buffer it's given, so hand it a copy and
      // keep the original for storage.
      const doc = await loadPdfDocument(buffer.slice(0));
      applyDocument(doc, file.name);
      setRestored(false);
      await saveEditSession({ fileName: file.name, bytes: new Uint8Array(buffer), scale, savedAt: Date.now() });
    } catch (err) {
      setError(`Could not open this PDF: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [scale, applyDocument]);

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
    setRestored(false);
    setSaveState(SAVE.idle);
    clearEditSession().catch(() => {});
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
            {saveState !== SAVE.idle && (
              <span className="save-state">{saveState === SAVE.saving ? 'Saving…' : '✓ Saved'}</span>
            )}
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
      {restored && (
        <div className="info-bar">
          <span>Picked up your unsaved draft where you left off.</span>
          <button className="link-btn" onClick={closeDoc}>Discard &amp; start over</button>
          <button className="link-btn" onClick={() => setRestored(false)}>Dismiss</button>
        </div>
      )}

      <main className="stage" ref={stageRef}>
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

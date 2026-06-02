import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadPdfDocument } from '../lib/pdfjs';
import { downloadBytes } from '../lib/download';
import { exportPdfWithOverlays, makeBox } from '../lib/overlay';
import { saveEditSession, loadEditSession, clearEditSession } from '../lib/sessionStore';
import Dropzone from '../components/Dropzone';
import PdfDocumentView from '../components/PdfDocumentView';

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 0.15;
const AUTOSAVE_DELAY = 1000;
const SAVE = { idle: 'idle', saving: 'saving', saved: 'saved' };
const TOOL = { select: 'select', text: 'text' };

export default function EditPdf() {
  const [pdf, setPdf] = useState(null);
  const [fileName, setFileName] = useState('');
  const [scale, setScale] = useState(1.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const [saveState, setSaveState] = useState(SAVE.idle);

  // Free-text overlay state.
  const [tool, setTool] = useState(TOOL.select);
  const [boxes, setBoxes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newBoxId, setNewBoxId] = useState(null);

  const stageRef = useRef(null);
  // Latest values for the autosave callback, so it doesn't have to re-subscribe
  // (and cancel a pending save) every time they change.
  const metaRef = useRef({ fileName, scale });
  useEffect(() => { metaRef.current = { fileName, scale }; }, [fileName, scale]);
  const boxesRef = useRef(boxes);
  useEffect(() => { boxesRef.current = boxes; }, [boxes]);
  // Lets the boxes-changed effect trigger a save without owning the save logic.
  const scheduleRef = useRef(null);

  // The open document owns worker resources; release them when it's replaced or
  // when we leave the page.
  useEffect(() => () => pdf?.destroy(), [pdf]);

  const applyDocument = useCallback((doc, name, docScale, overlays = []) => {
    setPdf(doc);
    setFileName(name);
    if (docScale) setScale(docScale);
    setBoxes(overlays);
    setSelectedId(null);
    setTool(TOOL.select);
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
      applyDocument(doc, session.fileName, session.scale, session.overlays || []);
      setRestored(true);
    })();
    return () => { cancelled = true; };
  }, [applyDocument]);

  // Autosave (debounced) whenever a form field changes or a text box is edited.
  // Reloading re-opens these bytes with form values in place and the overlay
  // boxes restored. Saves are serialized so a slow save can't land after a newer
  // one and restore stale values.
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
          // Nothing typed anywhere yet — don't churn the original bytes.
          if (pdf.annotationStorage.size === 0 && boxesRef.current.length === 0) break;
          setSaveState(SAVE.saving);
          const bytes = await pdf.saveDocument();
          const { fileName, scale } = metaRef.current;
          await saveEditSession({
            fileName, bytes, scale, overlays: boxesRef.current, savedAt: Date.now(),
          });
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
    scheduleRef.current = schedule;

    stage.addEventListener('input', schedule);
    stage.addEventListener('change', schedule);
    return () => {
      clearTimeout(timer);
      scheduleRef.current = null;
      stage.removeEventListener('input', schedule);
      stage.removeEventListener('change', schedule);
    };
  }, [pdf]);

  // contentEditable edits don't bubble a React-visible event to the stage's DOM
  // listener reliably across browsers, so trigger the same debounced save here.
  useEffect(() => {
    if (pdf) scheduleRef.current?.();
  }, [boxes, pdf]);

  const addBox = useCallback((page, x, y) => {
    const box = makeBox(page, x, y);
    setBoxes((prev) => [...prev, box]);
    setSelectedId(box.id);
    setNewBoxId(box.id);
    setTool(TOOL.select); // so the next click edits/places rather than adding again
  }, []);

  const updateBox = useCallback((id, patch) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const removeBox = useCallback((id) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  // Drop empty boxes when they lose selection so stray clicks don't litter the page.
  const selectBox = useCallback((id) => {
    if (selectedId && selectedId !== id) {
      setBoxes((bs) => bs.filter((b) => b.id !== selectedId || b.text.trim() !== ''));
    }
    setSelectedId(id);
    setNewBoxId(null);
  }, [selectedId]);

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
      await saveEditSession({
        fileName: file.name, bytes: new Uint8Array(buffer), scale, overlays: [], savedAt: Date.now(),
      });
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
      // Merges typed AcroForm values and burns the overlay text boxes into the PDF.
      const bytes = await exportPdfWithOverlays(pdf, boxes);
      downloadBytes(bytes, `${fileName.replace(/\.pdf$/i, '')} - edited.pdf`);
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [pdf, fileName, boxes]);

  const closeDoc = useCallback(() => {
    setPdf(null);
    setFileName('');
    setError('');
    setRestored(false);
    setBoxes([]);
    setSelectedId(null);
    setTool(TOOL.select);
    setSaveState(SAVE.idle);
    clearEditSession().catch(() => {});
  }, []);

  const zoom = (delta) =>
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(s + delta).toFixed(2))));

  // Memoized so unrelated state churn (saveState, busy, error) doesn't recreate
  // this object and re-render every page's TextLayer.
  const textProps = useMemo(
    () => ({
      tool,
      boxes,
      selectedId,
      newBoxId,
      onAdd: addBox,
      onSelect: selectBox,
      onChange: updateBox,
      onRemove: removeBox,
    }),
    [tool, boxes, selectedId, newBoxId, addBox, selectBox, updateBox, removeBox],
  );

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
            <div className="tool-group" role="group" aria-label="Editing tool">
              <button
                className={tool === TOOL.select ? 'active' : ''}
                onClick={() => setTool(TOOL.select)}
                title="Select & fill form fields"
              >
                ↖ Select
              </button>
              <button
                className={tool === TOOL.text ? 'active' : ''}
                onClick={() => setTool(TOOL.text)}
                title="Click anywhere on the page to add text"
              >
                T Add text
              </button>
            </div>
            <div className="zoom-group">
              <button onClick={() => zoom(-ZOOM_STEP)} aria-label="Zoom out">−</button>
              <span className="zoom-val">{Math.round(scale * 100)}%</span>
              <button onClick={() => zoom(ZOOM_STEP)} aria-label="Zoom in">+</button>
            </div>
            <button className="primary" onClick={download} disabled={busy}>
              Download PDF
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
      {pdf && tool === TOOL.text && (
        <div className="info-bar">
          <span>Click anywhere on the page to drop a text box.</span>
          <button className="link-btn" onClick={() => setTool(TOOL.select)}>Done</button>
        </div>
      )}

      <main className="stage" ref={stageRef}>
        {pdf ? (
          <PdfDocumentView pdf={pdf} scale={scale} textProps={textProps} />
        ) : (
          <Dropzone onFile={openFile} />
        )}
        {busy && <div className="busy">Working…</div>}
      </main>
    </div>
  );
}

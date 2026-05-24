import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildPdfFromImages, PAGE_SIZE_OPTIONS } from '../lib/imagesToPdf';
import { downloadBytes } from '../lib/download';

const isImage = (file) => file.type.startsWith('image/');

export default function ImagesToPdf() {
  const [items, setItems] = useState([]); // { id, file, url, rotation }
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const dragId = useRef(null);

  // Object URLs back the thumbnails; release them when items are removed (below)
  // and when leaving the page.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url)), []);

  const addFiles = useCallback((fileList) => {
    const images = [...fileList].filter(isImage);
    if (images.length === 0) {
      setError('Those files aren’t images. Add PNG, JPG, or other image files.');
      return;
    }
    setError('');
    setItems((prev) => [
      ...prev,
      ...images.map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
        rotation: 0,
      })),
    ]);
  }, []);

  const rotateItem = useCallback((id) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, rotation: (it.rotation + 90) % 360 } : it)),
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const gone = prev.find((it) => it.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const reorder = useCallback((fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setItems((prev) => {
      const from = prev.findIndex((it) => it.id === fromId);
      const to = prev.findIndex((it) => it.id === toId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const exportPdf = useCallback(async () => {
    if (items.length === 0) return;
    setError('');
    setBusy(true);
    try {
      const bytes = await buildPdfFromImages(items, { pageSize });
      downloadBytes(bytes, 'images.pdf');
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [items, pageSize]);

  const onPick = (e) => {
    addFiles(e.target.files);
    e.target.value = ''; // allow re-picking the same file
  };

  const hasItems = items.length > 0;

  return (
    <div className="app">
      <header className="toolbar">
        <Link to="/" className="back-link">← Home</Link>
        <span className="tool-title">Images to PDF</span>
        {hasItems && (
          <>
            <span className="pages">{items.length} image{items.length > 1 ? 's' : ''}</span>
            <span className="spacer" />
            <label className="page-size">
              Page
              <select value={pageSize} onChange={(e) => setPageSize(e.target.value)}>
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>
            <button onClick={() => fileInputRef.current?.click()}>Add images</button>
            <button className="primary" onClick={exportPdf} disabled={busy}>
              Export PDF
            </button>
          </>
        )}
      </header>

      {error && <div className="error-bar">{error}</div>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPick}
      />

      <main className="stage">
        {hasItems ? (
          <div className="image-grid">
            {items.map((it, i) => (
              <figure
                key={it.id}
                className="image-card"
                draggable
                onDragStart={() => { dragId.current = it.id; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => reorder(dragId.current, it.id)}
                onDragEnd={() => { dragId.current = null; }}
              >
                <span className="image-num">{i + 1}</span>
                <button
                  className="image-remove"
                  onClick={() => removeItem(it.id)}
                  aria-label={`Remove ${it.file.name}`}
                >
                  ×
                </button>
                <div className="image-thumb-box">
                  <img
                    className="image-thumb"
                    style={{ transform: `rotate(${it.rotation}deg)` }}
                    src={it.url}
                    alt={it.file.name}
                  />
                </div>
                <div className="image-footer">
                  <button
                    className="image-rotate"
                    onClick={() => rotateItem(it.id)}
                    title="Rotate 90° clockwise"
                    aria-label={`Rotate ${it.file.name}`}
                  >
                    ↻
                  </button>
                  <span className="image-name" title={it.file.name}>{it.file.name}</span>
                </div>
              </figure>
            ))}
          </div>
        ) : (
          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            <div className="dropzone-icon">🖼️</div>
            <p className="dropzone-title">Drop images here, or click to browse</p>
            <p className="dropzone-hint">Each image becomes one page. Drag to reorder before exporting.</p>
            <p className="dropzone-privacy">Runs entirely in your browser — your files never leave your device.</p>
          </div>
        )}
        {busy && <div className="busy">Building PDF…</div>}
      </main>
    </div>
  );
}

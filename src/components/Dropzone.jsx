import { useRef, useState } from 'react';

export default function Dropzone({ onFile }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  const pick = (files) => {
    const file = files?.[0];
    if (file && /\.pdf$/i.test(file.name)) onFile(file);
  };

  return (
    <div
      className={`dropzone${over ? ' over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => pick(e.target.files)}
      />
      <div className="dropzone-icon">📄</div>
      <p className="dropzone-title">Drop a PDF here, or click to browse</p>
      <p className="dropzone-hint">Type into the form fields, then download your filled copy.</p>
      <p className="dropzone-privacy">Runs entirely in your browser — the file never leaves your device.</p>
    </div>
  );
}

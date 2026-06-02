import { useEffect, useRef } from 'react';
import { LINE_HEIGHT } from '../lib/overlay';

const FONT_MIN = 6;
const FONT_MAX = 72;
const FONT_STEP = 2;

// One editable, draggable text box positioned over a PDF page. Position/size are
// stored unscaled (PDF points); this component multiplies by `scale` for display.
// Text is edited in a contentEditable div so the box grows to fit its content.
export default function TextBox({ box, scale, selected, onSelect, onChange, onRemove, autoFocus }) {
  const editRef = useRef(null);
  // Drag bookkeeping: pointer start + the box's start position, in CSS pixels.
  const dragRef = useRef(null);

  // Seed the editable text once. After that the DOM is the source of truth while
  // the user types, so we must not overwrite it on every keystroke re-render.
  useEffect(() => {
    if (editRef.current && editRef.current.innerText !== box.text) {
      editRef.current.innerText = box.text;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoFocus && editRef.current) {
      editRef.current.focus();
    }
  }, [autoFocus]);

  const onPointerDown = (e) => {
    // Drag from the handle only, so clicking the text just places the caret.
    e.preventDefault();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    dragRef.current = { startX, startY, boxX: box.x, boxY: box.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    onChange({ x: Math.max(0, d.boxX + dx), y: Math.max(0, d.boxY + dy) });
  };

  const onPointerUp = (e) => {
    if (dragRef.current) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const setFont = (delta) =>
    onChange({ fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, box.fontSize + delta)) });

  return (
    <div
      className={`text-box${selected ? ' selected' : ''}`}
      style={{ left: box.x * scale, top: box.y * scale }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {selected && (
        <div className="text-box-bar" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className="tb-handle"
            title="Drag to move"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            ✥
          </button>
          <button onClick={() => setFont(-FONT_STEP)} title="Smaller">A−</button>
          <button onClick={() => setFont(FONT_STEP)} title="Larger">A+</button>
          <button className="tb-del" onClick={onRemove} title="Delete">✕</button>
        </div>
      )}
      <div
        ref={editRef}
        className="text-box-edit"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        // lineHeight comes from the same constant the exporter uses, so the
        // on-screen box and the burned-in PDF text stay in sync.
        style={{ fontSize: box.fontSize * scale, lineHeight: LINE_HEIGHT }}
        onFocus={onSelect}
        onInput={(e) => onChange({ text: e.currentTarget.innerText })}
      />
    </div>
  );
}

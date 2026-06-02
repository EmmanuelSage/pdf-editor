import TextBox from './TextBox';

// Overlay covering one PDF page, holding its text boxes.
//
// In 'select' mode the layer is click-through (pointer-events: none in CSS) so
// existing AcroForm fields underneath stay usable; only the boxes themselves are
// interactive. In 'text' mode the layer captures clicks on empty page area to add
// a new box where you click.
export default function TextLayer({
  tool,
  boxes,
  scale,
  selectedId,
  newBoxId,
  onAdd,
  onSelect,
  onChange,
  onRemove,
}) {
  const onLayerMouseDown = (e) => {
    if (e.target !== e.currentTarget) return; // ignore clicks bubbling from a box
    if (tool === 'text') {
      // Stop the browser's default mousedown focus (it would move focus to <body>
      // after we focus the new box, leaving the caret nowhere).
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      onAdd((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
    } else if (selectedId) {
      onSelect(null); // click empty page area to deselect
    }
  };

  return (
    <div
      className={`text-layer${tool === 'text' ? ' adding' : ''}`}
      onMouseDown={onLayerMouseDown}
    >
      {boxes.map((box) => (
        <TextBox
          key={box.id}
          box={box}
          scale={scale}
          selected={box.id === selectedId}
          autoFocus={box.id === newBoxId}
          onSelect={() => onSelect(box.id)}
          onChange={(patch) => onChange(box.id, patch)}
          onRemove={() => onRemove(box.id)}
        />
      ))}
    </div>
  );
}

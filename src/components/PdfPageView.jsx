import { memo, useEffect, useRef, useState } from 'react';
import { AnnotationLayer, AnnotationMode, linkService } from '../lib/pdfjs';
import TextLayer from './TextLayer';

// Renders one PDF page: a canvas for the visual, PDF.js's interactive
// AnnotationLayer on top so existing AcroForm fields become typeable HTML inputs,
// and a TextLayer above that for free-text overlay boxes.
// Memoized so a sibling page editing its boxes (or toolbar state changing) doesn't
// re-render — and re-run the expensive canvas render of — every other page.
function PdfPageView({ pdf, pageNumber, scale, textProps }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const annoRef = useRef(null);
  // Set once the page has rendered, so the TextLayer only mounts with real
  // dimensions; also gates the layer until the page geometry is known.
  const [ready, setReady] = useState(false);
  // Survives StrictMode's double-mount and zoom re-renders so we never run two
  // renders on the same canvas at once (PDF.js deadlocks if you do).
  const renderTaskRef = useRef(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      // Cancel any render still in flight (re-mount / zoom change) and wait for
      // it to actually stop before touching the shared canvas again.
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        try {
          await renderTaskRef.current.promise;
        } catch {
          /* expected RenderingCancelledException */
        }
        renderTaskRef.current = null;
      }

      const page = await pdf.getPage(pageNumber);
      if (!active) return;

      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;
      const cssW = Math.floor(viewport.width);
      const cssH = Math.floor(viewport.height);

      wrapRef.current.style.width = `${cssW}px`;
      wrapRef.current.style.height = `${cssH}px`;

      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      // ENABLE_FORMS paints everything except form widgets onto the canvas;
      // the widgets themselves are drawn as live HTML by the AnnotationLayer below.
      const task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        annotationMode: AnnotationMode.ENABLE_FORMS,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
      });
      renderTaskRef.current = task;

      try {
        await task.promise;
      } catch (err) {
        if (err?.name === 'RenderingCancelledException') return;
        throw err;
      } finally {
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      }
      if (!active) return;

      const annotations = await page.getAnnotations({ intent: 'display' });
      if (!active) return;

      const annoDiv = annoRef.current;
      annoDiv.replaceChildren();
      // PDF.js sizes the layer and positions every widget from these CSS vars.
      // --scale-round-x/y are the rounding step for the layer's width/height
      // (it uses CSS round()); without them the dimensions evaluate to 0 and
      // all fields collapse into the top-left corner. Snap to whole pixels.
      annoDiv.style.setProperty('--scale-factor', scale);
      annoDiv.style.setProperty('--total-scale-factor', scale);
      annoDiv.style.setProperty('--scale-round-x', '1px');
      annoDiv.style.setProperty('--scale-round-y', '1px');

      const layer = new AnnotationLayer({
        div: annoDiv,
        page,
        viewport: viewport.clone({ dontFlip: true }),
        linkService,
        annotationStorage: pdf.annotationStorage,
      });
      await layer.render({ annotations, renderForms: true });
      setReady(true);
    };

    run().catch((err) => console.error(`Page ${pageNumber} render failed:`, err));

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  return (
    <div className="page-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="page-canvas" />
      <div ref={annoRef} className="annotationLayer" />
      {ready && textProps && (
        <TextLayer
          {...textProps}
          boxes={textProps.boxes.filter((b) => b.page === pageNumber)}
          scale={scale}
          onAdd={(x, y) => textProps.onAdd(pageNumber, x, y)}
        />
      )}
    </div>
  );
}

export default memo(PdfPageView);

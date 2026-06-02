import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

// Visual tuning so the exported text lands where the on-screen box shows it.
// LINE_HEIGHT must match the .text-box line-height in CSS; BASELINE_RATIO is how
// far below a line's top the glyph baseline sits, as a fraction of font size.
export const LINE_HEIGHT = 1.2;
const BASELINE_RATIO = 0.92;

// A freshly placed text box, in unscaled PDF.js viewport coordinates (top-left
// origin, points). page is 1-based to match PDF.js.
export function makeBox(page, x, y, fontSize = 14) {
  return { id: crypto.randomUUID(), page, x, y, fontSize, text: '' };
}

// Burns the overlay text boxes into the PDF and returns the saved bytes.
//
// We start from pdf.saveDocument() rather than the original file so any AcroForm
// values the user also typed are preserved; then pdf-lib draws the boxes on top.
// Positions come from PDF.js's viewport.convertToPdfPoint, which maps our
// top-left viewport coordinates into PDF user space (and accounts for the page's
// CropBox). Verified for unrotated pages; rotated pages are placed but text
// orientation is best-effort.
export async function exportPdfWithOverlays(pdf, boxes) {
  const baseBytes = await pdf.saveDocument();
  const filled = boxes.filter((b) => b.text.trim() !== '');
  if (filled.length === 0) return baseBytes;

  const doc = await PDFDocument.load(baseBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const docPages = doc.getPages();

  // Group by page so we only fetch each PDF.js page viewport once.
  const byPage = new Map();
  for (const box of filled) {
    if (!byPage.has(box.page)) byPage.set(box.page, []);
    byPage.get(box.page).push(box);
  }

  for (const [pageNumber, pageBoxes] of byPage) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const out = docPages[pageNumber - 1];
    const rotation = out.getRotation().angle || 0;

    for (const box of pageBoxes) {
      const lines = box.text.split('\n');
      lines.forEach((line, i) => {
        if (line === '') return;
        // Baseline of line i, measured from the box top in viewport space.
        const vy = box.y + i * box.fontSize * LINE_HEIGHT + box.fontSize * BASELINE_RATIO;
        const [px, py] = viewport.convertToPdfPoint(box.x, vy);
        out.drawText(line, {
          x: px,
          y: py,
          size: box.fontSize,
          font,
          color: rgb(0, 0, 0),
          rotate: degrees(-rotation),
        });
      });
    }
  }

  return doc.save();
}

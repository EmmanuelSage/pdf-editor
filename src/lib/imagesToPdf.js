import { PDFDocument, degrees, PageSizes } from 'pdf-lib';

// Page-size choices, shared with the UI <select> so the values can't drift.
export const PAGE_SIZE_OPTIONS = [
  { value: 'match', label: 'Match image' },
  { value: 'a4', label: 'Fit to A4' },
  { value: 'letter', label: 'Fit to Letter' },
];
const FIXED_SIZES = { a4: PageSizes.A4, letter: PageSizes.Letter };
const MARGIN = 24;

// pdf-lib's embedJpg ignores EXIF orientation, so a phone photo that displays
// upright in the browser would export sideways. Read the orientation flag so we
// know when we need to bake it into the pixels (below).
function readJpegOrientation(bytes) {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint16(0) !== 0xffd8) return 1; // not a JPEG
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset);
      offset += 2;
      if (marker === 0xffe1) {
        const exifStart = offset + 2;
        if (view.getUint32(exifStart) !== 0x45786966) return 1; // "Exif"
        const tiff = exifStart + 6;
        const little = view.getUint16(tiff) === 0x4949;
        const ifd0 = tiff + view.getUint32(tiff + 4, little);
        const count = view.getUint16(ifd0, little);
        for (let i = 0; i < count; i++) {
          const entry = ifd0 + 2 + i * 12;
          if (view.getUint16(entry, little) === 0x0112) {
            return view.getUint16(entry + 8, little);
          }
        }
        return 1;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      offset += view.getUint16(offset);
    }
  } catch {
    /* fall through to "no rotation" */
  }
  return 1;
}

// Decode with EXIF orientation applied, then re-encode to `type`.
async function reorientToBytes(file, type) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.95));
  return new Uint8Array(await blob.arrayBuffer());
}

// pdf-lib embeds JPEG/PNG directly; other formats (webp, gif, …) and EXIF-rotated
// JPEGs are normalized through a canvas first so the PDF matches the preview.
async function embedImage(pdfDoc, file) {
  if (file.type === 'image/png') {
    return pdfDoc.embedPng(new Uint8Array(await file.arrayBuffer()));
  }
  if (file.type === 'image/jpeg') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (readJpegOrientation(bytes) === 1) return pdfDoc.embedJpg(bytes);
    return pdfDoc.embedJpg(await reorientToBytes(file, 'image/jpeg'));
  }
  return pdfDoc.embedPng(await reorientToBytes(file, 'image/png'));
}

// The image's footprint after a 0/90/180/270° turn (90/270 swap the axes).
const footprint = (w, h, rot) => (rot % 180 === 0 ? [w, h] : [h, w]);

// Draw `image` scaled to fit (with margin), centered, turned `rot`° clockwise.
// PDF rotation is counterclockwise-positive, so we pass -rot and offset the
// anchor (drawImage rotates around the lower-left corner) to keep it centred.
function drawCentered(page, image, rot, pageW, pageH, margin) {
  const [fw, fh] = footprint(image.width, image.height, rot);
  const scale = Math.min((pageW - 2 * margin) / fw, (pageH - 2 * margin) / fh);
  const sw = image.width * scale;
  const sh = image.height * scale;
  const rad = (-rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  page.drawImage(image, {
    x: pageW / 2 - (sw / 2) * cos + (sh / 2) * sin,
    y: pageH / 2 - (sw / 2) * sin - (sh / 2) * cos,
    width: sw,
    height: sh,
    rotate: degrees(-rot),
  });
}

// Builds a PDF from `items` ({ file, rotation }), one image per page.
// pageSize 'match' sizes each page to its image; 'a4'/'letter' fit the image
// (auto-oriented to the image) onto a fixed page with a margin.
export async function buildPdfFromImages(items, { pageSize = 'match' } = {}) {
  const pdfDoc = await PDFDocument.create();
  for (const { file, rotation = 0 } of items) {
    const image = await embedImage(pdfDoc, file);
    const rot = ((rotation % 360) + 360) % 360;
    const [fw, fh] = footprint(image.width, image.height, rot);

    if (pageSize === 'match') {
      const page = pdfDoc.addPage([fw, fh]);
      drawCentered(page, image, rot, fw, fh, 0);
    } else {
      const [pw, ph] = FIXED_SIZES[pageSize];
      const [pageW, pageH] = fw > fh ? [ph, pw] : [pw, ph]; // landscape image → landscape page
      const page = pdfDoc.addPage([pageW, pageH]);
      drawCentered(page, image, rot, pageW, pageH, MARGIN);
    }
  }
  return pdfDoc.save();
}

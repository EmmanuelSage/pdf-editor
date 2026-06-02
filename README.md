# PDF Toolkit

A fully client-side suite of small PDF tools. Everything runs in the browser — files
never leave the device. Current tools:

- **Edit document** — open a PDF with AcroForm fields, type into them, download a filled copy.
- **Images to PDF** — combine images into a single PDF (one image per page), reorder, rotate,
  choose page size (match image / A4 / Letter), export.

> [!IMPORTANT]
> **PDF.js font/cMap data is NOT committed — it's generated into `public/`.**
> `public/cmaps/` and `public/standard_fonts/` are **gitignored** and copied from
> `node_modules` by `scripts/copy-pdfjs-assets.mjs`. **If these folders are missing,
> the app loads but pages render blank / fields don't appear.**
>
> They are created automatically on `npm install` (postinstall), `npm run dev` (predev),
> and `npm run build` (prebuild). If you ever delete `public/` or copy the repo without
> reinstalling, run:
>
> ```bash
> npm run copy-pdfjs-assets   # or just: npm run dev
> ```

## How it works

**Edit document** (read + fill existing PDFs) uses [PDF.js](https://mozilla.github.io/pdf.js/):

| Concern | Library | Notes |
|---------|---------|-------|
| Render pages | PDF.js | Each page drawn to a `<canvas>` |
| Type into fields | PDF.js `AnnotationLayer` | Existing form fields become live HTML inputs, overlaid on the canvas |
| Export | PDF.js `saveDocument()` | Merges typed values (`annotationStorage`) back into the PDF |

The page canvas is rendered with `AnnotationMode.ENABLE_FORMS`, so it paints everything
*except* form widgets — those are drawn as interactive HTML by the annotation layer, so
there's no double-rendering.

**Autosave / crash recovery**: as you fill fields, the filled PDF is autosaved (debounced)
to **IndexedDB** (`src/lib/sessionStore.js`) — IndexedDB rather than localStorage because the
PDF is multi-MB binary. On reload the draft is re-opened with the values already in place, so
a refresh or accidental close doesn't lose work. Persisting the *saved PDF bytes* (via
`saveDocument()`) rather than a separate values blob means restore is just "re-open the file" —
no field-value serialization to keep in sync. The draft is cleared when you Close the document.

**Images to PDF** (create a new PDF) uses [pdf-lib](https://pdf-lib.js.org/). Each image
becomes one page; you can rotate images 90° at a time and pick the page size (match the
image, or fit onto A4/Letter with the page auto-oriented to the image). Notes:

- JPEG/PNG are embedded directly. Other browser-decodable formats (webp, gif, …) are
  rasterized to PNG via a canvas first.
- **EXIF orientation** is honored: pdf-lib ignores the EXIF rotation flag, so a phone photo
  would otherwise export sideways. We read the flag and, only when it's non-default, bake the
  correct orientation into the pixels — so the PDF matches the thumbnail.
- Rotation is applied with a centered `drawImage` (not page `/Rotate`), so it composes
  cleanly with the fit-to-page math.

## Run

```bash
npm install      # also runs copy-pdfjs-assets (postinstall) → fills public/
npm run dev      # http://localhost:5173 (predev re-copies assets first)
npm run build    # production build into dist/ (prebuild re-copies assets first)
```

The `npm install` step is what populates `public/cmaps` and `public/standard_fonts`
(see the **Important** note above). Don't skip it, and don't expect those folders in
a fresh `git clone` until you've installed.

## Layout

The app is a small multi-tool suite. `react-router-dom` maps each tool to a URL; the
home page is a launcher of tool cards.

- `src/App.jsx` — routes: `/` → Home, `/edit` → EditPdf, `/images-to-pdf` → ImagesToPdf
  (unknown paths redirect to `/`)
- `src/pages/Home.jsx` — landing page; grid of tool cards (add a tool by adding an entry)
- `src/pages/EditPdf.jsx` — the editor: open, zoom, fill fields, export/download
- `src/pages/ImagesToPdf.jsx` — upload images, reorder (drag), export a combined PDF
- `src/lib/imagesToPdf.js` — builds the PDF from image files (pdf-lib)
- `src/lib/pdfjs.js` — configures the PDF.js worker, loads the form CSS, owns the shared no-op
  `linkService`, and exposes `loadPdfDocument(data)` (wraps the font/cMap options)
- `src/lib/sessionStore.js` — IndexedDB autosave/restore for the Edit-document draft
- `src/lib/download.js` — shared `downloadBytes(bytes, filename)` helper
- `src/components/Dropzone.jsx` — upload / drag-and-drop
- `src/components/PdfPageView.jsx` — renders one page: canvas + interactive annotation layer
- `src/components/PdfDocumentView.jsx` — stacks all pages
- `scripts/copy-pdfjs-assets.mjs` — copies PDF.js font/cMap data from `node_modules`
  into `public/` (runs automatically on `postinstall`, `predev`, `prebuild`). These are
  verbatim dependency files, so they're **gitignored**, not committed

> [!NOTE]
> Client-side routing: the dev server and `vite preview` serve `index.html` for any path,
> so deep links like `/edit` work. A static host needs an SPA fallback (rewrite all routes
> to `index.html`) for refresh-on-`/edit` to work.

## Scope

- **Edit document** fills **existing** form fields. PDFs without form fields (flat scans)
  render but have nothing to type into — click-to-place free-text boxes is a natural next step.
- **Images to PDF** does one image per page (rotation + match-image/A4/Letter page sizes).
  Multi-up layouts (several images per page) would be a natural next step.

## Troubleshooting

**Pages render blank, or form fields don't appear / aren't editable.**
The PDF.js font/cMap assets are missing from `public/`. They're gitignored and generated
from `node_modules`. Fix:

```bash
npm run copy-pdfjs-assets
```

(Or just `npm run dev` / `npm install`, which run it automatically.) Confirm the folders
exist and are populated — `public/cmaps/` (~169 files) and `public/standard_fonts/` (~16 files).

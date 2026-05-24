# PDF Form Editor

A fully client-side PDF form filler. Open a PDF with AcroForm fields, type into them
naturally, and download a filled copy. The file never leaves the browser.

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

| Concern | Library | Notes |
|---------|---------|-------|
| Render pages | [PDF.js](https://mozilla.github.io/pdf.js/) | Each page drawn to a `<canvas>` |
| Type into fields | PDF.js `AnnotationLayer` | Existing form fields become live HTML inputs, overlaid on the canvas |
| Export | PDF.js `saveDocument()` | Merges typed values (`annotationStorage`) back into the PDF |

The page canvas is rendered with `AnnotationMode.ENABLE_FORMS`, so it paints everything
*except* form widgets — those are drawn as interactive HTML by the annotation layer, so
there's no double-rendering.

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

- `src/App.jsx` — routes: `/` → Home, `/edit` → EditPdf (unknown paths redirect to `/`)
- `src/pages/Home.jsx` — landing page; grid of tool cards (add a tool by adding an entry)
- `src/pages/EditPdf.jsx` — the editor: open, zoom, fill fields, export/download
- `src/lib/pdfjs.js` — configures the PDF.js worker, re-exports the bits we use, loads the
  form CSS, and owns the shared no-op `linkService`
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

v1 fills **existing** form fields. PDFs without form fields (flat scans) will render but
have nothing to type into — adding click-to-place free-text boxes is the natural next step.

## Troubleshooting

**Pages render blank, or form fields don't appear / aren't editable.**
The PDF.js font/cMap assets are missing from `public/`. They're gitignored and generated
from `node_modules`. Fix:

```bash
npm run copy-pdfjs-assets
```

(Or just `npm run dev` / `npm install`, which run it automatically.) Confirm the folders
exist and are populated — `public/cmaps/` (~169 files) and `public/standard_fonts/` (~16 files).

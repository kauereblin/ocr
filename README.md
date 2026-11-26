# OCRia-nano Studio

A local-first web application for recognizing text, tables, and document layout from PDFs and images using **LiteParse WebAssembly (`@llamaindex/liteparse-wasm`)** and **OCRia-nano-1** — running entirely in the browser with no backend server and zero file retention.

## Features

- **100% Client-Side Execution (WASM SIMD)** — Runs PDFium, LiteParse's Rust spatial layout engine, and the 8.1M-parameter **OCRia-nano-1** OCR + **LayoutNet** models inside a dedicated browser Web Worker.
- **Instantaneous Ephemeral File Handling** — Files never leave your device, are never persisted to disk or browser storage, are transferred zero-copy (`Transferable`) into the worker, and have their byte buffers zero-filled and WASM handles freed immediately upon completion.
- **PDF & Image Support** — Parses native and scanned PDFs directly; converts PNG, JPEG, WebP, GIF, BMP, and SVG images in-memory into a DPI-calibrated PDF 1.4 buffer (~5 ms) before recognition. Supports drag-and-drop, file selection, and `Ctrl+V` clipboard paste.
- **Multiple Output Views & Export** — Switch between rendered **Markdown**, **Raw `.md`**, structured **JSON** (with bounding boxes and metadata), **Plain Text**, and classified **Layout Blocks**, with one-click copy and file download.
- **Bilingual Interface (EN / PT)** — Instant English and Portuguese switching directly from the top-right header control.

## Model Profiles

| Profile | Included Components | Footprint |
|---|---|---|
| **Full Multilingual + LayoutNet** | Detector, router, Latin/CJK/RTL/World recognizers + `tablenet.bin` | ~30 MB |
| **Latin + LayoutNet** | Detector, router, Latin recognizer + `tablenet.bin` | ~18.5 MB |
| **Ultra-Light Latin** | Detector, router, and Latin recognizer | ~1.5 MB |

On first use, model weights are fetched with SHA-256 verification and cached locally via the browser Cache API.

## Getting Started

Requires **Node.js 18+** and **pnpm**.

```bash
# Install dependencies
pnpm install

# Start the local development server
pnpm dev

# Typecheck and build the static production bundle
pnpm build

# Preview the production build locally
pnpm preview
```

## Optional: Embedding Model Weights Locally

By default, the app checks `/models/ocria-nano/` first and falls back to the official SHA-256-verified Hugging Face release (`llamaindex/OCRia-nano-1@v1.0.0`).

If you have already downloaded `ocria-nano` weights locally (e.g., via `@llamaindex/liteparse` CLI `lit models pull ocria-nano` into `%LOCALAPPDATA%\liteparse\models\ocria-nano` on Windows or `~/.cache/liteparse/models/ocria-nano` on macOS/Linux):

- During `pnpm dev`, the Vite middleware automatically serves local weights from that directory with zero external requests.
- For a completely offline static production build, copy the weights into `public/models/ocria-nano/`:

```bash
pnpm run embed-models
```

## Project Structure

```text
├── index.html
├── vite.config.ts               # Vite config + local model dev middleware
├── scripts/
│   └── embed-models.mjs         # Copies local ocria-nano weights into public/
└── src/
    ├── App.tsx                  # Main workspace, EN/PT header switch, dropzone, back-to-top
    ├── index.css
    ├── components/
    │   └── OutputViewer.tsx     # Markdown, Raw .md, JSON, Plain Text & Layout Blocks viewer
    ├── lib/
    │   ├── i18n.ts              # English and Portuguese translations
    │   ├── imageToPdf.ts        # Zero-dependency in-memory image-to-PDF 1.4 encoder
    │   └── sanitizeMarkdown.ts  # Safe GFM Markdown renderer
    ├── types/
    │   └── ocr.ts               # Shared TypeScript interfaces & model profile definitions
    └── workers/
        └── ocr.worker.ts        # Isolated WASM + OCRia-nano-1 Web Worker with memory zeroing
```

## Limitations & Licensing

- **Office documents** (`.docx`, `.xlsx`, `.pptx`) are not supported in browser WASM because conversion requires LibreOffice.
- **LiteParse** is licensed under **Apache 2.0**.
- **OCRia-nano-1** model weights are licensed separately under a modified **Open RAIL-M** license.

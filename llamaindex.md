# OCRia-nano-1: Fast, Accurate Document Parsing on CPU

**Source:** [LlamaIndex – Introducing OCRia-nano-1](https://www.llamaindex.ai/blog/introducing-ocria-nano-1)

**Published:** November 23, 2026

## 1. About OCRia-nano-1

OCRia-nano-1 is an extremely lightweight document-understanding model developed by LlamaIndex.

It is designed for massive, high-volume document ingestion and applications that require fast results on everyday documents.

### Key characteristics

- **Model size:** 8.1 million parameters.
- **Execution:** Local CPU execution.
- **Architecture:** Seven specialized document models.
- **Purpose:** Text recognition, table structure extraction, and layout recovery.
- **Integration:** LiteParse, an open-source local document parser.
- **Deployment:** Lightweight installation without heavy dependencies.

### Supported documents

- Digitally generated reports.
- Contracts.
- Invoices with simple tables.
- Scanned documents.
- Image-based PDF pages.

The objective is to make OCRia-nano-1 the default first processing stage for organizational document collections, while allowing more complex documents to be processed by larger vision-language models (VLMs).

## 2. Accuracy and Speed

OCRia-nano-1 combines text, table, and layout extraction with the processing speed required for everyday document workloads.

### Benchmark results

| Metric | Result |
|---|---:|
| Model parameters | 8.1 million |
| ParseBench-2 overall score | 59.2 |
| ParseBench-2 table score | 59.5 |
| Average processing time | 426 ms/page |
| 90% of pages processed within | 862 ms |
| Throughput with 16 workers | 27.8 pages/second |
| Throughput improvement over default Tesseract configuration | 2x |

Processing time is measured on a single CPU core and includes the complete LiteParse pipeline, from text recognition to structural recovery.

The model operates 2–5x or more faster than default Tesseract OCR, depending on the comparison.

## 3. Inside OCRia-nano-1

LiteParse starts by extracting text already available in the document.

For digital PDFs, it reads usable text directly from the file. OCRia-nano-1 recognizes text when the original text layer is missing or unreadable, including scanned documents and embedded images.

The table and layout model then uses the text, its position on the page, and visual features to recover table structures and identify content blocks.

### Processing architecture

The complete pipeline consists of:

1. **Input PDF/Image:** Receives the original document.
2. **PDFium text extraction:** Extracts existing text from digital PDFs.
3. **Page check:** Determines whether OCR is required.
4. **OCR processing:** Recognizes text on pages without usable text layers.
5. **OCR merge:** Combines recognized OCR lines with native PDF text.
6. **Grid projection:** Processes text and positional signals.
7. **LayoutNet:** Recovers document structure and identifies content blocks.
8. **Output:** Generates Markdown or JSON.

### Model components

| Component | Parameters |
|---|---:|
| OCR stack | 3.8M |
| Line detector | 82K |
| Script router | 38K |
| Four recognizers | 0.7–1.3M each |
| Grid projection and LayoutNet | 4.3M |
| **Total** | **8.1M** |

The system combines native PDF text extraction, OCR, and learned structural recovery in one local pipeline.

### Training

OCRia-nano-1 was trained through model distillation.

OCRia-1 helped generate:

- Text transcriptions.
- Table annotations.
- Layout labels.

These were used for training the lightweight model.

## 4. Markdown and Structured Output

OCRia-nano-1 provides three output formats through LiteParse.

| Format | Description |
|---|---|
| Markdown | Document text, headings, lists, and reconstructed tables |
| JSON | Extracted text and bounding boxes |
| Plain text | Extracted textual content |

JSON is particularly useful for applications that need to locate extracted content on the original document page.

## 5. Multilingual Text Recognition

OCRia-nano-1 supports multilingual documents, including pages containing multiple writing systems.

Supported script categories include:

- Latin.
- Chinese, Japanese, and Korean (CJK).
- Right-to-left scripts.
- Other scripts.

### Script recognition process

1. A lightweight script router identifies the majority script on each page.
2. Individual lines can override the page-level script when the router is sufficiently confident.
3. Upside-down pages are detected before recognition.

This enables the system to process documents containing mixed scripts.

## 6. Choosing Between OCRia-nano-1 and OCRia-1

OCRia-nano-1 and OCRia-1 are designed for different document-processing workloads.

| Capability | OCRia-nano-1 | OCRia-1 |
|---|---|---|
| Primary objective | Speed and scale | Maximum accuracy |
| Model size | 8.1M parameters | Larger VLM |
| CPU execution | Designed for local CPU execution | More computationally demanding |
| Everyday documents | Recommended | Supported |
| Simple tables | Supported | Supported |
| Complex tables | Less suitable | Recommended |
| Handwriting | Less suitable | Recommended |
| Heavily degraded scans | Less suitable | Recommended |
| Scanned mathematical notation | Less suitable | Recommended |
| Chart-to-table extraction | Not supported | Recommended |

### When to use OCRia-nano-1

Choose OCRia-nano-1 for:

- Everyday documents.
- High-volume document ingestion.
- Fast local CPU processing.
- Digitally generated reports.
- Straightforward contracts.
- Invoices with simple tables.
- Routine scans and image-based pages.

### When to use OCRia-1

Choose OCRia-1 for:

- Complex tables.
- Handwriting.
- Heavily degraded scans.
- Scanned mathematical notation.
- Chart-to-table extraction.

**Important limitation:** OCRia-nano-1 does not include a chart model. Charts are retained as images rather than converted into structured tables.

## 7. Installation and Usage

OCRia-nano-1 runs locally through LiteParse.

### Installation

```bash
pip install liteparse
```

### Download the model

```bash
lit models pull ocria-nano
```

### Parse a document

```bash
lit parse doc.pdf --format markdown
```

The resulting document is parsed locally and returned in Markdown format.

## 8. Availability and Licensing

- OCRia-nano-1 model weights are available on Hugging Face.
- Model weights are governed by a modified Open RAIL-M license.
- LiteParse is licensed separately under Apache 2.0.
- Commercial licensing questions can be directed to LlamaIndex.

## 9. Official Resources

- [Original LlamaIndex announcement](https://www.llamaindex.ai/blog/introducing-ocria-nano-1)
- [LiteParse GitHub repository](https://github.com/run-llama/liteparse)
- [Technical report](https://www.llamaindex.ai/blog/introducing-ocria-nano-1)

## 10. Key Takeaways

1. OCRia-nano-1 is an 8.1-million-parameter document parsing model designed for CPU execution.
2. It combines OCR, native PDF text extraction, and layout reconstruction.
3. It achieves an average processing time of 426 ms per page on a single CPU core.
4. It supports multilingual text recognition.
5. It produces Markdown, JSON, and plain-text outputs.
6. It is optimized for high-volume document ingestion.
7. It integrates directly with LiteParse.
8. OCRia-1 remains the recommended option for handwriting, complex tables, charts, and severely degraded scans.

---

*Content extracted and structured from the official LlamaIndex announcement. This document is a technical summary rather than a verbatim reproduction of the original article.*
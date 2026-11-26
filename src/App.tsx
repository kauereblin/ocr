import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  AlertCircle,
  ArrowUp,
  FileJson,
  FileText,
  FileType2,
  Upload,
} from "lucide-react";
import { OutputViewer } from "./components/OutputViewer";
import { TRANSLATIONS } from "./lib/i18n";
import { convertImageFileToPdf } from "./lib/imageToPdf";
import {
  MODEL_PROFILES,
  type DocumentParseOutput,
  type Locale,
  type ModelProfileId,
  type OutputFormat,
  type ParseOptions,
  type WorkerRequest,
  type WorkerResponse,
} from "./types/ocr";

const ACCEPTED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg";
const LOCALE_STORAGE_KEY = "ocria-nano-locale";

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === "pt" || saved === "en") return saved;
  } catch {
    // Ignore storage access errors
  }
  return "en";
}

function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function isSupportedImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
}

export function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const t = TRANSLATIONS[locale];
  const localeRef = useRef<Locale>(locale);
  localeRef.current = locale;

  const [profile, setProfile] = useState<ModelProfileId>("full");
  const [options, setOptions] = useState<ParseOptions>({
    outputFormat: "markdown",
    ocrEnabled: true,
    dpi: 250,
    extractBlocks: true,
    keepHeadersFooters: false,
    targetPages: "",
  });

  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState(() => t.statusReady);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<DocumentParseOutput | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.documentElement.lang = t.langAttr;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage access errors
    }
  }, [locale, t.langAttr]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 220);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const worker = new Worker(
      new URL("./workers/ocr.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const currentT = TRANSLATIONS[localeRef.current];

      if (msg.type === "status") {
        setStatusMessage(msg.message);
        if (typeof msg.progress === "number") {
          setProgress(msg.progress);
        }
        return;
      }

      if (msg.type === "ready") {
        setStatusMessage(currentT.statusModelReady(msg.loadDurationMs));
        setProgress(100);
        return;
      }

      if (msg.type === "result") {
        setBusy(false);
        setProgress(100);
        setStatusMessage(currentT.statusParsedWiped);
        setOutput(msg.output);
        return;
      }

      if (msg.type === "error") {
        setBusy(false);
        setProgress(0);
        setError(msg.message);
        setStatusMessage(currentT.statusError);
      }
    };

    worker.onerror = (e) => {
      setBusy(false);
      setError(e.message || TRANSLATIONS[localeRef.current].workerCrashed);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      const worker = workerRef.current;
      if (!worker || busy) return;

      setError(null);

      const pdf = isPdfFile(file);
      const image = !pdf && isSupportedImageFile(file);

      if (!pdf && !image) {
        setError(t.unsupportedFile(file.name));
        return;
      }

      setBusy(true);
      setProgress(6);

      try {
        let pdfBuffer: ArrayBuffer;
        let wasImageConverted = false;

        if (pdf) {
          setStatusMessage(t.readingPdf(file.name));
          pdfBuffer = await file.arrayBuffer();
        } else {
          setStatusMessage(t.rasterizingImage(file.name));
          const converted = await convertImageFileToPdf(file, options.dpi);
          pdfBuffer = converted.pdfBuffer;
          wasImageConverted = true;
        }

        const req: WorkerRequest = {
          type: "parse",
          id: crypto.randomUUID(),
          locale,
          fileName: file.name,
          fileMime: file.type || (pdf ? "application/pdf" : "image/*"),
          originalSizeBytes: file.size,
          wasImageConverted,
          pdfBuffer,
          options,
          profile,
          originUrl: window.location.origin,
        };

        // Zero-copy Transferable: immediately detaches pdfBuffer from main thread
        worker.postMessage(req, [pdfBuffer]);
      } catch (err) {
        setBusy(false);
        setProgress(0);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [busy, locale, options, profile, t]
  );

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Instantaneously detach the FileList reference from the DOM input
    e.target.value = "";
    if (file) {
      void processFile(file);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  // Support Ctrl+V image paste directly in the workspace
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (busy) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            void processFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, processFile]);

  const setOutputFormat = (fmt: OutputFormat) => {
    setOptions((prev) => ({ ...prev, outputFormat: fmt }));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand-title">OCRia-nano Studio</span>
        </div>

        <div className="topbar-right">
          <div
            className="lang-switch"
            role="group"
            aria-label={t.languageSwitchLabel}
          >
            <button
              type="button"
              className={`lang-btn ${locale === "en" ? "active" : ""}`}
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={`lang-btn ${locale === "pt" ? "active" : ""}`}
              aria-pressed={locale === "pt"}
              onClick={() => setLocale("pt")}
            >
              PT
            </button>
          </div>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="sidebar" aria-label={t.sidebarAria}>
          <div className="sidebar-section">
            <span className="sidebar-label">{t.outputFormatLabel}</span>
            <div className="format-group">
              <button
                type="button"
                className={`format-btn ${options.outputFormat === "markdown" ? "active" : ""}`}
                onClick={() => setOutputFormat("markdown")}
              >
                <FileType2 size={16} />
                {t.formats.markdown}
              </button>
              <button
                type="button"
                className={`format-btn ${options.outputFormat === "json" ? "active" : ""}`}
                onClick={() => setOutputFormat("json")}
              >
                <FileJson size={16} />
                {t.formats.json}
              </button>
              <button
                type="button"
                className={`format-btn ${options.outputFormat === "text" ? "active" : ""}`}
                onClick={() => setOutputFormat("text")}
              >
                <FileText size={16} />
                {t.formats.text}
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <span className="sidebar-label">{t.profileLabel}</span>
            <div className="profile-list">
              {MODEL_PROFILES.map((item) => {
                const copy = t.profiles[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    className={`profile-card ${profile === item.id ? "active" : ""}`}
                    onClick={() => setProfile(item.id)}
                  >
                    <div className="profile-card-head">
                      <span className="profile-name">{copy.label}</span>
                      <span className="profile-size">{item.sizeLabel}</span>
                    </div>
                    <div className="profile-desc">{copy.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sidebar-section">
            <span className="sidebar-label">{t.parsingOptionsLabel}</span>

            <div className="field-stack">
              <label className="field-row" htmlFor="dpi-select">
                <span>{t.renderDpiLabel}</span>
              </label>
              <select
                id="dpi-select"
                className="select-input"
                value={options.dpi}
                disabled={busy}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    dpi: Number(e.target.value),
                  }))
                }
              >
                <option value={150}>{t.dpiOptions[150]}</option>
                <option value={200}>{t.dpiOptions[200]}</option>
                <option value={250}>{t.dpiOptions[250]}</option>
                <option value={300}>{t.dpiOptions[300]}</option>
              </select>
            </div>

            <div className="field-stack">
              <label className="field-row" htmlFor="target-pages">
                <span>{t.targetPagesLabel}</span>
              </label>
              <input
                id="target-pages"
                type="text"
                className="text-input"
                placeholder={t.targetPagesPlaceholder}
                value={options.targetPages}
                disabled={busy}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    targetPages: e.target.value,
                  }))
                }
              />
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={options.ocrEnabled}
                disabled={busy}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    ocrEnabled: e.target.checked,
                  }))
                }
              />
              <span>{t.enableOcrLabel}</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={options.extractBlocks}
                disabled={busy}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    extractBlocks: e.target.checked,
                  }))
                }
              />
              <span>{t.extractBlocksLabel}</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={options.keepHeadersFooters}
                disabled={busy}
                onChange={(e) =>
                  setOptions((prev) => ({
                    ...prev,
                    keepHeadersFooters: e.target.checked,
                  }))
                }
              />
              <span>{t.keepHeadersFootersLabel}</span>
            </label>
          </div>
        </aside>

        <main className={`main-content ${!output ? "is-empty" : ""}`}>
          <header className="doc-header">
            <h1 className="doc-title">{t.mainTitle}</h1>
          </header>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            style={{ display: "none" }}
            onChange={handleFileInputChange}
          />

          <div
            role="button"
            tabIndex={0}
            aria-label={t.dropzoneAria}
            className={`dropzone ${dragging ? "dragging" : ""} ${busy ? "busy" : ""}`}
            onClick={() => !busy && fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (!busy && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="dropzone-icon">
              <Upload size={21} />
            </div>
            <div className="dropzone-title">
              {busy ? t.dropzoneBusy : t.dropzoneIdle}
            </div>

            <div className="dropzone-chips">
              {["PDF", "PNG", "JPEG", "WebP", "GIF", "BMP", "SVG", "Ctrl+V"].map(
                (fmt) => (
                  <span key={fmt} className="format-chip">
                    {fmt}
                  </span>
                )
              )}
            </div>

            {busy && (
              <div
                className="progress-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.max(6, progress)}%` }}
                  />
                </div>
                <div className="progress-meta">
                  <span>{statusMessage}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="callout callout-error" role="alert">
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>{t.errorTitle}</strong> {error}
              </div>
            </div>
          )}

          {output && (
            <OutputViewer
              output={output}
              locale={locale}
              t={t.output}
              onClear={() => setOutput(null)}
            />
          )}
        </main>
      </div>

      <button
        type="button"
        className={`back-to-top ${showBackToTop ? "visible" : ""}`}
        onClick={scrollToTop}
        aria-label={t.backToTop}
        title={t.backToTop}
      >
        <ArrowUp size={15} />
      </button>
    </div>
  );
}

export default App;

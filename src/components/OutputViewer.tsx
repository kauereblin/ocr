import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  Layers,
  Trash2,
} from "lucide-react";
import type { Translations } from "../lib/i18n";
import { renderSafeMarkdown } from "../lib/sanitizeMarkdown";
import type { DocumentParseOutput, Locale, OutputFormat } from "../types/ocr";

type ViewerTab =
  | "markdown-rendered"
  | "markdown-raw"
  | "json"
  | "text"
  | "blocks";

interface OutputViewerProps {
  output: DocumentParseOutput;
  locale: Locale;
  t: Translations["output"];
  onClear: () => void;
}

function defaultTabForFormat(format: OutputFormat): ViewerTab {
  if (format === "json") return "json";
  if (format === "text") return "text";
  return "markdown-rendered";
}

export function OutputViewer({
  output,
  locale,
  t,
  onClear,
}: OutputViewerProps) {
  const [activeTab, setActiveTab] = useState<ViewerTab>(() =>
    defaultTabForFormat(output.selectedFormat)
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveTab(defaultTabForFormat(output.selectedFormat));
  }, [output.fileName, output.selectedFormat, output.purgeAudit.purgedAtIso]);

  const renderedHtml = useMemo(
    () => renderSafeMarkdown(output.markdown),
    [output.markdown]
  );

  const activeDownloadContent = useMemo(() => {
    if (activeTab === "json") {
      return {
        text: output.structuredJson,
        ext: "json",
        mime: "application/json;charset=utf-8",
      };
    }
    if (activeTab === "text") {
      return {
        text: output.plainText,
        ext: "txt",
        mime: "text/plain;charset=utf-8",
      };
    }
    return {
      text: output.markdown,
      ext: "md",
      mime: "text/markdown;charset=utf-8",
    };
  }, [activeTab, output.markdown, output.plainText, output.structuredJson]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeDownloadContent.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownload = () => {
    const baseName = output.fileName.replace(/\.[^.]+$/, "") || "document";
    const blob = new Blob([activeDownloadContent.text], {
      type: activeDownloadContent.mime,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.${activeDownloadContent.ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const totalBlocks = output.pages.reduce(
    (sum, p) => sum + (p.blocks?.length ?? 0),
    0
  );
  const totalSpans = output.pages.reduce(
    (sum, p) => sum + p.textItems.length,
    0
  );

  const formattedTime = new Date(
    output.purgeAudit.purgedAtIso
  ).toLocaleTimeString(locale === "pt" ? "pt-BR" : "en-US");

  return (
    <section className="output-card" aria-label={t.ariaLabel}>
      <div className="output-header">
        <div className="output-meta-group">
          <div className="output-filename">{output.fileName}</div>
          <div className="output-stats">
            <span>
              {output.totalPages}{" "}
              {output.totalPages === 1 ? t.pageSingular : t.pagePlural}
            </span>
            <span>·</span>
            <span>{output.durationMs} ms</span>
            <span>·</span>
            <span>
              {totalSpans} {t.textSpans}
            </span>
            <span>·</span>
            <span>
              {output.ocrUsed ? "OCRia-nano-1" : t.nativeTextEngine}
              {output.hasLayoutModel ? " + LayoutNet" : ""}
            </span>
            <span>·</span>
            <span>{t.origins[output.modelOrigin]}</span>
          </div>
        </div>
      </div>

      <div className="output-toolbar">
        <div className="segmented" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "markdown-rendered"}
            className={`segmented-btn ${activeTab === "markdown-rendered" ? "active" : ""}`}
            onClick={() => setActiveTab("markdown-rendered")}
          >
            {t.tabs.markdown}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "markdown-raw"}
            className={`segmented-btn ${activeTab === "markdown-raw" ? "active" : ""}`}
            onClick={() => setActiveTab("markdown-raw")}
          >
            {t.tabs.rawMd}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "json"}
            className={`segmented-btn ${activeTab === "json" ? "active" : ""}`}
            onClick={() => setActiveTab("json")}
          >
            {t.tabs.json}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "text"}
            className={`segmented-btn ${activeTab === "text" ? "active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            {t.tabs.plainText}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "blocks"}
            className={`segmented-btn ${activeTab === "blocks" ? "active" : ""}`}
            onClick={() => setActiveTab("blocks")}
          >
            {t.tabs.blocks(totalBlocks)}
          </button>
        </div>

        <div className="output-actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleCopy}
            title={copied ? t.copiedTitle : t.copyTitle}
            aria-label={copied ? t.copiedTitle : t.copyTitle}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleDownload}
            title={t.downloadTitle(activeDownloadContent.ext)}
          >
            <Download size={14} />.{activeDownloadContent.ext}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClear}
            title={t.clearTitle}
            aria-label={t.clearTitle}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="output-body">
        {activeTab === "markdown-rendered" && (
          <article className="doc-prose">
            {output.markdown.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            ) : (
              <p className="field-caption">{t.noCharacters}</p>
            )}
          </article>
        )}

        {activeTab === "markdown-raw" && (
          <pre className="code-viewer">
            {output.markdown || t.emptyMarkdown}
          </pre>
        )}

        {activeTab === "json" && (
          <pre className="code-viewer">{output.structuredJson}</pre>
        )}

        {activeTab === "text" && (
          <pre className="code-viewer">
            {output.plainText || t.emptyPlainText}
          </pre>
        )}

        {activeTab === "blocks" && (
          <div>
            {output.pages.map((page) => (
              <div key={page.pageNum} className="page-block-section">
                <div className="page-block-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Layers size={15} />
                    <strong>{t.pageHeading(page.pageNum)}</strong>
                    <span className="field-caption">
                      {Math.round(page.width)} × {Math.round(page.height)} pt ·{" "}
                      {t.textItemsCount(page.textItems.length)}
                    </span>
                  </div>
                </div>

                {page.blocks && page.blocks.length > 0 ? (
                  <div className="block-grid">
                    {page.blocks.map((block, idx) => (
                      <div key={idx} className="block-item">
                        <div className="block-item-head">
                          <span className="block-kind">
                            {block.kind}
                            {block.level ? ` h${block.level}` : ""}
                          </span>
                          {block.bbox && (
                            <span className="block-bbox">
                              x:{Math.round(block.bbox.x)} y:
                              {Math.round(block.bbox.y)} w:
                              {Math.round(block.bbox.width)} h:
                              {Math.round(block.bbox.height)}
                            </span>
                          )}
                        </div>
                        {block.text && (
                          <div style={{ fontSize: 13.5 }}>{block.text}</div>
                        )}
                        {block.lines && block.lines.length > 0 && (
                          <pre
                            className="code-viewer"
                            style={{ padding: "8px 10px", marginTop: 4 }}
                          >
                            {block.lines.join("\n")}
                          </pre>
                        )}
                        {block.kind === "table" && (
                          <div style={{ overflowX: "auto", marginTop: 6 }}>
                            <table className="doc-table">
                              {block.header && block.header.length > 0 && (
                                <thead>
                                  <tr>
                                    {block.header.map((cell, ci) => (
                                      <th key={ci}>{cell.text}</th>
                                    ))}
                                  </tr>
                                </thead>
                              )}
                              {block.rows && block.rows.length > 0 && (
                                <tbody>
                                  {block.rows.map((row, ri) => (
                                    <tr key={ri}>
                                      {row.map((cell, ci) => (
                                        <td key={ci}>{cell.text}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              )}
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="callout callout-info">
                    <FileCode2 size={16} />
                    <span>
                      {t.noBlocksBefore}
                      <strong>{t.noBlocksStrong}</strong>
                      {t.noBlocksAfter}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="output-footer">
        <span style={{ fontFamily: "var(--font-mono)" }}>
          {t.lastRun} {formattedTime}
        </span>
      </div>
    </section>
  );
}

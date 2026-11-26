import type {
  LayoutBlock,
  PageComplexityStats,
  TextItem,
} from "@llamaindex/liteparse-wasm";

export type Locale = "en" | "pt";

export type OutputFormat = "markdown" | "json" | "text";

export type ModelProfileId = "full" | "latin-layout" | "latin-lite";

export interface ModelProfile {
  id: ModelProfileId;
  sizeLabel: string;
  scripts: Array<"latin" | "cjk" | "rtl" | "world">;
  layout: boolean;
}

export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: "full",
    sizeLabel: "~30 MB",
    scripts: ["latin", "cjk", "rtl", "world"],
    layout: true,
  },
  {
    id: "latin-layout",
    sizeLabel: "~18.5 MB",
    scripts: ["latin"],
    layout: true,
  },
  {
    id: "latin-lite",
    sizeLabel: "~1.5 MB",
    scripts: ["latin"],
    layout: false,
  },
];

export type ModelOrigin =
  | "embedded-public"
  | "local-installed"
  | "huggingface-cdn"
  | "browser-cache"
  | "unloaded";

export interface ParseOptions {
  outputFormat: OutputFormat;
  ocrEnabled: boolean;
  dpi: number;
  extractBlocks: boolean;
  keepHeadersFooters: boolean;
  targetPages: string;
}

export interface PurgeAudit {
  originalSizeBytes: number;
  convertedPdfBytes: number | null;
  transferredToWorker: boolean;
  bufferZeroed: boolean;
  wasmFreed: boolean;
  retainedBytes: number;
  purgedAtIso: string;
}

export interface DocumentParseOutput {
  fileName: string;
  fileMime: string;
  wasImageConverted: boolean;
  selectedFormat: OutputFormat;
  totalPages: number;
  durationMs: number;
  ocrUsed: boolean;
  modelProfile: ModelProfileId;
  modelOrigin: ModelOrigin;
  hasLayoutModel: boolean;
  markdown: string;
  plainText: string;
  structuredJson: string;
  pages: Array<{
    pageNum: number;
    width: number;
    height: number;
    text: string;
    markdown: string;
    textItems: TextItem[];
    blocks?: LayoutBlock[];
    complexity?: PageComplexityStats;
  }>;
  purgeAudit: PurgeAudit;
}

export interface WorkerParseRequest {
  type: "parse";
  id: string;
  locale: Locale;
  fileName: string;
  fileMime: string;
  originalSizeBytes: number;
  wasImageConverted: boolean;
  pdfBuffer: ArrayBuffer;
  options: ParseOptions;
  profile: ModelProfileId;
  originUrl: string;
}

export type WorkerRequest = WorkerParseRequest;

export type WorkerResponse =
  | {
      type: "status";
      phase: "wasm" | "downloading" | "compiling" | "parsing" | "purging";
      message: string;
      progress?: number;
      currentFile?: string;
    }
  | {
      type: "ready";
      profile: ModelProfileId;
      modelOrigin: ModelOrigin;
      hasLayoutModel: boolean;
      loadDurationMs: number;
    }
  | {
      type: "result";
      id: string;
      output: DocumentParseOutput;
    }
  | {
      type: "error";
      id?: string;
      message: string;
    };

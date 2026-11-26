/// <reference lib="webworker" />

import initWasm, {
  LiteParse,
  OcriaNano,
  type ParseResult,
} from "@llamaindex/liteparse-wasm";
import wasmUrl from "@llamaindex/liteparse-wasm/liteparse_wasm_bg.wasm?url";
import {
  MODEL_PROFILES,
  type DocumentParseOutput,
  type Locale,
  type ModelOrigin,
  type ModelProfileId,
  type WorkerRequest,
  type WorkerResponse,
} from "../types/ocr";

const CACHE_NAME = "ocria-nano-models-v1.0.0";
const HF_BASE_URL =
  "https://huggingface.co/llamaindex/OCRia-nano-1/resolve/v1.0.0";

const rawFetch = self.fetch.bind(self);

let wasmInitialized = false;
let activeProfile: ModelProfileId | null = null;
let activeOcria: OcriaNano | null = null;
let activeModelOrigin: ModelOrigin = "unloaded";

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

function workerMsg(locale: Locale) {
  if (locale === "pt") {
    return {
      initWasm: "Inicializando o runtime WebAssembly do LiteParse...",
      restoring: (file: string, done: number, total: number) =>
        `Restaurando ${file} do cache do navegador (${done}/${total})...`,
      loadingLocal: (file: string, idx: number, total: number) =>
        `Carregando ${file} local (${idx}/${total})...`,
      downloading: (file: string, idx: number, total: number) =>
        `Baixando ${file} (${idx}/${total})...`,
      streamingLocal: (file: string, mb: string) =>
        `Carregando ${file} (${mb} MB)...`,
      streamingRemote: (file: string, mb: string) =>
        `Baixando ${file} (${mb} MB)...`,
      loadingWeightsLocal: "Carregando pesos locais do OCRia-nano-1...",
      loadingWeightsRemote: "Baixando pesos verificados do OCRia-nano-1...",
      compiling: "Preparando grafos de reconhecimento em WASM...",
      analyzing: (fileName: string) =>
        `Analisando ${fileName} com LiteParse + OCRia-nano-1...`,
      recognizedPage: (pageNum: number, count: number) =>
        `OCRia-nano-1 reconheceu a página ${pageNum} (${count} trechos)...`,
      purging: "Limpando bytes temporários da memória...",
      unknownError: "Erro desconhecido no worker.",
    };
  }
  return {
    initWasm: "Initializing LiteParse WebAssembly runtime...",
    restoring: (file: string, done: number, total: number) =>
      `Restoring ${file} from browser cache (${done}/${total})...`,
    loadingLocal: (file: string, idx: number, total: number) =>
      `Loading local ${file} (${idx}/${total})...`,
    downloading: (file: string, idx: number, total: number) =>
      `Downloading ${file} (${idx}/${total})...`,
    streamingLocal: (file: string, mb: string) =>
      `Loading ${file} (${mb} MB)...`,
    streamingRemote: (file: string, mb: string) =>
      `Downloading ${file} (${mb} MB)...`,
    loadingWeightsLocal: "Loading embedded OCRia-nano-1 weights...",
    loadingWeightsRemote: "Fetching verified OCRia-nano-1 weights...",
    compiling: "Preparing neural recognition graphs in WASM...",
    analyzing: (fileName: string) =>
      `Analyzing ${fileName} with LiteParse + OCRia-nano-1...`,
    recognizedPage: (pageNum: number, count: number) =>
      `OCRia-nano-1 recognized page ${pageNum} (${count} text spans)...`,
    purging: "Wiping transient file bytes from memory...",
    unknownError: "Unknown worker error.",
  };
}

async function ensureWasm(locale: Locale): Promise<void> {
  if (wasmInitialized) return;
  post({
    type: "status",
    phase: "wasm",
    message: workerMsg(locale).initWasm,
    progress: 5,
  });
  await initWasm({ module_or_path: wasmUrl });
  wasmInitialized = true;
}

async function probeLocalModels(
  originUrl: string
): Promise<{ available: boolean; header: string | null }> {
  try {
    const res = await rawFetch(`${originUrl}/models/ocria-nano/det.onnx`, {
      method: "HEAD",
      cache: "no-store",
    });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      // Guard against SPA fallback returning text/html on 200
      if (!contentType.includes("text/html")) {
        return {
          available: true,
          header: res.headers.get("x-ocria-model-source"),
        };
      }
    }
  } catch {
    // Not hosted locally
  }
  return { available: false, header: null };
}

/**
 * Temporarily wraps global `fetch` inside this worker while `OcriaNano.fromUrl`
 * runs so we get:
 *  1) Browser Cache API persistence for CDN weights
 *  2) Streaming byte-level download progress for the UI
 *  3) Official SHA-256 verification inside LiteParse WASM
 */
async function loadOcriaProfile(
  profileId: ModelProfileId,
  originUrl: string,
  locale: Locale
): Promise<OcriaNano> {
  const m = workerMsg(locale);
  await ensureWasm(locale);

  if (activeOcria && activeProfile === profileId) {
    return activeOcria;
  }

  if (activeOcria) {
    activeOcria.free();
    activeOcria = null;
    activeProfile = null;
  }

  const profile =
    MODEL_PROFILES.find((p) => p.id === profileId) ?? MODEL_PROFILES[0];

  const localProbe = await probeLocalModels(originUrl);
  const useLocal = localProbe.available;
  const baseUrl = useLocal ? `${originUrl}/models/ocria-nano` : HF_BASE_URL;

  const detectedOrigin: ModelOrigin = useLocal
    ? localProbe.header === "local-installed"
      ? "local-installed"
      : "embedded-public"
    : "huggingface-cdn";

  const expectedFileCount =
    3 + // det.onnx, det.meta.json, router.onnx
    profile.scripts.length * 2 +
    (profile.scripts.includes("rtl") ? 1 : 0) +
    (profile.layout ? 1 : 0);

  let completedFiles = 0;
  let allFromCache = !useLocal;

  const cache =
    !useLocal && typeof caches !== "undefined"
      ? await caches.open(CACHE_NAME).catch(() => null)
      : null;

  const instrumentedFetch: typeof fetch = async (input, init) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const isModelRequest =
      urlStr.startsWith(baseUrl) || urlStr.startsWith(HF_BASE_URL);

    if (!isModelRequest) {
      return rawFetch(input, init);
    }

    const fileName = urlStr.split("/").pop() || "model";

    if (cache) {
      const cached = await cache.match(urlStr);
      if (cached) {
        completedFiles++;
        const pct = Math.min(
          92,
          10 + Math.round((completedFiles / expectedFileCount) * 80)
        );
        post({
          type: "status",
          phase: "downloading",
          message: m.restoring(fileName, completedFiles, expectedFileCount),
          progress: pct,
          currentFile: fileName,
        });
        return cached;
      }
    }

    allFromCache = false;
    post({
      type: "status",
      phase: "downloading",
      message: useLocal
        ? m.loadingLocal(fileName, completedFiles + 1, expectedFileCount)
        : m.downloading(fileName, completedFiles + 1, expectedFileCount),
      progress: Math.min(
        90,
        10 + Math.round((completedFiles / expectedFileCount) * 80)
      ),
      currentFile: fileName,
    });

    const response = await rawFetch(input, init);
    if (!response.ok) {
      return response;
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (!response.body) {
      completedFiles++;
      return response;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        const fileFraction =
          contentLength > 0 ? Math.min(1, received / contentLength) : 0.5;
        const pct = Math.min(
          92,
          10 +
            Math.round(
              ((completedFiles + fileFraction) / expectedFileCount) * 80
            )
        );
        const mb = (received / 1024 / 1024).toFixed(1);
        post({
          type: "status",
          phase: "downloading",
          message: useLocal
            ? m.streamingLocal(fileName, mb)
            : m.streamingRemote(fileName, mb),
          progress: pct,
          currentFile: fileName,
        });
      }
    }

    const combined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    completedFiles++;

    const headers = new Headers(response.headers);
    headers.set("content-length", String(combined.byteLength));
    const reconstructed = new Response(combined.buffer, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    if (cache) {
      await cache.put(urlStr, reconstructed.clone()).catch(() => {});
    }

    return reconstructed;
  };

  const t0 = performance.now();
  self.fetch = instrumentedFetch;
  try {
    post({
      type: "status",
      phase: "downloading",
      message: useLocal ? m.loadingWeightsLocal : m.loadingWeightsRemote,
      progress: 10,
    });

    const ocria = await OcriaNano.fromUrl({
      baseUrl,
      scripts: profile.scripts,
      layout: profile.layout,
      verify: true,
    });

    post({
      type: "status",
      phase: "compiling",
      message: m.compiling,
      progress: 96,
    });

    activeOcria = ocria;
    activeProfile = profileId;
    activeModelOrigin =
      allFromCache && !useLocal ? "browser-cache" : detectedOrigin;

    post({
      type: "ready",
      profile: profileId,
      modelOrigin: activeModelOrigin,
      hasLayoutModel: ocria.hasLayoutModel,
      loadDurationMs: Math.round(performance.now() - t0),
    });

    return ocria;
  } finally {
    self.fetch = rawFetch;
  }
}

function buildPlainText(result: ParseResult): string {
  const joined = result.pages
    .map((p) => p.text?.trim() || "")
    .filter(Boolean)
    .join("\n\n---\n\n");
  return joined || result.text || "";
}

function buildMarkdown(result: ParseResult): string {
  if (result.text && result.text.trim().length > 0) {
    return result.text;
  }
  return result.pages
    .map((p) => p.markdown?.trim() || p.text?.trim() || "")
    .filter(Boolean)
    .join("\n\n---\n\n");
}

function buildStructuredJson(result: ParseResult): string {
  const payload = {
    totalPages: result.totalPages,
    creator: result.creator ?? null,
    producer: result.producer ?? null,
    pages: result.pages.map((p) => ({
      pageNum: p.pageNum,
      width: p.width,
      height: p.height,
      complexity: p.complexity ?? null,
      text: p.text,
      markdown: p.markdown,
      blocks: p.blocks ?? [],
      textItems: p.textItems,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  const m = workerMsg(req.locale);

  try {
    const ocria = await loadOcriaProfile(
      req.profile,
      req.originUrl,
      req.locale
    );
    const pdfBytes = new Uint8Array(req.pdfBuffer);
    const convertedBytesLen = req.wasImageConverted
      ? pdfBytes.byteLength
      : null;

    let parser: LiteParse | null = null;
    let ocrPageCount = 0;

    const t0 = performance.now();

    try {
      post({
        type: "status",
        phase: "parsing",
        message: m.analyzing(req.fileName),
        progress: 25,
      });

      parser = LiteParse.withOcriaNano(
        {
          ocrEnabled: req.options.ocrEnabled,
          dpi: req.options.dpi,
          outputFormat:
            req.options.outputFormat === "text" ? "text" : "markdown",
          extractBlocks: req.options.extractBlocks,
          keepHeadersFooters: req.options.keepHeadersFooters,
          includeComplexity: true,
          targetPages: req.options.targetPages.trim() || undefined,
          quiet: true,
          onOcrPage(page) {
            ocrPageCount++;
            post({
              type: "status",
              phase: "parsing",
              message: m.recognizedPage(page.pageNum, page.textItems.length),
              progress: 65,
            });
          },
        },
        ocria
      );

      const result = await parser.parse(pdfBytes);
      const durationMs = Math.round(performance.now() - t0);

      const markdown =
        req.options.outputFormat === "markdown"
          ? buildMarkdown(result)
          : result.pages
              .map((p) => p.markdown?.trim() || p.text?.trim() || "")
              .filter(Boolean)
              .join("\n\n---\n\n");

      const plainText =
        req.options.outputFormat === "text"
          ? result.text || buildPlainText(result)
          : buildPlainText(result);

      const structuredJson = buildStructuredJson(result);

      post({
        type: "status",
        phase: "purging",
        message: m.purging,
        progress: 98,
      });

      pdfBytes.fill(0);
      parser.free();
      parser = null;

      const output: DocumentParseOutput = {
        fileName: req.fileName,
        fileMime: req.fileMime,
        wasImageConverted: req.wasImageConverted,
        selectedFormat: req.options.outputFormat,
        totalPages: result.totalPages,
        durationMs,
        ocrUsed:
          ocrPageCount > 0 ||
          result.pages.some((p) => p.complexity?.needsOcr),
        modelProfile: req.profile,
        modelOrigin: activeModelOrigin,
        hasLayoutModel: ocria.hasLayoutModel,
        markdown,
        plainText,
        structuredJson,
        pages: result.pages.map((p) => ({
          pageNum: p.pageNum,
          width: p.width,
          height: p.height,
          text: p.text,
          markdown: p.markdown,
          textItems: p.textItems,
          blocks: p.blocks,
          complexity: p.complexity,
        })),
        purgeAudit: {
          originalSizeBytes: req.originalSizeBytes,
          convertedPdfBytes: convertedBytesLen,
          transferredToWorker: true,
          bufferZeroed: true,
          wasmFreed: true,
          retainedBytes: 0,
          purgedAtIso: new Date().toISOString(),
        },
      };

      post({
        type: "result",
        id: req.id,
        output,
      });
    } finally {
      pdfBytes.fill(0);
      if (parser) {
        parser.free();
      }
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : String(err || m.unknownError);
    post({
      type: "error",
      id: req.id,
      message,
    });
  }
};

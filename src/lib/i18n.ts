import type { Locale, ModelOrigin, ModelProfileId } from "../types/ocr";

export interface Translations {
  langAttr: string;
  languageSwitchLabel: string;
  sidebarAria: string;
  outputFormatLabel: string;
  formats: {
    markdown: string;
    json: string;
    text: string;
  };
  profileLabel: string;
  profiles: Record<ModelProfileId, { label: string; description: string }>;
  parsingOptionsLabel: string;
  renderDpiLabel: string;
  dpiOptions: {
    150: string;
    200: string;
    250: string;
    300: string;
  };
  targetPagesLabel: string;
  targetPagesPlaceholder: string;
  enableOcrLabel: string;
  extractBlocksLabel: string;
  keepHeadersFootersLabel: string;
  mainTitle: string;
  dropzoneAria: string;
  dropzoneBusy: string;
  dropzoneIdle: string;
  errorTitle: string;
  unsupportedFile: (fileName: string) => string;
  workerCrashed: string;
  readingPdf: (fileName: string) => string;
  rasterizingImage: (fileName: string) => string;
  statusReady: string;
  statusModelReady: (ms: number) => string;
  statusParsedWiped: string;
  statusError: string;
  backToTop: string;
  output: {
    ariaLabel: string;
    pageSingular: string;
    pagePlural: string;
    textSpans: string;
    nativeTextEngine: string;
    tabs: {
      markdown: string;
      rawMd: string;
      json: string;
      plainText: string;
      blocks: (count: number) => string;
    };
    copyTitle: string;
    copiedTitle: string;
    downloadTitle: (ext: string) => string;
    clearTitle: string;
    noCharacters: string;
    emptyMarkdown: string;
    emptyPlainText: string;
    pageHeading: (num: number) => string;
    textItemsCount: (count: number) => string;
    noBlocksBefore: string;
    noBlocksStrong: string;
    noBlocksAfter: string;
    lastRun: string;
    origins: Record<ModelOrigin, string>;
  };
}

export const TRANSLATIONS: Record<Locale, Translations> = {
  en: {
    langAttr: "en",
    languageSwitchLabel: "Language",
    sidebarAria: "Parser configuration",
    outputFormatLabel: "Output Format",
    formats: {
      markdown: "Markdown",
      json: "JSON",
      text: "Plain Text",
    },
    profileLabel: "OCRia-nano-1 Profile",
    profiles: {
      full: {
        label: "Full Multilingual + LayoutNet",
        description: "Latin, CJK, RTL, World scripts + table & layout recovery",
      },
      "latin-layout": {
        label: "Latin + LayoutNet",
        description: "Latin OCR + learned table & document structure",
      },
      "latin-lite": {
        label: "Ultra-Light Latin",
        description: "Fastest download: detector, router, and Latin recognizer",
      },
    },
    parsingOptionsLabel: "Parsing Options",
    renderDpiLabel: "Render DPI",
    dpiOptions: {
      150: "150 DPI — Fastest",
      200: "200 DPI — Balanced",
      250: "250 DPI — Recommended (OCRia-nano)",
      300: "300 DPI — Dense / small print",
    },
    targetPagesLabel: "Target Pages (PDF)",
    targetPagesPlaceholder: "All pages (e.g. 1-3, 5)",
    enableOcrLabel: "Enable OCRia-nano-1 for scans & images",
    extractBlocksLabel: "Extract classified layout blocks & cell boxes",
    keepHeadersFootersLabel: "Keep running headers & footers",
    mainTitle: "Document & Image Recognition",
    dropzoneAria: "Upload local image or PDF document",
    dropzoneBusy: "Recognizing document locally...",
    dropzoneIdle: "Drop a document, click to browse, or paste",
    errorTitle: "Recognition failed:",
    unsupportedFile: (fileName) =>
      `Unsupported file "${fileName}". Drop a PDF or image (PNG, JPG, WebP, GIF, BMP, SVG). Office files (.docx/.xlsx/.pptx) require server-side LibreOffice.`,
    workerCrashed: "Web Worker crashed unexpectedly.",
    readingPdf: (fileName) => `Reading ${fileName} into transient memory...`,
    rasterizingImage: (fileName) =>
      `Rasterizing ${fileName} into ephemeral 1:1 DPI PDF...`,
    statusReady: "Ready",
    statusModelReady: (ms) => `OCRia-nano-1 ready (${ms} ms)`,
    statusParsedWiped: "Parsed & source bytes wiped",
    statusError: "Error",
    backToTop: "Back to top",
    output: {
      ariaLabel: "Recognition output",
      pageSingular: "page",
      pagePlural: "pages",
      textSpans: "text spans",
      nativeTextEngine: "PDFium native text",
      tabs: {
        markdown: "Markdown",
        rawMd: "Raw .md",
        json: "JSON",
        plainText: "Plain Text",
        blocks: (count) => `Blocks (${count})`,
      },
      copyTitle: "Copy to clipboard",
      copiedTitle: "Copied",
      downloadTitle: (ext) => `Download .${ext}`,
      clearTitle: "Clear extracted output from view",
      noCharacters: "No characters were recognized on this document.",
      emptyMarkdown: "(empty markdown output)",
      emptyPlainText: "(empty plain text output)",
      pageHeading: (num) => `Page ${num}`,
      textItemsCount: (count) => `${count} text items`,
      noBlocksBefore: "Layout blocks were not emitted for this page. Enable ",
      noBlocksStrong: "Extract classified layout blocks",
      noBlocksAfter:
        " in the sidebar or inspect the JSON tab for raw text bounding boxes.",
      lastRun: "last run",
      origins: {
        "embedded-public": "Embedded static weights",
        "local-installed": "Local disk weights",
        "browser-cache": "Browser Cache API",
        "huggingface-cdn": "Hugging Face (SHA-256 verified)",
        unloaded: "Not loaded",
      },
    },
  },
  pt: {
    langAttr: "pt-BR",
    languageSwitchLabel: "Idioma",
    sidebarAria: "Configurações do reconhecedor",
    outputFormatLabel: "Formato de Saída",
    formats: {
      markdown: "Markdown",
      json: "JSON",
      text: "Texto Simples",
    },
    profileLabel: "Perfil OCRia-nano-1",
    profiles: {
      full: {
        label: "Multilíngue Completo + LayoutNet",
        description:
          "Escritas Latina, CJK, RTL e Mundiais + recuperação de tabelas e layout",
      },
      "latin-layout": {
        label: "Latim + LayoutNet",
        description: "OCR latino + reconhecimento de tabelas e estrutura",
      },
      "latin-lite": {
        label: "Latim Ultraleve",
        description: "Download mais rápido: detector, roteador e reconhecedor latino",
      },
    },
    parsingOptionsLabel: "Opções de Leitura",
    renderDpiLabel: "Resolução (DPI)",
    dpiOptions: {
      150: "150 DPI — Mais rápido",
      200: "200 DPI — Equilibrado",
      250: "250 DPI — Recomendado (OCRia-nano)",
      300: "300 DPI — Texto denso / pequeno",
    },
    targetPagesLabel: "Páginas Específicas (PDF)",
    targetPagesPlaceholder: "Todas as páginas (ex.: 1-3, 5)",
    enableOcrLabel: "Ativar OCRia-nano-1 para digitalizações e imagens",
    extractBlocksLabel: "Extrair blocos de layout e células de tabela",
    keepHeadersFootersLabel: "Manter cabeçalhos e rodapés repetidos",
    mainTitle: "Reconhecimento de Documentos e Imagens",
    dropzoneAria: "Enviar imagem ou documento PDF local",
    dropzoneBusy: "Reconhecendo documento localmente...",
    dropzoneIdle: "Arraste um documento, clique para escolher ou cole",
    errorTitle: "Falha no reconhecimento:",
    unsupportedFile: (fileName) =>
      `Arquivo não suportado "${fileName}". Envie um PDF ou imagem (PNG, JPG, WebP, GIF, BMP, SVG). Arquivos do Office (.docx/.xlsx/.pptx) exigem LibreOffice em servidor.`,
    workerCrashed: "O Web Worker foi encerrado inesperadamente.",
    readingPdf: (fileName) => `Lendo ${fileName} na memória temporária...`,
    rasterizingImage: (fileName) =>
      `Convertendo ${fileName} em PDF temporário (DPI 1:1)...`,
    statusReady: "Pronto",
    statusModelReady: (ms) => `OCRia-nano-1 pronto (${ms} ms)`,
    statusParsedWiped: "Processado e bytes originais limpos",
    statusError: "Erro",
    backToTop: "Voltar ao topo",
    output: {
      ariaLabel: "Resultado do reconhecimento",
      pageSingular: "página",
      pagePlural: "páginas",
      textSpans: "trechos de texto",
      nativeTextEngine: "Texto nativo PDFium",
      tabs: {
        markdown: "Markdown",
        rawMd: "Bruto .md",
        json: "JSON",
        plainText: "Texto Simples",
        blocks: (count) => `Blocos (${count})`,
      },
      copyTitle: "Copiar para a área de transferência",
      copiedTitle: "Copiado",
      downloadTitle: (ext) => `Baixar .${ext}`,
      clearTitle: "Limpar resultado extraído da tela",
      noCharacters: "Nenhum caractere foi reconhecido neste documento.",
      emptyMarkdown: "(saída markdown vazia)",
      emptyPlainText: "(saída de texto simples vazia)",
      pageHeading: (num) => `Página ${num}`,
      textItemsCount: (count) => `${count} itens de texto`,
      noBlocksBefore: "Nenhum bloco de layout foi gerado para esta página. Ative ",
      noBlocksStrong: "Extrair blocos de layout e células de tabela",
      noBlocksAfter:
        " na barra lateral ou verifique a aba JSON para as caixas delimitadoras.",
      lastRun: "última execução",
      origins: {
        "embedded-public": "Pesos estáticos embarcados",
        "local-installed": "Pesos locais em disco",
        "browser-cache": "Cache API do navegador",
        "huggingface-cdn": "Hugging Face (SHA-256 verificado)",
        unloaded: "Não carregado",
      },
    },
  },
};

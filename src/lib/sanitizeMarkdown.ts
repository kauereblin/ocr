import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Renders Markdown to HTML and strips potentially dangerous tags/attributes
 * using the browser's own DOMParser so untrusted OCR output is safe to render.
 */
export function renderSafeMarkdown(markdown: string): string {
  const rawHtml = marked.parse(markdown || "", { async: false }) as string;

  if (typeof DOMParser === "undefined") {
    return rawHtml;
  }

  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const blockedTags = ["script", "iframe", "object", "embed", "style", "form"];

  for (const tag of blockedTags) {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  }

  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = attr.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        ((name === "href" || name === "src") && val.startsWith("javascript:"))
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return doc.body.innerHTML;
}

/**
 * Pure client-side image-to-PDF 1.4 encoder.
 *
 * `@llamaindex/liteparse-wasm` accepts PDF bytes natively. To support every
 * browser-decodable image format (PNG, JPEG, WebP, GIF, BMP, SVG) without
 * sending data to a server, we render the image onto an ephemeral in-memory
 * canvas (compositing alpha onto white paper) and wrap the resulting high-quality
 * JPEG stream inside a minimal, spec-compliant single-page PDF 1.4 document.
 *
 * The MediaBox is calibrated to `targetDpi` so when LiteParse renders the page
 * for OCRia-nano-1, pixel resolution matches the source image 1:1.
 */

const MAX_EDGE_PX = 2800;
const MIN_EDGE_PX = 900;

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/**
 * Wraps raw baseline JPEG bytes into a single-page PDF 1.4 buffer.
 */
export function wrapJpegInPdf(
  jpegBytes: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
  targetDpi: number
): Uint8Array {
  // Calibrate PDF page points (72 pt/inch) so rendering at targetDpi produces
  // a crisp 1:1 raster for OCRia-nano-1.
  const dpi = Math.max(72, targetDpi);
  const pageWidthPt = Number(((pixelWidth * 72) / dpi).toFixed(2));
  const pageHeightPt = Number(((pixelHeight * 72) / dpi).toFixed(2));

  const contentStream = `q\n${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = asciiBytes(contentStream);

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // object 0 is the free head entry
  let cursor = 0;

  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    cursor += bytes.length;
  };

  const pushAscii = (str: string) => push(asciiBytes(str));

  const beginObj = (objNum: number) => {
    offsets[objNum] = cursor;
    pushAscii(`${objNum} 0 obj\n`);
  };

  // Header (with binary comment bytes >= 0x80 per PDF spec)
  push(
    new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3,
      0xcf, 0xd3, 0x0a,
    ])
  );

  // 1: Catalog
  beginObj(1);
  pushAscii("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // 2: Pages
  beginObj(2);
  pushAscii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // 3: Page
  beginObj(3);
  pushAscii(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // 4: Image XObject (DCTDecode = JPEG)
  beginObj(4);
  pushAscii(
    `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  push(jpegBytes);
  pushAscii("\nendstream\nendobj\n");

  // 5: Page Content Stream
  beginObj(5);
  pushAscii(`<< /Length ${contentBytes.length} >>\nstream\n`);
  push(contentBytes);
  pushAscii("endstream\nendobj\n");

  // Cross-reference table
  const xrefOffset = cursor;
  pushAscii(`xref\n0 ${offsets.length}\n`);
  pushAscii("0000000000 65535 f \n");
  for (let i = 1; i < offsets.length; i++) {
    const off = String(offsets[i]).padStart(10, "0");
    pushAscii(`${off} 00000 n \n`);
  }

  // Trailer
  pushAscii(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return concatUint8Arrays(chunks);
}

/**
 * Loads an image File/Blob via HTMLImageElement (works for SVG, PNG, JPEG,
 * WebP, GIF, BMP), paints onto a temporary white-backed canvas, encodes a
 * high-quality JPEG, wraps it in a PDF 1.4 buffer, and immediately destroys
 * the temporary object URL and canvas backing store.
 */
export async function convertImageFileToPdf(
  file: File,
  targetDpi = 250
): Promise<{ pdfBuffer: ArrayBuffer; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error(`Unable to decode image file "${file.name}".`));
      el.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (!width || !height) {
      throw new Error("Image has zero dimensions and cannot be rasterized.");
    }

    // Clamp overly large photos to stay fast in WASM, and gently upscale very
    // small screenshots so small glyphs remain legible to OCRia-nano-1.
    const longest = Math.max(width, height);
    if (longest > MAX_EDGE_PX) {
      const scale = MAX_EDGE_PX / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    } else if (longest < MIN_EDGE_PX && longest > 0) {
      const scale = Math.min(2, MIN_EDGE_PX / longest);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error(
        "Could not acquire 2D canvas context for image conversion."
      );
    }

    // Fill crisp white paper background so transparent PNGs/SVGs have clean contrast
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to encode image to JPEG stream."));
        },
        "image/jpeg",
        0.96
      );
    });

    // Release canvas backing pixels immediately
    canvas.width = 0;
    canvas.height = 0;

    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const pdfBytes = wrapJpegInPdf(jpegBytes, width, height, targetDpi);
    jpegBytes.fill(0);

    return {
      pdfBuffer: pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
      ) as ArrayBuffer,
      width,
      height,
    };
  } finally {
    // Instantaneously revoke temporary object URL
    URL.revokeObjectURL(objectUrl);
  }
}

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const REQUIRED_FILES = [
  "det.onnx",
  "det.meta.json",
  "router.onnx",
  "rec_latin.onnx",
  "rec_latin.charset.json",
  "rec_cjk.onnx",
  "rec_cjk.charset.json",
  "rec_rtl.onnx",
  "rec_rtl.charset.json",
  "rec_rtl.meta.json",
  "rec_world.onnx",
  "rec_world.charset.json",
  "tablenet.bin",
];

function findSourceDir() {
  const candidates = [
    process.argv[2],
    process.env.LITEPARSE_MODEL_DIR
      ? path.join(process.env.LITEPARSE_MODEL_DIR, "ocria-nano")
      : null,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "liteparse", "models", "ocria-nano")
      : null,
    path.join(os.homedir(), ".cache", "liteparse", "models", "ocria-nano"),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "det.onnx"))) {
      return dir;
    }
  }
  return null;
}

const srcDir = findSourceDir();
if (!srcDir) {
  console.error(
    "Could not locate local ocria-nano models. Run `lit models pull ocria-nano` or pass the model directory path as an argument."
  );
  process.exit(1);
}

const destDir = path.resolve(process.cwd(), "public", "models", "ocria-nano");
fs.mkdirSync(destDir, { recursive: true });

let totalBytes = 0;
let copiedCount = 0;

for (const file of REQUIRED_FILES) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const size = fs.statSync(dest).size;
    totalBytes += size;
    copiedCount++;
    console.log(`  copied ${file} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }
}

console.log(
  `\nEmbedded ${copiedCount} model files (${(totalBytes / 1024 / 1024).toFixed(2)} MB) into ${destDir}`
);

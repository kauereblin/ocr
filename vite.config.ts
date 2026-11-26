import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { IncomingMessage, ServerResponse } from "node:http";

function getLocalOcriaModelDir(): string | null {
  const candidates: string[] = [];
  if (process.env.LITEPARSE_MODEL_DIR) {
    candidates.push(path.join(process.env.LITEPARSE_MODEL_DIR, "ocria-nano"));
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(
      path.join(process.env.LOCALAPPDATA, "liteparse", "models", "ocria-nano")
    );
  }
  candidates.push(
    path.join(os.homedir(), ".cache", "liteparse", "models", "ocria-nano")
  );

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, "det.onnx"))) {
        return dir;
      }
    } catch {
      // Ignore inaccessible directories
    }
  }
  return null;
}

/**
 * Serves embedded models from `public/models/ocria-nano/` first, and during
 * local development falls back to the machine's locally installed LiteParse
 * model directory (e.g. `%LOCALAPPDATA%\liteparse\models\ocria-nano`).
 */
function localOcriaModelsPlugin() {
  const publicDir = path.resolve(process.cwd(), "public", "models", "ocria-nano");

  return {
    name: "local-ocria-models",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/models/ocria-nano",
        (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const cleanUrl = (req.url || "/").split("?")[0];
        const filename = path.basename(cleanUrl);
        if (!filename || filename === "/" || filename.includes("..")) {
          next();
          return;
        }

        const publicPath = path.join(publicDir, filename);
        const localDir = getLocalOcriaModelDir();
        const resolved = fs.existsSync(publicPath)
          ? publicPath
          : localDir && fs.existsSync(path.join(localDir, filename))
            ? path.join(localDir, filename)
            : null;

        if (!resolved) {
          res.statusCode = 404;
          res.end("Model file not found locally");
          return;
        }

        const stat = fs.statSync(resolved);
        const ext = path.extname(resolved);
        const contentType =
          ext === ".json"
            ? "application/json"
            : "application/octet-stream";

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", String(stat.size));
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader(
          "X-Ocria-Model-Source",
          resolved === publicPath ? "embedded-public" : "local-installed"
        );

        if (req.method === "HEAD") {
          res.statusCode = 200;
          res.end();
          return;
        }

        fs.createReadStream(resolved).pipe(res);
      });
    },
  };
}

export default defineConfig({
  cacheDir: ".vite-cache",
  plugins: [react(), localOcriaModelsPlugin()],
  optimizeDeps: {
    exclude: ["@llamaindex/liteparse-wasm"],
  },
  worker: {
    format: "es",
  },
  assetsInclude: ["**/*.wasm"],
});

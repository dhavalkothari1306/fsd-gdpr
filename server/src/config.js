import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));

// server/.env, falling back to a repo-root .env (as the FastAPI version used)
dotenv.config({ path: path.resolve(here, "../.env") });
dotenv.config({ path: path.resolve(here, "../../.env") });

const int = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const config = {
  port: int(process.env.PORT, 8000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gdpr_analyzer",
  // Repo root: where gdpr_analyzer.py, modules/ and analyzer/ live.
  analyzerRoot: path.resolve(process.env.ANALYZER_ROOT || path.join(here, "../..")),
  pythonBin: process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3"),
  scanTimeoutMs: int(process.env.SCAN_TIMEOUT_MS, 180_000),
  maxConcurrentScans: int(process.env.MAX_CONCURRENT_SCANS, 2),
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

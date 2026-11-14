import { spawn, spawnSync } from "node:child_process";
import { config } from "../config.js";

const MAX_STDOUT_BYTES = 20 * 1024 * 1024;
const MAX_STDERR_BYTES = 16 * 1024;

/** Error carrying the HTTP status the API should answer with. */
export class AnalyzerError extends Error {
  constructor(message, { status = 500, kind = "scan", stderr = "" } = {}) {
    super(message);
    this.name = "AnalyzerError";
    this.status = status;
    this.kind = kind;
    this.stderr = stderr;
  }
}

function killTree(child) {
  if (!child.pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    } else {
      process.kill(-child.pid, "SIGKILL"); // whole group: python + firefox + geckodriver
    }
  } catch {
    child.kill("SIGKILL");
  }
}

/**
 * Run `python -m analyzer.cli <args>` and resolve with the parsed JSON payload.
 * The CLI prints exactly one JSON document on stdout (see analyzer/cli.py).
 */
export function runAnalyzer(args, { stdin, timeoutMs = config.scanTimeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.pythonBin, ["-m", "analyzer.cli", ...args], {
      cwd: config.analyzerRoot,
      env: {
        ...process.env,
        PYTHONPATH: config.analyzerRoot,
        PYTHONUNBUFFERED: "1",
        PYTHONIOENCODING: "utf-8",
      },
      detached: process.platform !== "win32",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let overflow = false;
    let timedOut = false;
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > MAX_STDOUT_BYTES) {
        overflow = true;
        killTree(child);
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-MAX_STDERR_BYTES);
    });

    child.on("error", (err) => {
      finish(
        reject,
        new AnalyzerError(
          `Could not start the Python analyzer (${config.pythonBin}): ${err.message}. ` +
            "Set PYTHON_BIN in server/.env.",
          { kind: "spawn", stderr }
        )
      );
    });

    child.on("close", (code) => {
      if (timedOut) {
        return finish(
          reject,
          new AnalyzerError(`Analyzer timed out after ${Math.round(timeoutMs / 1000)}s.`, {
            kind: "timeout",
            stderr,
          })
        );
      }
      if (overflow) {
        return finish(reject, new AnalyzerError("Analyzer output was too large.", { stderr }));
      }

      const lastLine = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
      let payload;
      try {
        payload = JSON.parse(lastLine);
      } catch {
        return finish(
          reject,
          new AnalyzerError(`Analyzer exited with code ${code} and no valid output.`, { stderr })
        );
      }

      if (payload.ok) return finish(resolve, payload);

      if (payload.kind === "validation") {
        return finish(
          reject,
          new AnalyzerError(payload.error, { status: 400, kind: "validation", stderr })
        );
      }
      finish(
        reject,
        new AnalyzerError(payload.error || "Analyzer failed.", { kind: payload.kind, stderr })
      );
    });

    child.stdin.on("error", () => {}); // process may exit before reading stdin
    child.stdin.end(stdin ?? "");
  });
}

export const validateTarget = async (value) => (await runAnalyzer(["validate", value], { timeoutMs: 15_000 })).target;
export const scanTarget = async (target) => (await runAnalyzer(["scan", target])).result;
export const buildPdf = (label, resultJson, outPath) =>
  runAnalyzer(["report", label, outPath], { stdin: resultJson, timeoutMs: 60_000 });

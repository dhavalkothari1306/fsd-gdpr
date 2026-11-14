import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Router } from "express";

import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { Scan, nextScanId, toScanRead } from "../models/Scan.js";
import { buildPdf, scanTarget, validateTarget } from "../services/analyzer.js";

export const scansRouter = Router();

let activeScans = 0;

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, "Scan not found.");
  return id;
}

async function findScan(rawId) {
  const scan = await Scan.findById(parseId(rawId)).lean();
  if (!scan) throw new HttpError(404, "Scan not found.");
  return scan;
}

// POST /api/scans — validate, run the Python engine, persist
scansRouter.post("/", async (req, res) => {
  const value = req.body?.target;
  if (typeof value !== "string" || value.length < 4 || value.length > 2048) {
    throw new HttpError(422, "target must be a string of 4 to 2048 characters.");
  }

  const target = await validateTarget(value); // AnalyzerError(400) on bad/private URLs

  if (activeScans >= config.maxConcurrentScans) {
    throw new HttpError(429, "Too many scans are running. Try again shortly.");
  }

  const scan = await Scan.create({ _id: await nextScanId(), target, status: "running" });

  activeScans += 1;
  try {
    const result = await scanTarget(target);
    scan.status = "completed";
    scan.grade = result.grade ?? null;
    scan.resultJson = JSON.stringify(result);
    await scan.save();
  } catch (err) {
    console.error(`Scan ${scan._id} failed:`, err.message);
    if (err.stderr) console.error(err.stderr);
    scan.status = "failed";
    scan.error = `${err.name}: ${err.message}`;
    await scan.save();
    throw new HttpError(
      500,
      `Scan ${scan._id} failed. Check the API terminal for the full error.`
    );
  } finally {
    activeScans -= 1;
  }

  res.status(201).json(toScanRead(scan.toObject()));
});

// GET /api/scans — latest 50, without the heavy result payload
scansRouter.get("/", async (_req, res) => {
  const scans = await Scan.find({}, { resultJson: 0, error: 0 })
    .sort({ created_at: -1 })
    .limit(50)
    .lean();
  res.json(scans.map((s) => toScanRead(s, { withResult: false })));
});

scansRouter.get("/:id", async (req, res) => {
  res.json(toScanRead(await findScan(req.params.id)));
});

scansRouter.get("/:id/report.json", async (req, res) => {
  const scan = await findScan(req.params.id);
  if (!scan.resultJson) throw new HttpError(404, "No report is available for this scan");

  res.set({
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="gdpr-scan-${scan._id}.json"`,
  });
  res.send(JSON.stringify(JSON.parse(scan.resultJson), null, 2));
});

scansRouter.get("/:id/report.pdf", async (req, res) => {
  const scan = await findScan(req.params.id);
  if (!scan.resultJson) throw new HttpError(404, "No report is available for this scan");

  // The PDF is still produced by the Python report module (ReportLab).
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gdpr-report-"));
  const pdfPath = path.join(dir, "report.pdf");
  try {
    await buildPdf(`scan_${scan._id}`, scan.resultJson, pdfPath);
    const pdf = await fs.readFile(pdfPath);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gdpr-scan-${scan._id}.pdf"`,
    });
    res.send(pdf);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

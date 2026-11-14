import mongoose from "mongoose";

/**
 * Atomic counter so scans keep the same small sequential ids ("Scan #7")
 * the SQL version had, instead of 24-char ObjectIds in the UI and URLs.
 */
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);

export async function nextScanId() {
  const doc = await Counter.findByIdAndUpdate(
    "scans",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

const scanSchema = new mongoose.Schema(
  {
    _id: Number,
    target: { type: String, required: true, maxlength: 2048 },
    status: { type: String, enum: ["running", "completed", "failed"], default: "running" },
    grade: { type: String, maxlength: 2, default: null },
    /**
     * The analyzer result, stored as a JSON string. Cookie names are used as
     * object keys inside the result and may contain "." or start with "$",
     * which MongoDB field names handle poorly. A string round-trips losslessly.
     */
    resultJson: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false }, versionKey: false }
);

scanSchema.index({ created_at: -1 });

export const Scan = mongoose.models.Scan || mongoose.model("Scan", scanSchema);

/** Same JSON shape the FastAPI `ScanRead` / `ScanHistoryItem` schemas produced. */
export function toScanRead(scan, { withResult = true } = {}) {
  const out = {
    id: scan._id,
    target: scan.target,
    created_at: scan.created_at,
    status: scan.status,
    grade: scan.grade ?? null,
  };
  if (withResult) {
    out.result = scan.resultJson ? JSON.parse(scan.resultJson) : null;
    out.error = scan.error ?? null;
  }
  return out;
}

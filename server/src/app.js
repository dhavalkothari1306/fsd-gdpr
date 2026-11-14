import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { scansRouter } from "./routes/scans.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.corsOrigins, methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
  app.use(express.json({ limit: "16kb" }));

  app.get("/", (_req, res) => res.json({ message: "GDPR Analyzer API is running" }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/scans", scansRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

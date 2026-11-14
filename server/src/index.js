import mongoose from "mongoose";

import { createApp } from "./app.js";
import { config } from "./config.js";

try {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log("MongoDB connected");
} catch (err) {
  console.error(`Could not connect to MongoDB at ${config.mongoUri}: ${err.message}`);
  process.exit(1);
}

const server = createApp().listen(config.port, () => {
  console.log(`GDPR Analyzer API listening on http://127.0.0.1:${config.port}`);
});

// Scans can run for minutes; don't let Node's default request timeout cut them off.
server.requestTimeout = 0;
server.headersTimeout = 65_000;

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => mongoose.disconnect().then(() => process.exit(0))));
}

export class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
  }
}

export function notFound(_req, res) {
  res.status(404).json({ detail: "Not Found" });
}

// Errors keep FastAPI's `{ "detail": ... }` shape so the React client is unchanged.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err.type === "entity.parse.failed") {
    return res.status(422).json({ detail: "Request body must be valid JSON." });
  }
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    detail: status === 500 && !(err instanceof HttpError) ? "Internal server error." : err.message,
  });
}

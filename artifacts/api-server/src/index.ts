import app from "./app";
import { logger } from "./lib/logger";

// Validate production environment variables at startup
if (process.env.NODE_ENV === "production") {
  const missing: string[] = [];
  if (!process.env.ALLOWED_ORIGINS) {
    missing.push("ALLOWED_ORIGINS (comma-separated list of allowed frontend origins for CORS)");
  }
  if (!process.env.SMTP_HOST) {
    logger.warn("SMTP_HOST not set — email notifications will be silently skipped");
  }
  if (missing.length > 0) {
    logger.warn({ missing }, "Production environment variables not set — CORS may deny all cross-origin requests");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

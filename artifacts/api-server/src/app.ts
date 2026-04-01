import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { randomBytes } from "crypto";

const PgSession = ConnectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Determine allowed origins.
// In production, ALLOWED_ORIGINS must be set explicitly — no wildcard fallback.
// In development, we also permit *.janeway.replit.dev (preview domains) and localhost.
const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS;
const allowedOrigins: string[] = ALLOWED_ORIGINS_ENV
  ? ALLOWED_ORIGINS_ENV.split(",").map((s) => s.trim())
  : [];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    // Allow Replit preview (janeway) domains and localhost only in development
    if (/^https:\/\/[a-z0-9-]+\.janeway\.replit\.dev$/i.test(origin)) return true;
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session secret: require it in production; generate a random one in development (sessions won't survive restarts)
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }
  sessionSecret = randomBytes(32).toString("hex");
  logger.warn("SESSION_SECRET not set — using a random secret. Sessions will be lost on server restart.");
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Both the frontend and API are served from the same Replit domain in
      // all environments (dev preview and production), so same-site "lax" is
      // sufficient and provides CSRF protection for free.
      // sameSite: "none" would require CSRF mitigations; "lax" avoids that.
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use("/api", router);

export default app;

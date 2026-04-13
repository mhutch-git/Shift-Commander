import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { randomBytes } from "crypto";
import path from "path";

const PgSession = ConnectPgSimple(session);

const app: Express = express();

app.set("trust proxy", 1);

// Security headers
// Allow Google Fonts and embedding in Dakboard (iframe).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'", "https://dakboard.com", "https://*.dakboard.com"],
      },
    },
    // Allow iframes from Dakboard; X-Frame-Options is superseded by CSP frame-ancestors
    // but we disable it so older browsers also allow the embed.
    frameguard: false,
  })
);

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
// When ALLOWED_ORIGINS is set, restrict to those origins.
// When not set, reflect any origin back (permissive — suitable for same-origin Railway deployments
// where the frontend is served from this same server and no cross-origin access is intended).
// In development, also permit *.janeway.replit.dev and localhost.
const ALLOWED_ORIGINS_ENV = process.env.ALLOWED_ORIGINS;
const allowedOrigins: string[] = ALLOWED_ORIGINS_ENV
  ? ALLOWED_ORIGINS_ENV.split(",").map((s) => s.trim())
  : [];

if (allowedOrigins.length === 0 && process.env.NODE_ENV === "production") {
  logger.warn("ALLOWED_ORIGINS is not set — all cross-origin requests are permitted. Set this to your frontend URL in production.");
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Same-origin requests have no Origin header
  if (allowedOrigins.length === 0) return true; // No restriction configured — allow all
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    if (/^https:\/\/[a-z0-9-]+\.janeway\.replit\.dev$/i.test(origin)) return true;
    if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  }
  return false;
}

// Apply CORS only to /api routes — static files (CSS, JS, HTML) are same-origin
// and don't need CORS headers. Scoping here prevents CORS from rejecting requests
// with Origin: null (e.g. from sandboxed iframes like Dakboard).

// Public endpoints are token-protected — allow any origin so they work from
// sandboxed iframes (Dakboard) where the page origin becomes "null".
app.use("/api/public", cors({ origin: "*", credentials: false }));

// All other API routes use the configured origin allowlist.
const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
});
app.use("/api", corsMiddleware);

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
    name: "sc.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Rate limit login attempts: 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});
app.use("/api/auth/login", loginLimiter);

// API routes
app.use("/api", router);

// In production, serve the Vite-built frontend as static files and fall back
// to index.html for client-side routing (SPA).
if (process.env.NODE_ENV === "production") {
  const frontendDist =
    process.env.FRONTEND_DIST_PATH ??
    path.resolve(process.cwd(), "artifacts/shift-scheduler/dist/public");

  import("fs").then(({ existsSync, readdirSync }) => {
    const exists = existsSync(frontendDist);
    logger.info({ frontendDist, exists, cwd: process.cwd() }, "Frontend dist path");
    if (exists) {
      try {
        const files = readdirSync(frontendDist);
        logger.info({ files }, "Frontend dist contents");
      } catch (e) {
        logger.warn(e, "Could not read frontend dist");
      }
    }
  });

  app.use(express.static(frontendDist));

  app.get("*splat", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;

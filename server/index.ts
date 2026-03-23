import "dotenv/config";
import { SessionBroadcaster } from "./ws/SessionBroadcaster";
import { appRouter } from "./routers/index";
import { createContext, mixerEngine, djEngine } from "./trpc";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import effectsRouter from './routes/effects';
import waveformRouter from './routes/waveform';
import presetsRouter from './routes/presets';
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import Stripe from "stripe";
import { logger } from "./lib/logger";
// ─── LoopStation routes ───────────────────────────────────────────────────────
import loopRoutes        from './routes/loops';
import loopProjectRoutes from './routes/loopProjects';
import midiRoutes        from './routes/midi';
import { loopStationAuth }         from './middleware/auth';
import { loopStationErrorHandler } from './middleware/errorHandler';
import { loopStationLimiter }      from './middleware/rateLimit';
import { ensureDir }               from './utils/fileUtils';
// ─────────────────────────────────────────────────────────────────────────────

// Stripe is optional — only initialized if STRIPE_SECRET_KEY is set
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-02-25.clover" as const })
  : null;

const app = express();
const httpServer = createServer(app);

// Billing route — only active when Stripe is configured
if (stripe) {
  app.post("/billing/checkout", async (req, res) => {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: req.body.priceId, quantity: 1 }],
      success_url: "https://r3vibe.com/success",
      cancel_url: "https://r3vibe.com/cancel"
    });
    res.json({ url: session.url });
  });
}

// WebSocket server for real-time audio communication
const wss = new WebSocketServer({ 
  server: httpServer,
  path: "/ws/audio"
});

// Extend Express Request type for raw body access
declare module "http" {
  interface IncomingMessage {
    rawBody: Buffer;
  }
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow audio/media loading
  crossOriginEmbedderPolicy: false, // Required for SharedArrayBuffer
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow audio resources
}));

// CORS configuration for development
if (process.env.NODE_ENV === "development") {
  app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
  }));
}

// Compression for responses — cast needed due to @types/compression / express types mismatch
app.use(compression() as unknown as express.RequestHandler);

// Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Body parsing with raw body preservation
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ 
  extended: false,
  limit: "50mb"
}));

// Internal log utility — wraps the structured logger with source tagging
export function log(message: string, source = "express") {
  logger.info(`[${source}] ${message}`);
}

// Log Stripe status
if (!stripe) {
  log("⚠️ STRIPE_SECRET_KEY not set — billing routes disabled", "stripe");
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

  const originalResJson = res.json.bind(res);
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson as Record<string, unknown>;
    return originalResJson(bodyJson, ...args);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// API routes — registered after body parsing and compression
app.use('/api/effects', effectsRouter);
app.use('/api/waveform', waveformRouter);
app.use('/api/presets', presetsRouter);

// WebSocket connection handling
wss.on("connection", (ws, req) => {
  const clientId = req.headers["sec-websocket-key"] || "unknown";
  log(`WebSocket client connected: ${clientId}`, "websocket");

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString()) as { type: string };

      switch (message.type) {
        case "audio-sync":
        case "tempo-change":
        case "effect-update":
        case "recording-status":
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify(message));
            }
          });
          break;
        default:
          log(`Unknown message type: ${message.type}`, "websocket");
      }
    } catch (error) {
      log(`WebSocket error: ${error}`, "websocket");
    }
  });

  ws.on("close", () => {
    log(`WebSocket client disconnected: ${clientId}`, "websocket");
  });

  ws.on("error", (error) => {
    log(`WebSocket error for client ${clientId}: ${error}`, "websocket");
  });

  ws.send(JSON.stringify({ 
    type: "connection-established",
    timestamp: Date.now()
  }));
});

// Health check endpoints
app.get("/health", (_req, res) => {
  res.json({ 
    status: "ok",
    timestamp: Date.now(),
    env: process.env.NODE_ENV,
    websocket: {
      clients: wss.clients.size,
      ready: true
    }
  });
});

app.get("/ready", (_req, res) => {
  res.status(200).json({ status: "ready" });
});

// Initialize server
(async () => {
  try {
        // Ensure loop storage dirs
    try {
      const base = process.env.LOOP_STORAGE_BASE ?? './server/storage';
      await ensureDir(`${base}/loops`);
      await ensureDir(`${base}/projects`);
    } catch(e) { log(`Loop storage init warning: ${e}`, 'loopstation'); }

    await registerRoutes(httpServer, app);

    // Error handling middleware
    app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      const status = (err as { status?: number }).status || (err as { statusCode?: number }).statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error ${status}: ${message}`, "error");

      res.status(status).json({ 
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
      });
    });

    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite-dev");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`🎵 R3VIBE Native Server`);
        log(`📡 Server running on port ${port}`);
        log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
        log(`🔌 WebSocket server ready on ws://localhost:${port}/ws/audio`);
        log(`💾 Database: ${process.env.DATABASE_URL ? "Connected" : "Not configured"}`);
        log(`💳 Stripe: ${stripe ? "Configured" : "Not configured (set STRIPE_SECRET_KEY to enable billing)"}`);
      },
    );
  } catch (error) {
    log(`Failed to start server: ${error}`, "error");
    process.exit(1);
  }
})();

// Graceful shutdown
process.on("SIGTERM", () => {
  log("SIGTERM received, closing server gracefully", "shutdown");
  httpServer.close(() => {
    log("Server closed", "shutdown");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  log("SIGINT received, closing server gracefully", "shutdown");
  httpServer.close(() => {
    log("Server closed", "shutdown");
    process.exit(0);
  });
});

export { app, httpServer, wss };
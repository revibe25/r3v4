import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

const app = express();
const httpServer = createServer(app);

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

// Compression for responses
app.use(compression());

// Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Body parsing with raw body preservation
app.use(
  express.json({
    limit: "50mb", // Increased for audio file uploads
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ 
  extended: false,
  limit: "50mb"
}));

// Custom logger utility
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
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

// WebSocket connection handling
wss.on("connection", (ws, req) => {
  const clientId = req.headers["sec-websocket-key"] || "unknown";
  log(`WebSocket client connected: ${clientId}`, "websocket");

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle different message types
      switch (message.type) {
        case "audio-sync":
          // Broadcast to all other clients for live collaboration
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(JSON.stringify(message));
            }
          });
          break;

        case "tempo-change":
        case "effect-update":
        case "recording-status":
          // Broadcast real-time updates
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

  // Send welcome message
  ws.send(JSON.stringify({ 
    type: "connection-established",
    timestamp: Date.now()
  }));
});

// Health check endpoint
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

// Initialize server
(async () => {
  try {
    // Register API routes
    await registerRoutes(httpServer, app);

    // Error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`Error ${status}: ${message}`, "error");

      res.status(status).json({ 
        error: message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
      });
    });

    // Setup Vite in development or serve static in production
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // Start server
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

// Export for testing
export { app, httpServer, wss };
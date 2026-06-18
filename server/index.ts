import http from 'http';
import { app }            from './app';
import { registerRoutes } from './routes';
import { loopStationErrorHandler } from './middleware/errorHandler';
import { serveStatic }    from './static';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function startServer() {
  const server = http.createServer(app);

  // REST routes + any WebSocket wiring that needs the httpServer
  await registerRoutes(server, app);

  // Static / SPA fallback (production only)
  if (process.env.NODE_ENV === 'production') {
    serveStatic(app);
  }

  // Error handler must be registered after all routes
  app.use(loopStationErrorHandler);

  server.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});

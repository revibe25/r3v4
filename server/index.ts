import http from 'http';
import { app } from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function startServer() {
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});

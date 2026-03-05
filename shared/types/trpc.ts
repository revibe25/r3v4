// Shared type stub — client imports AppRouter from here, not from server/
// This prevents Vite from crawling server-side Node.js modules (drizzle, express, etc.)
// which causes the dev server to hang on page load.
import type { appRouter } from '../../server/routers/index';
export type AppRouter = typeof appRouter;

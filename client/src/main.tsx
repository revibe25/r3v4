import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Global client error handlers ─────────────────────────────────────────────
// React ErrorBoundary catches render errors only.
// These catch promise rejections from the audio engine, Web Workers,
// and async code outside the React component tree (tRPC calls, Tone.js).
// TODO(P1): Replace console.error calls with Sentry.captureException() when wired.
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const reason = event.reason instanceof Error
    ? event.reason.message
    : String(event.reason ?? 'unknown');
  console.error('[R3] Unhandled promise rejection:', reason);
});

window.addEventListener('error', (event: ErrorEvent) => {
  console.error('[R3] Uncaught error:', event.message,
    { file: event.filename, line: event.lineno, col: event.colno });
});

createRoot(document.getElementById("root")!).render(<App />);

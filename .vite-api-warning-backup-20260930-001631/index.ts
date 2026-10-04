// ─── Environment Configuration ────────────────────────────────────────────────

const raw = import.meta.env.VITE_API_URL as string | undefined;

if (!raw || raw.trim() === '') {
  console.warn(
    '[Config] VITE_API_URL is not set. API calls will target the current origin. ' +
    'Set VITE_API_URL in your .env file for production.'
  );
}

export const API_BASE: string = raw?.trim() ?? '';

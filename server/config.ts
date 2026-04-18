const MB = 1024 * 1024;

export const UPLOAD_CONFIG = {
  MAX_UPLOAD_SIZE: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '200', 10) * MB,
  MULTIPART_THRESHOLD: parseInt(process.env.MULTIPART_THRESHOLD_MB || '100', 10) * MB,
  ALLOWED_MIME_TYPES: [
    'audio/wav','audio/wave','audio/x-wav','audio/mpeg','audio/mp3',
    'audio/mp4','audio/aac','audio/ogg','audio/flac','audio/x-flac',
    'audio/aiff','audio/x-aiff',
  ],
  STORAGE_ENDPOINT:          process.env.STORAGE_ENDPOINT     || '',
  STORAGE_ACCESS_KEY_ID:     process.env.STORAGE_ACCESS_KEY_ID || '',
  STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY || '',
  STORAGE_BUCKET:            process.env.STORAGE_BUCKET        || 'r3-uploads',
  SIGNED_URL_EXPIRES:   parseInt(process.env.SIGNED_URL_EXPIRES || '900', 10),
};

// ── Startup Env Validation ────────────────────────────────────────────────────
const REQUIRED_VARS = ['JWT_SECRET', 'DATABASE_URL', 'SESSION_SECRET'] as const;
for (const key of REQUIRED_VARS) {
  if (!process.env[key]) {
    throw new Error(`[config] Missing required env var: ${key}. Check server/.env`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

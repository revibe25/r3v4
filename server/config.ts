const MB = 1024 * 1024;

export const UPLOAD_CONFIG = {
  MAX_UPLOAD_SIZE: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '200', 10) * MB,
  MULTIPART_THRESHOLD: parseInt(process.env.MULTIPART_THRESHOLD_MB || '100', 10) * MB,
  ALLOWED_MIME_TYPES: [
    'audio/wav','audio/wave','audio/x-wav','audio/mpeg','audio/mp3',
    'audio/mp4','audio/aac','audio/ogg','audio/flac','audio/x-flac',
    'audio/aiff','audio/x-aiff',
  ],
  R2_ENDPOINT:          process.env.R2_ENDPOINT          || '',
  R2_ACCESS_KEY_ID:     process.env.R2_ACCESS_KEY_ID     || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME:       process.env.R2_BUCKET_NAME       || 'r3-samples',
  SIGNED_URL_EXPIRES:   parseInt(process.env.SIGNED_URL_EXPIRES || '900', 10),
};

/**
 * server/lib/storage-s3.ts
 *
 * S3-compatible file storage for uploads.
 * Works with AWS S3 and Cloudflare R2 (same API, set STORAGE_ENDPOINT for R2).
 *
 * Usage:
 *   import { uploadToS3, deleteFromS3, getSignedUrl } from '../lib/storage-s3';
 *
 * To activate in routes.ts, replace multer.diskStorage with multerS3() from
 * this module. The multer instance in routes.ts is the only change needed.
 */

import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';

const {
  STORAGE_BUCKET,
  STORAGE_REGION   = 'auto',
  STORAGE_ENDPOINT,
  STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY,
} = process.env;

if (!STORAGE_BUCKET || !STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY) {
  throw new Error(
    'Missing S3 env vars. Required: STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY'
  );
}

export const s3 = new S3Client({
  region: STORAGE_REGION,
  endpoint: STORAGE_ENDPOINT,
  credentials: {
    accessKeyId:     STORAGE_ACCESS_KEY_ID,
    secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
  },
  // Required for Cloudflare R2
  forcePathStyle: !!STORAGE_ENDPOINT,
});

const ALLOWED_MIMES = [
  'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg',
  'audio/flac', 'audio/x-wav', 'audio/x-m4a',
  'application/octet-stream',
];

/** Multer instance pre-configured for S3/R2. */
export const uploadS3 = multer({
  storage: multerS3({
    s3,
    bucket: STORAGE_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req: Express.Request, file: Express.Multer.File, cb: (err: Error | null, key: string) => void) => {
      const ext    = path.extname(file.originalname);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const folder = file.fieldname === 'sample' ? 'samples' : 'projects';
      cb(null, `${folder}/${unique}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype) || file.originalname.endsWith('.r3v')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

/** Delete an object from S3/R2 by its key. */
export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: key }));
}

/**
 * Generate a pre-signed URL for temporary direct access.
 * Default expiry: 1 hour. Use for download links.
 */
export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: STORAGE_BUCKET, Key: key });
  return awsGetSignedUrl(s3, cmd, { expiresIn });
}

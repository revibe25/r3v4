/**
 * server/lib/storage-s3.ts
 *
 * S3-compatible file storage for uploads.
 * Works with AWS S3 and Cloudflare R2 (same API; set STORAGE_ENDPOINT for R2).
 *
 * FIX: S3Client is now lazily instantiated on first use via getS3().
 *
 * ROOT CAUSE of previous crash:
 *   The original file threw at module load time when storage env vars were
 *   absent. Railway evaluates all ES module imports before serving any request,
 *   so the process crashed before binding to a port. Fixed by deferring the
 *   throw to first access -- identical to the getStripe() pattern in
 *   stripe-subscription.ts.
 *
 * WHY NOT object-literal getters in multerS3():
 *   multerS3 v3 types require `s3: S3Client` (a concrete value, not a getter).
 *   Object-literal getters { get s3() {...} } are not assignable to that type
 *   and cause TS errors. The correct approach is a factory function
 *   (getUploadS3) that resolves getS3() at call time and returns a fully
 *   typed multer instance. uploadS3 is a Proxy over that factory.
 */
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
const ALLOWED_MIMES = [
    'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg',
    'audio/flac', 'audio/x-wav', 'audio/x-m4a',
    'application/octet-stream',
];
// -- Lazy S3 client -------------------------------------------------------
// Throws at call time if env vars are absent, not at module import time.
// This allows the server to boot and serve non-storage routes without R2/S3.
let _s3 = null;
export function getS3() {
    if (!_s3) {
        const bucket = process.env.STORAGE_BUCKET;
        const accessKey = process.env.STORAGE_ACCESS_KEY_ID;
        const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;
        if (!bucket || !accessKey || !secretKey) {
            throw new Error('S3/R2 storage is not configured. ' +
                'Set STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, and STORAGE_SECRET_ACCESS_KEY ' +
                'in your .env or Railway environment variables before using file upload.');
        }
        _s3 = new S3Client({
            region: process.env.STORAGE_REGION ?? 'auto',
            endpoint: process.env.STORAGE_ENDPOINT,
            credentials: {
                accessKeyId: accessKey,
                secretAccessKey: secretKey,
            },
            // Required for Cloudflare R2 -- forces path-style bucket addressing
            forcePathStyle: !!process.env.STORAGE_ENDPOINT,
        });
    }
    return _s3;
}
/** @deprecated Use getS3() directly. Proxy preserved for legacy callers. */
export const s3 = new Proxy({}, {
    get(_target, prop) {
        return Reflect.get(getS3(), prop);
    },
});
// -- Upload middleware factory ---------------------------------------------
// Returns a fully configured multer instance wired to S3/R2.
// Called at upload time -- getS3() resolves then, not at module load.
function getUploadS3() {
    const s3Client = getS3();
    const bucket = process.env.STORAGE_BUCKET;
    return multer({
        storage: multerS3({
            s3: s3Client,
            bucket: bucket,
            contentType: multerS3.AUTO_CONTENT_TYPE,
            key: (_req, file, cb) => {
                const ext = path.extname(file.originalname);
                const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                const folder = file.fieldname === 'sample' ? 'samples' : 'projects';
                cb(null, `${folder}/${unique}${ext}`);
            },
        }),
        limits: { fileSize: 50 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (ALLOWED_MIMES.includes(file.mimetype) || file.originalname.endsWith('.r3v')) {
                cb(null, true);
            }
            else {
                cb(new Error('Invalid file type. Only audio files and .r3v project files are allowed.'));
            }
        },
    });
}
/**
 * uploadS3 -- multer middleware for S3/R2 uploads.
 * Drop-in replacement for multer.diskStorage in server/routes.ts.
 * Safe to import unconditionally -- throws only on first upload attempt
 * if storage is not configured.
 */
export const uploadS3 = new Proxy({}, {
    get(_target, prop) {
        return Reflect.get(getUploadS3(), prop);
    },
});
/** Delete an object from S3/R2 by its storage key. */
export async function deleteFromS3(key) {
    const bucket = process.env.STORAGE_BUCKET;
    if (!bucket)
        throw new Error('STORAGE_BUCKET is not set');
    await getS3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
/**
 * Generate a pre-signed URL for temporary direct access.
 * Default expiry: 1 hour. Use for client-side download links.
 */
export async function getSignedUrl(key, expiresIn = 3600) {
    const bucket = process.env.STORAGE_BUCKET;
    if (!bucket)
        throw new Error('STORAGE_BUCKET is not set');
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return awsGetSignedUrl(getS3(), cmd, { expiresIn });
}

import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_CONFIG } from '../config';
let _client = null;
function getClient() {
    if (!_client) {
        _client = new S3Client({
            region: 'auto',
            endpoint: UPLOAD_CONFIG.STORAGE_ENDPOINT,
            credentials: { accessKeyId: UPLOAD_CONFIG.STORAGE_ACCESS_KEY_ID, secretAccessKey: UPLOAD_CONFIG.STORAGE_SECRET_ACCESS_KEY },
        });
    }
    return _client;
}
const PART_SIZE = 10 * 1024 * 1024;
export async function createSignedUploadUrl(filename, contentType, size) {
    const ext = filename.split('.').pop() ?? 'bin';
    const fileKey = `samples/${uuidv4()}.${ext}`;
    const command = new PutObjectCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, ContentType: contentType, ContentLength: size });
    const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: UPLOAD_CONFIG.SIGNED_URL_EXPIRES });
    return { uploadUrl, fileKey, maxUploadSize: UPLOAD_CONFIG.MAX_UPLOAD_SIZE, expiresIn: UPLOAD_CONFIG.SIGNED_URL_EXPIRES };
}
export async function createMultipartUpload(filename, contentType, size) {
    const ext = filename.split('.').pop() ?? 'bin';
    const fileKey = `samples/${uuidv4()}.${ext}`;
    const create = await getClient().send(new CreateMultipartUploadCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, ContentType: contentType }));
    return { uploadId: create.UploadId, fileKey, partSize: PART_SIZE, totalParts: Math.ceil(size / PART_SIZE), maxUploadSize: UPLOAD_CONFIG.MAX_UPLOAD_SIZE };
}
export async function getSignedPartUrl(fileKey, uploadId, partNumber) {
    const command = new UploadPartCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, UploadId: uploadId, PartNumber: partNumber });
    const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: UPLOAD_CONFIG.SIGNED_URL_EXPIRES });
    return { partNumber, uploadUrl };
}
export async function completeMultipartUpload(fileKey, uploadId, parts) {
    await getClient().send(new CompleteMultipartUploadCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
}
export async function abortMultipartUpload(fileKey, uploadId) {
    await getClient().send(new AbortMultipartUploadCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, UploadId: uploadId }));
}
export function getPublicUrl(fileKey) {
    return `${UPLOAD_CONFIG.STORAGE_ENDPOINT.replace(/\/$/, '')}/${UPLOAD_CONFIG.STORAGE_BUCKET}/${fileKey}`;
}
// ── Storage helper functions ──────────────────────────────
export async function getUserById(userId) {
    const { db } = await import('../db');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user ?? null;
}
export async function getMixCountByUser(_userId) {
    // `mixes` table not yet in schema — return 0 (safe under-count; no user wrongly blocked).
    // TODO: add mixes table to db/schema.ts and replace this stub.
    return 0;
}
export async function updateUserPassword(userId, hashedPassword) {
    const { db } = await import('../db');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
}
export async function applyEffectToTrack(params) {
    // `trackEffects` table not yet in schema — return stub id so callers don't crash.
    // TODO: add trackEffects table to db/schema.ts and replace this stub.
    const { randomUUID } = await import('crypto');
    return { id: randomUUID(), trackId: params.trackId, effectId: params.effectId };
}
export async function removeEffectFromTrack(_params) {
    // `trackEffects` table not yet in schema — no-op stub.
    // TODO: add trackEffects table to db/schema.ts and replace this stub.
}

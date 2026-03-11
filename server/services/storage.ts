import { S3Client, PutObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_CONFIG } from '../config';

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: UPLOAD_CONFIG.STORAGE_ENDPOINT,
      credentials: { accessKeyId: UPLOAD_CONFIG.STORAGE_ACCESS_KEY_ID, secretAccessKey: UPLOAD_CONFIG.STORAGE_SECRET_ACCESS_KEY },
    });
  }
  return _client;
}

export interface SignedUploadResult { uploadUrl: string; fileKey: string; maxUploadSize: number; expiresIn: number; }
export interface MultipartSignedResult { uploadId: string; fileKey: string; partSize: number; totalParts: number; maxUploadSize: number; }

const PART_SIZE = 10 * 1024 * 1024;

export async function createSignedUploadUrl(filename: string, contentType: string, size: number): Promise<SignedUploadResult> {
  const ext = filename.split('.').pop() ?? 'bin';
  const fileKey = `samples/${uuidv4()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, ContentType: contentType, ContentLength: size });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: UPLOAD_CONFIG.SIGNED_URL_EXPIRES });
  return { uploadUrl, fileKey, maxUploadSize: UPLOAD_CONFIG.MAX_UPLOAD_SIZE, expiresIn: UPLOAD_CONFIG.SIGNED_URL_EXPIRES };
}

export async function createMultipartUpload(filename: string, contentType: string, size: number): Promise<MultipartSignedResult> {
  const ext = filename.split('.').pop() ?? 'bin';
  const fileKey = `samples/${uuidv4()}.${ext}`;
  const create = await getClient().send(new CreateMultipartUploadCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, ContentType: contentType }));
  return { uploadId: create.UploadId!, fileKey, partSize: PART_SIZE, totalParts: Math.ceil(size / PART_SIZE), maxUploadSize: UPLOAD_CONFIG.MAX_UPLOAD_SIZE };
}

export async function getSignedPartUrl(fileKey: string, uploadId: string, partNumber: number) {
  const command = new UploadPartCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, UploadId: uploadId, PartNumber: partNumber });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: UPLOAD_CONFIG.SIGNED_URL_EXPIRES });
  return { partNumber, uploadUrl };
}

export async function completeMultipartUpload(fileKey: string, uploadId: string, parts: Array<{ PartNumber: number; ETag: string }>) {
  await getClient().send(new CompleteMultipartUploadCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
}

export async function abortMultipartUpload(fileKey: string, uploadId: string) {
  await getClient().send(new AbortMultipartUploadCommand({ Bucket: UPLOAD_CONFIG.STORAGE_BUCKET, Key: fileKey, UploadId: uploadId }));
}

export function getPublicUrl(fileKey: string): string {
  return `${UPLOAD_CONFIG.STORAGE_ENDPOINT.replace(/\/$/, '')}/${UPLOAD_CONFIG.STORAGE_BUCKET}/${fileKey}`;
}

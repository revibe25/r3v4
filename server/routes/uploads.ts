import { Router, Request, Response } from 'express';
import { UPLOAD_CONFIG } from '../config';
import { createSignedUploadUrl, createMultipartUpload, getSignedPartUrl, completeMultipartUpload, abortMultipartUpload, getPublicUrl } from '../services/storage';

const router = Router();

function validateUploadRequest(filename: unknown, contentType: unknown, size: unknown): { error: string; status: number } | null {
  if (!filename || typeof filename !== 'string') return { error: 'filename is required', status: 400 };
  if (!contentType || typeof contentType !== 'string') return { error: 'contentType is required', status: 400 };
  if (!size || typeof size !== 'number') return { error: 'size must be a number', status: 400 };
  if (!UPLOAD_CONFIG.ALLOWED_MIME_TYPES.includes(contentType)) return { error: `Invalid file type. Allowed: ${UPLOAD_CONFIG.ALLOWED_MIME_TYPES.join(', ')}`, status: 400 };
  if (size > UPLOAD_CONFIG.MAX_UPLOAD_SIZE) return { error: `File too large. Maximum is ${UPLOAD_CONFIG.MAX_UPLOAD_SIZE / (1024*1024)}MB`, status: 413 };
  return null;
}

router.get('/config', (_req, res) => res.json({ maxUploadSize: UPLOAD_CONFIG.MAX_UPLOAD_SIZE, multipartThreshold: UPLOAD_CONFIG.MULTIPART_THRESHOLD, allowedMimeTypes: UPLOAD_CONFIG.ALLOWED_MIME_TYPES }));

router.post('/sign', async (req: Request, res: Response) => {
  try {
    const { filename, contentType, size } = req.body;
    const err = validateUploadRequest(filename, contentType, size);
    if (err) return res.status(err.status).json({ error: err.error });
    if (size > UPLOAD_CONFIG.MULTIPART_THRESHOLD) return res.status(400).json({ error: 'Use /multipart/init for large files', useMultipart: true });
    const result = await createSignedUploadUrl(filename, contentType, size);
    res.json({ ...result, publicUrl: getPublicUrl(result.fileKey) });
  } catch (e) { res.status(500).json({ error: 'Failed to generate signed URL' }); }
});

router.post('/multipart/init', async (req: Request, res: Response) => {
  try {
    const { filename, contentType, size } = req.body;
    const err = validateUploadRequest(filename, contentType, size);
    if (err) return res.status(err.status).json({ error: err.error });
    const result = await createMultipartUpload(filename, contentType, size);
    res.json(result);
  } catch (e) { res.status(500).json({ error: 'Failed to initiate multipart upload' }); }
});

router.post('/multipart/part', async (req: Request, res: Response) => {
  try {
    const { fileKey, uploadId, partNumber } = req.body;
    if (!fileKey || !uploadId || typeof partNumber !== 'number') return res.status(400).json({ error: 'fileKey, uploadId, partNumber required' });
    res.json(await getSignedPartUrl(fileKey, uploadId, partNumber));
  } catch (e) { res.status(500).json({ error: 'Failed to get part URL' }); }
});

router.post('/multipart/complete', async (req: Request, res: Response) => {
  try {
    const { fileKey, uploadId, parts } = req.body;
    if (!fileKey || !uploadId || !Array.isArray(parts)) return res.status(400).json({ error: 'fileKey, uploadId, parts required' });
    await completeMultipartUpload(fileKey, uploadId, parts);
    res.json({ success: true, fileKey, publicUrl: getPublicUrl(fileKey) });
  } catch (e) { res.status(500).json({ error: 'Failed to complete multipart upload' }); }
});

router.post('/multipart/abort', async (req: Request, res: Response) => {
  try {
    const { fileKey, uploadId } = req.body;
    if (!fileKey || !uploadId) return res.status(400).json({ error: 'fileKey and uploadId required' });
    await abortMultipartUpload(fileKey, uploadId);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Failed to abort' }); }
});

export default router;

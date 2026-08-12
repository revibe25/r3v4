let cfg = null;
export async function getUploadConfig() {
    if (cfg)
        return cfg;
    const res = await fetch('/api/uploads/config');
    if (!res.ok)
        throw new Error('Failed to fetch upload config');
    cfg = await res.json();
    return cfg;
}
export async function validateFile(file) {
    const cfg = await getUploadConfig();
    if (file.size > cfg.maxUploadSize)
        return `File too large. Max ${(cfg.maxUploadSize / (1024 * 1024)).toFixed(0)}MB.`;
    if (!cfg.allowedMimeTypes.includes(file.type))
        return `Invalid type "${file.type}". Upload an audio file.`;
    return null;
}
async function xhrUpload(url, data, contentType, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress)
            onProgress(Math.round(e.loaded / e.total * 100), e.loaded, e.total); };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.getResponseHeader('ETag') || '') : reject(new Error(`Status ${xhr.status}`));
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.send(data);
    });
}
async function uploadSingle(file, options) {
    const res = await fetch('/api/uploads/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) });
    if (!res.ok)
        throw new Error((await res.json()).error);
    const { uploadUrl, fileKey, publicUrl } = await res.json();
    await xhrUpload(uploadUrl, file, file.type, options.onProgress ? (p, l, t) => options.onProgress(p, l, t) : undefined);
    return { fileKey, publicUrl, size: file.size, filename: file.name };
}
async function uploadMultipart(file, options) {
    const initRes = await fetch('/api/uploads/multipart/init', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) });
    if (!initRes.ok)
        throw new Error((await initRes.json()).error);
    const { uploadId, fileKey, partSize, totalParts } = await initRes.json();
    const parts = [];
    let uploaded = 0;
    try {
        for (let i = 1; i <= totalParts; i++) {
            const chunk = file.slice((i - 1) * partSize, Math.min(i * partSize, file.size));
            const pRes = await fetch('/api/uploads/multipart/part', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileKey, uploadId, partNumber: i }) });
            const { uploadUrl } = await pRes.json();
            const etag = await xhrUpload(uploadUrl, chunk, file.type, (_, l) => { options.onProgress?.(Math.round((uploaded + l) / file.size * 100), uploaded + l, file.size); });
            uploaded += chunk.size;
            parts.push({ PartNumber: i, ETag: etag });
        }
        const cRes = await fetch('/api/uploads/multipart/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileKey, uploadId, parts }) });
        const { publicUrl } = await cRes.json();
        options.onProgress?.(100, file.size, file.size);
        return { fileKey, publicUrl, size: file.size, filename: file.name };
    }
    catch (err) {
        await fetch('/api/uploads/multipart/abort', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileKey, uploadId }) }).catch(() => { });
        throw err;
    }
}
export async function uploadAudioFile(file, options = {}) {
    const validErr = await validateFile(file);
    if (validErr) {
        options.onError?.(validErr);
        throw new Error(validErr);
    }
    const cfg = await getUploadConfig();
    return file.size >= cfg.multipartThreshold ? uploadMultipart(file, options) : uploadSingle(file, options);
}

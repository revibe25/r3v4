/**
 * utils/fileUtils.ts
 * Safe file helpers for loop/project storage.
 * Uses LOOP_STORAGE_BASE env var (default ./server/storage).
 * Separate from existing uploads/ directory.
 */
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../lib/logger';
const LOOP_STORAGE_BASE = path.resolve(process.env.LOOP_STORAGE_BASE ?? './server/storage');
export function safeResolve(...segments) {
    const resolved = path.resolve(LOOP_STORAGE_BASE, ...segments);
    if (!resolved.startsWith(LOOP_STORAGE_BASE))
        throw new Error(`Path traversal: ${resolved}`);
    return resolved;
}
export async function ensureDir(dirPath) { await fs.mkdir(dirPath, { recursive: true }); }
export async function writeFile(filePath, data) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, data);
    logger.debug(`Written: ${filePath} (${data.byteLength} bytes)`);
}
export async function writeJSON(filePath, data) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
export async function readFile(filePath) {
    try {
        return await fs.readFile(filePath);
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return null;
        throw e;
    }
}
export async function readJSON(filePath) {
    const raw = await readFile(filePath);
    return raw ? JSON.parse(raw.toString('utf-8')) : null;
}
export async function deleteFile(filePath) {
    try {
        await fs.unlink(filePath);
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            throw e;
    }
}
export async function listFiles(dirPath, ext) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.filter(e => e.isFile() && (ext ? e.name.endsWith(ext) : true)).map(e => e.name);
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return [];
        throw e;
    }
}
export async function statFile(filePath) {
    try {
        const s = await fs.stat(filePath);
        return { size: s.size, mtime: s.mtime };
    }
    catch {
        return null;
    }
}

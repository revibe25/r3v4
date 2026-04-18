/**
 * utils/fileUtils.ts
 * Safe file helpers for loop/project storage.
 * Uses LOOP_STORAGE_BASE env var (default ./server/storage).
 * Separate from existing uploads/ directory.
 */
import fs   from 'fs/promises';
import path from 'path';
import { logger } from '../lib/logger';

const LOOP_STORAGE_BASE = path.resolve(process.env.LOOP_STORAGE_BASE ?? './server/storage');

export function safeResolve(...segments: string[]): string {
  const resolved = path.resolve(LOOP_STORAGE_BASE, ...segments);
  if (!resolved.startsWith(LOOP_STORAGE_BASE)) throw new Error(`Path traversal: ${resolved}`);
  return resolved;
}
export async function ensureDir(dirPath: string): Promise<void> { await fs.mkdir(dirPath, { recursive: true }); }
export async function writeFile(filePath: string, data: Buffer): Promise<void> {
  await ensureDir(path.dirname(filePath)); await fs.writeFile(filePath, data);
  logger.debug(`Written: ${filePath} (${data.byteLength} bytes)`);
}
export async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
export async function readFile(filePath: string): Promise<Buffer | null> {
  try { return await fs.readFile(filePath); }
  catch (e: unknown) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
}
export async function readJSON<T>(filePath: string): Promise<T | null> {
  const raw = await readFile(filePath);
  return raw ? JSON.parse(raw.toString('utf-8')) as T : null;
}
export async function deleteFile(filePath: string): Promise<void> {
  try { await fs.unlink(filePath); }
  catch (e: unknown) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
}
export async function listFiles(dirPath: string, ext?: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isFile() && (ext ? e.name.endsWith(ext) : true)).map(e => e.name);
  } catch (e: unknown) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
}
export async function statFile(filePath: string): Promise<{ size: number; mtime: Date } | null> {
  try { const s = await fs.stat(filePath); return { size: s.size, mtime: s.mtime }; }
  catch { return null; }
}

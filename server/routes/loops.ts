/**
 * routes/loops.ts
 * POST /api/save-loop  GET /api/loops  GET /api/loops/:id  DELETE /api/loops/:id
 */
import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import multer from 'multer';
import path   from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { safeResolve, writeFile, readFile, deleteFile, listFiles, statFile } from '../utils/fileUtils';
import { logger }        from '../lib/logger';
import { uploadLimiter } from '../middleware/rateLimit';

const router = Router();
const MAX_LOOP_BYTES = (Number(process.env.MAX_LOOP_SIZE_MB) || 10) * 1024 * 1024;
const ALLOWED_MIMES  = new Set(['audio/wav','audio/webm','audio/ogg','audio/mpeg']);
const LOOPS_DIR      = safeResolve('loops');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_LOOP_BYTES },
  fileFilter: (_req, file, cb) =>
    ALLOWED_MIMES.has(file.mimetype) ? cb(null, true) : cb(new Error(`Unsupported MIME: ${file.mimetype}`)),
});

const LoopMetaSchema = z.object({
  name:      z.string().min(1).max(120),
  projectId: z.string().uuid().optional(),
  bpm:       z.number().min(20).max(300).optional(),
  trackIdx:  z.number().int().min(0).max(99).optional(),
});

const buildFilename = (orig: string) => `${uuidv4()}-${Date.now()}${(path.extname(orig).toLowerCase()||'.wav').replace(/[^.a-z0-9]/gi,'')}`;
const loopId        = (f: string)    => path.basename(f, path.extname(f));

router.post('/save-loop', uploadLimiter, upload.single('file'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ status:'error', message:'No file.', timestamp: new Date().toISOString() }); return; }
    const meta     = LoopMetaSchema.parse({ name: req.body.name ?? req.file.originalname, projectId: req.body.projectId, bpm: req.body.bpm ? Number(req.body.bpm) : undefined, trackIdx: req.body.trackIdx ? Number(req.body.trackIdx) : undefined });
    const filename = buildFilename(req.file.originalname);
    await writeFile(`${LOOPS_DIR}/${filename}`, req.file.buffer);
    const id = loopId(filename);
    logger.info(`[loops] saved: ${filename}`);
    res.status(201).json({ status:'ok', data:{ id, filename, name:meta.name, projectId:meta.projectId??null, bpm:meta.bpm??null, trackIdx:meta.trackIdx??null, size:req.file.buffer.byteLength, mimeType:req.file.mimetype, url:`/api/loops/${id}` }, timestamp: new Date().toISOString() });
  } catch(err){ next(err); }
});

router.get('/loops', async (_req, res, next) => {
  try {
    const files = await listFiles(LOOPS_DIR);
    const loops = await Promise.all(files.map(async f => { const s = await statFile(`${LOOPS_DIR}/${f}`); return { id:loopId(f), filename:f, size:s?.size??0, mtime:s?.mtime??null, url:`/api/loops/${loopId(f)}` }; }));
    res.json({ status:'ok', data:{ total:loops.length, loops }, timestamp: new Date().toISOString() });
  } catch(err){ next(err); }
});

router.get('/loops/:id', async (req, res, next) => {
  try {
    const files = await listFiles(LOOPS_DIR);
    const matched = files.find(f => loopId(f) === req.params.id);
    if (!matched) { res.status(404).json({ status:'error', message:`Loop not found: ${req.params.id}`, timestamp: new Date().toISOString() }); return; }
    const buffer = await readFile(`${LOOPS_DIR}/${matched}`);
    if (!buffer) { res.status(404).json({ status:'error', message:'File missing.', timestamp: new Date().toISOString() }); return; }
    const mimes: Record<string,string> = { '.wav':'audio/wav', '.webm':'audio/webm', '.ogg':'audio/ogg', '.mp3':'audio/mpeg' };
    res.set({ 'Content-Type': mimes[path.extname(matched).toLowerCase()]??'application/octet-stream', 'Content-Disposition':`attachment; filename="${matched}"`, 'Content-Length':buffer.byteLength.toString() });
    res.send(buffer);
  } catch(err){ next(err); }
});

router.delete('/loops/:id', async (req, res, next) => {
  try {
    const files = await listFiles(LOOPS_DIR);
    const matched = files.find(f => loopId(f) === req.params.id);
    if (!matched) { res.status(404).json({ status:'error', message:`Loop not found: ${req.params.id}`, timestamp: new Date().toISOString() }); return; }
    await deleteFile(`${LOOPS_DIR}/${matched}`);
    logger.info(`[loops] deleted: ${matched}`);
    res.json({ status:'ok', data:{ id:req.params.id, deleted:true }, timestamp: new Date().toISOString() });
  } catch(err){ next(err); }
});

export default router;

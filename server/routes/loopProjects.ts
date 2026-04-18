/**
 * routes/loopProjects.ts
 * File-based project sessions — complements (does NOT replace) the DB-backed /api/projects.
 * POST /api/loopproject/save  GET /api/loopproject/:id  GET /api/loopprojects  DELETE /api/loopproject/:id
 */
import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { safeResolve, writeJSON, readJSON, deleteFile, listFiles } from '../utils/fileUtils';
import { logger } from '../lib/logger';

const router = Router();
const PROJECTS_DIR = safeResolve('projects');

const TrackSchema = z.object({ idx:z.number().int().min(0).max(99), name:z.string().max(80).optional(), loopId:z.string().optional(), filename:z.string().optional(), volume:z.number().min(0).max(1).default(1), muted:z.boolean().default(false), fx:z.object({ filterFreq:z.number().optional(), delayTime:z.number().optional(), delayFeedback:z.number().optional(), reverbDecay:z.number().optional(), compThreshold:z.number().optional() }).passthrough().optional() });
const LoopProjectSchema = z.object({ id:z.string().uuid().optional(), name:z.string().min(1).max(120), bpm:z.number().min(20).max(300).default(120), version:z.number().int().min(1).default(1), tracks:z.array(TrackSchema).max(100), midiMap:z.record(z.string()).optional(), createdAt:z.string().optional(), updatedAt:z.string().optional() }).passthrough();
export type LoopProject = z.infer<typeof LoopProjectSchema>;
const projectPath = (id: string) => `${PROJECTS_DIR}/${id}.r3project.json`;

router.post('/loopproject/save', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incoming = LoopProjectSchema.parse(req.body);
    const id       = incoming.id ?? uuidv4();
    const existing = await readJSON<LoopProject>(projectPath(id));
    const now      = new Date().toISOString();
    const project  = { ...incoming, id, version:(existing ? (existing.version??1)+1 : 1), createdAt:existing?.createdAt??now, updatedAt:now };
    await writeJSON(projectPath(id), project);
    logger.info(`[loopProjects] saved: ${id} – "${project.name}"`);
    res.status(existing ? 200 : 201).json({ status:'ok', data:project, timestamp:now });
  } catch(err){ next(err); }
});

router.get('/loopproject/:id', async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) { res.status(400).json({ status:'error', message:'Invalid ID.', timestamp:new Date().toISOString() }); return; }
    const p = await readJSON<LoopProject>(projectPath(req.params.id));
    if (!p) { res.status(404).json({ status:'error', message:`Not found: ${req.params.id}`, timestamp:new Date().toISOString() }); return; }
    res.json({ status:'ok', data:p, timestamp:new Date().toISOString() });
  } catch(err){ next(err); }
});

router.get('/loopprojects', async (_req, res, next) => {
  try {
    const files = await listFiles(PROJECTS_DIR, '.json');
    const projects = (await Promise.all(files.map(async f => { const p = await readJSON<LoopProject>(`${PROJECTS_DIR}/${f}`); return p ? { id:p.id, name:p.name, bpm:p.bpm, version:p.version, trackCount:p.tracks?.length??0, updatedAt:p.updatedAt } : null; }))).filter(Boolean);
    res.json({ status:'ok', data:{ total:projects.length, projects }, timestamp:new Date().toISOString() });
  } catch(err){ next(err); }
});

router.delete('/loopproject/:id', async (req, res, next) => {
  try {
    const fp = projectPath(req.params.id);
    if (!await readJSON(fp)) { res.status(404).json({ status:'error', message:`Not found: ${req.params.id}`, timestamp:new Date().toISOString() }); return; }
    await deleteFile(fp);
    logger.info(`[loopProjects] deleted: ${req.params.id}`);
    res.json({ status:'ok', data:{ id:req.params.id, deleted:true }, timestamp:new Date().toISOString() });
  } catch(err){ next(err); }
});

export default router;

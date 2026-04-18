/**
 * routes/midi.ts
 * POST /api/midi/mappings  GET /api/midi/mappings
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { safeResolve, writeJSON, readJSON } from '../utils/fileUtils';
import { logger } from '../lib/logger';

const router     = Router();
const MIDI_FILE  = safeResolve('midi-mappings.json');
const MappingEntrySchema   = z.object({ key: z.string().regex(/^\d+-(?:cc|note)-\d+$/), action: z.string().min(1).max(80), label: z.string().max(80).optional() });
const MappingsPayloadSchema = z.object({ mappings: z.array(MappingEntrySchema).max(512) });
export type MappingEntry = z.infer<typeof MappingEntrySchema>;

router.post('/midi/mappings', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { mappings } = MappingsPayloadSchema.parse(req.body);
    const payload = { mappings, savedAt: new Date().toISOString() };
    await writeJSON(MIDI_FILE, payload);
    logger.info(`[midi] mappings saved: ${mappings.length}`);
    res.json({ status:'ok', data:payload, timestamp:new Date().toISOString() });
  } catch(err){ next(err); }
});

router.get('/midi/mappings', async (_req, res, next) => {
  try {
    const data = await readJSON<{ mappings: MappingEntry[]; savedAt: string }>(MIDI_FILE);
    res.json({ status:'ok', data: data ?? { mappings:[], savedAt:null }, timestamp:new Date().toISOString() });
  } catch(err){ next(err); }
});

export default router;

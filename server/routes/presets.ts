import { Router } from 'express';
import { db } from '../db/index';
import { effectPresetsTable, effectChainsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { requireUser } from "../middleware/requireUser";

const router = Router();

// ── Effect Presets ─────────────────────────────────────────────────────────────

router.get('/presets', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json(await db.select().from(effectPresetsTable)
      .where(eq(effectPresetsTable.userId, userId)));
  } catch { res.status(500).json({ error: 'Failed to fetch presets' }); }
});

router.get('/presets/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.select().from(effectPresetsTable)
      .where(and(
        eq(effectPresetsTable.id, req.params.id as string),
        eq(effectPresetsTable.userId, userId),
      ));
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch preset' }); }
});

router.post('/presets', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, settings } = req.body as { name: string; settings: unknown };
    const r = await db.insert(effectPresetsTable)
      .values({ name, settings, userId } as any)
      .returning();
    res.status(201).json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to create preset' }); }
});

router.put('/presets/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, settings } = req.body as { name: string; settings: unknown };
    const r = await db.update(effectPresetsTable)
      .set({ name, settings, updatedAt: new Date() } as any)
      .where(and(
        eq(effectPresetsTable.id, req.params.id as string),
        eq(effectPresetsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Edit failed' }); }
});

router.delete('/presets/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.delete(effectPresetsTable)
      .where(and(
        eq(effectPresetsTable.id, req.params.id as string),
        eq(effectPresetsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Delete failed' }); }
});

// ── Effect Chains ─────────────────────────────────────────────────────────────

router.get('/chains', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json(await db.select().from(effectChainsTable)
      .where(eq(effectChainsTable.userId, userId)));
  } catch { res.status(500).json({ error: 'Failed to fetch chains' }); }
});

router.get('/chains/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.select().from(effectChainsTable)
      .where(and(
        eq(effectChainsTable.id, req.params.id as string),
        eq(effectChainsTable.userId, userId),
      ));
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch chain' }); }
});

router.post('/chains', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, nodes } = req.body as { name: string; nodes: unknown };
    const r = await db.insert(effectChainsTable)
      .values({ id: crypto.randomUUID(), userId, name, nodes: JSON.stringify(nodes) } as any)
      .returning();
    res.status(201).json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to create chain' }); }
});

router.put('/chains/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, nodes } = req.body as { name: string; nodes: unknown };
    const r = await db.update(effectChainsTable)
      .set({ name, nodes: JSON.stringify(nodes), updatedAt: new Date() } as any)
      .where(and(
        eq(effectChainsTable.id, req.params.id as string),
        eq(effectChainsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Update failed' }); }
});

router.delete('/chains/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.delete(effectChainsTable)
      .where(and(
        eq(effectChainsTable.id, req.params.id as string),
        eq(effectChainsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Delete failed' }); }
});

export default router;


import { Router } from 'express';
import { db } from '../db/index';
import { effectPresetsTable, effectChainsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
const router = Router();
router.get('/presets', async (_req, res) => { try {
    res.json(await db.select().from(effectPresetsTable));
}
catch {
    res.status(500).json({ error: 'Failed to fetch presets' });
} });
router.get('/presets/:id', async (req, res) => { try {
    const r = await db.select().from(effectPresetsTable).where(eq(effectPresetsTable.id, req.params.id));
    if (!r.length)
        return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
}
catch {
    res.status(500).json({ error: 'Failed to fetch preset' });
} });
router.post('/presets', async (req, res) => { try {
    const { name, settings } = req.body;
    const values = { name, settings };
    const r = await db.insert(effectPresetsTable).values(values).returning();
    res.status(201).json(r[0]);
}
catch {
    res.status(500).json({ error: 'Failed to create preset' });
} });
router.put('/presets/:id', async (req, res) => { try {
    const { name, settings } = req.body;
    const values = { name, settings, updatedAt: new Date() };
    const r = await db.update(effectPresetsTable).set(values).where(eq(effectPresetsTable.id, req.params.id)).returning();
    if (!r.length)
        return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
}
catch {
    res.status(500).json({ error: 'Edit failed' });
} });
router.delete('/presets/:id', async (req, res) => { try {
    const r = await db.delete(effectPresetsTable).where(eq(effectPresetsTable.id, req.params.id)).returning();
    if (!r.length)
        return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
}
catch {
    res.status(500).json({ error: 'Delete failed' });
} });
router.get('/chains', async (_req, res) => { try {
    res.json(await db.select().from(effectChainsTable));
}
catch {
    res.status(500).json({ error: 'Failed to fetch chains' });
} });
router.get('/chains/:id', async (req, res) => { try {
    const r = await db.select().from(effectChainsTable).where(eq(effectChainsTable.id, req.params.id));
    if (!r.length)
        return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
}
catch {
    res.status(500).json({ error: 'Failed to fetch chain' });
} });
router.post('/chains', async (req, res) => { try {
    const { name, nodes } = req.body;
    const values = { id: crypto.randomUUID(), name, nodes: JSON.stringify(nodes) };
    const r = await db.insert(effectChainsTable).values(values).returning();
    res.status(201).json(r[0]);
}
catch {
    res.status(500).json({ error: 'Failed to create chain' });
} });
router.put('/chains/:id', async (req, res) => { try {
    const { name, nodes } = req.body;
    const values = { name, nodes: JSON.stringify(nodes), updatedAt: new Date() };
    const r = await db.update(effectChainsTable).set(values).where(eq(effectChainsTable.id, req.params.id)).returning();
    if (!r.length)
        return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
}
catch {
    res.status(500).json({ error: 'Update failed' });
} });
router.delete('/chains/:id', async (req, res) => { try {
    const r = await db.delete(effectChainsTable).where(eq(effectChainsTable.id, req.params.id)).returning();
    if (!r.length)
        return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
}
catch {
    res.status(500).json({ error: 'Delete failed' });
} });
export default router;

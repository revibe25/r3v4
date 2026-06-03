import { logger } from "../utils/logger";
import express from 'express';
import { verifyMockToken, applyMockSubscription, cancelMockSubscription, renderCheckoutPage, renderPortalPage, } from '../services/mock-billing';
import { db } from '../db';
import { subscriptions } from '../../shared/schema-subscription';
import { eq } from 'drizzle-orm';
import { TIER_DEFINITIONS, } from '../../shared/subscription.types';
const router = express.Router();
// Urlencoded parser for form POSTs — scoped to this router only
const urlencoded = express.urlencoded({ extended: false });
// ── Helpers ───────────────────────────────────────────────────────────────────
function badToken(res, message = 'Invalid or expired link.') {
    res.status(400).send(`
    <!DOCTYPE html><html><head><title>Error — R3</title>
    <style>body{background:#0a0c0f;color:#ff6670;font-family:monospace;
    display:flex;align-items:center;justify-content:center;height:100vh;font-size:.9rem}
    </style></head>
    <body>${message} <a href="/" style="color:#4dd9ff;margin-left:1rem">← Go home</a></body>
    </html>
  `);
}
// ── GET /api/mock-billing/checkout ───────────────────────────────────────────
router.get('/checkout', (req, res) => {
    const { token = '', sig = '' } = req.query;
    const payload = verifyMockToken(token, sig);
    if (!payload) {
        badToken(res);
        return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderCheckoutPage(payload.tier, payload.billingCycle, payload.trialDays ?? 14, token, sig));
});
// ── POST /api/mock-billing/checkout (form submit — "Activate Trial") ──────────
router.post('/checkout', urlencoded, async (req, res) => {
    const { token = '', sig = '' } = req.body;
    const payload = verifyMockToken(token, sig);
    if (!payload) {
        badToken(res);
        return;
    }
    try {
        await applyMockSubscription(payload.userId, payload.tier, payload.billingCycle, payload.trialDays ?? 14);
        res.redirect(payload.successUrl);
    }
    catch (err) {
        logger.error('applyMockSubscription failed', { error: err.message });
        badToken(res, 'Subscription activation failed — check server logs.');
    }
});
// ── GET /api/mock-billing/cancel (← Go back, no DB write) ────────────────────
router.get('/cancel', (req, res) => {
    const { token = '', sig = '' } = req.query;
    const payload = verifyMockToken(token, sig);
    if (!payload) {
        badToken(res);
        return;
    }
    res.redirect(payload.cancelUrl);
});
// ── GET /api/mock-billing/portal ──────────────────────────────────────────────
router.get('/portal', async (req, res) => {
    const { token = '', sig = '' } = req.query;
    const payload = verifyMockToken(token, sig);
    if (!payload) {
        badToken(res);
        return;
    }
    // Fetch current subscription from DB to show accurate details
    const [sub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, payload.userId))
        .limit(1);
    const tier = (sub?.tier ?? 'explorer');
    const tierDef = TIER_DEFINITIONS[tier];
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPortalPage(tierDef.displayName, sub?.billingCycle ?? null, sub?.status ?? 'active', sub?.currentPeriodEnd ?? null, token, sig));
});
// ── POST /api/mock-billing/portal/cancel ─────────────────────────────────────
router.post('/portal/cancel', urlencoded, async (req, res) => {
    const { token = '', sig = '' } = req.body;
    const payload = verifyMockToken(token, sig);
    if (!payload) {
        badToken(res);
        return;
    }
    try {
        await cancelMockSubscription(payload.userId);
        const returnUrl = payload.returnUrl;
        res.redirect(returnUrl.includes('?')
            ? `${returnUrl}&cancelled=true`
            : `${returnUrl}?cancelled=true`);
    }
    catch (err) {
        logger.error('cancelMockSubscription failed', { error: err.message });
        badToken(res, 'Cancellation failed — check server logs.');
    }
});
// ── GET /api/mock-billing/portal/back ────────────────────────────────────────
router.get('/portal/back', (req, res) => {
    const { token = '', sig = '' } = req.query;
    const payload = verifyMockToken(token, sig);
    if (!payload) {
        res.redirect('/');
        return;
    }
    res.redirect(payload.returnUrl);
});
export default router;

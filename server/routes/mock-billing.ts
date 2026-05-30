import { logger } from "../utils/logger";
/**
 * server/routes/mock-billing.ts
 *
 * Express router mounted at /api/mock-billing in server/index.ts.
 * Only reached when isMockMode() is true — real Stripe mode never calls these.
 *
 * All POST endpoints use application/x-www-form-urlencoded (HTML form submit).
 * No JSON body parser needed here — urlencoded is applied per-route.
 *
 * Routes:
 *   GET  /api/mock-billing/checkout          → render checkout page
 *   POST /api/mock-billing/checkout          → apply subscription + redirect
 *   GET  /api/mock-billing/cancel            → redirect to cancelUrl
 *   GET  /api/mock-billing/portal            → render portal page
 *   POST /api/mock-billing/portal/cancel     → cancel subscription + redirect
 *   GET  /api/mock-billing/portal/back       → redirect to returnUrl
 */

import type { Request, Response } from 'express';
import express, { Router } from 'express';
import {
  verifyMockToken,
  applyMockSubscription,
  cancelMockSubscription,
  renderCheckoutPage,
  renderPortalPage,
} from '../services/mock-billing';
import { db }           from '../db';
import { subscriptions } from '../../shared/schema-subscription';
import { eq }           from 'drizzle-orm';
import type {
  SubscriptionTier,
  BillingCycle} from '../../shared/subscription.types';
import {
  TIER_DEFINITIONS,
} from '../../shared/subscription.types';

const router = express.Router();

// Urlencoded parser for form POSTs — scoped to this router only
const urlencoded = express.urlencoded({ extended: false });

// ── Helpers ───────────────────────────────────────────────────────────────────

function badToken(res: Response, message = 'Invalid or expired link.'): void {
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

router.get('/checkout', (req: Request, res: Response) => {
  const { token = '', sig = '' } = req.query as Record<string, string>;
  const payload = verifyMockToken(token, sig);
  if (!payload) { badToken(res); return; }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderCheckoutPage(
    payload.tier         as SubscriptionTier,
    payload.billingCycle as BillingCycle,
    (payload.trialDays   as number) ?? 14,
    token,
    sig,
  ));
});

// ── POST /api/mock-billing/checkout (form submit — "Activate Trial") ──────────

router.post('/checkout', urlencoded, async (req: Request, res: Response) => {
  const { token = '', sig = '' } = req.body as Record<string, string>;
  const payload = verifyMockToken(token, sig);
  if (!payload) { badToken(res); return; }

  try {
    await applyMockSubscription(
      payload.userId       as string,
      payload.tier         as SubscriptionTier,
      payload.billingCycle as BillingCycle,
      (payload.trialDays   as number) ?? 14,
    );
    res.redirect(payload.successUrl as string);
  } catch (err) {
    logger.error('applyMockSubscription failed', { error: (err as Error).message });
    badToken(res, 'Subscription activation failed — check server logs.');
  }
});

// ── GET /api/mock-billing/cancel (← Go back, no DB write) ────────────────────

router.get('/cancel', (req: Request, res: Response) => {
  const { token = '', sig = '' } = req.query as Record<string, string>;
  const payload = verifyMockToken(token, sig);
  if (!payload) { badToken(res); return; }
  res.redirect(payload.cancelUrl as string);
});

// ── GET /api/mock-billing/portal ──────────────────────────────────────────────

router.get('/portal', async (req: Request, res: Response) => {
  const { token = '', sig = '' } = req.query as Record<string, string>;
  const payload = verifyMockToken(token, sig);
  if (!payload) { badToken(res); return; }

  // Fetch current subscription from DB to show accurate details
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, payload.userId as string))
    .limit(1);

  const tier    = (sub?.tier ?? 'explorer') as SubscriptionTier;
  const tierDef = TIER_DEFINITIONS[tier];

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderPortalPage(
    tierDef.displayName,
    sub?.billingCycle ?? null,
    sub?.status       ?? 'active',
    sub?.currentPeriodEnd ?? null,
    token,
    sig,
  ));
});

// ── POST /api/mock-billing/portal/cancel ─────────────────────────────────────

router.post('/portal/cancel', urlencoded, async (req: Request, res: Response) => {
  const { token = '', sig = '' } = req.body as Record<string, string>;
  const payload = verifyMockToken(token, sig);
  if (!payload) { badToken(res); return; }

  try {
    await cancelMockSubscription(payload.userId as string);
    const returnUrl = payload.returnUrl as string;
    res.redirect(
      returnUrl.includes('?')
        ? `${returnUrl}&cancelled=true`
        : `${returnUrl}?cancelled=true`,
    );
  } catch (err) {
    logger.error('cancelMockSubscription failed', { error: (err as Error).message });
    badToken(res, 'Cancellation failed — check server logs.');
  }
});

// ── GET /api/mock-billing/portal/back ────────────────────────────────────────

router.get('/portal/back', (req: Request, res: Response) => {
  const { token = '', sig = '' } = req.query as Record<string, string>;
  const payload = verifyMockToken(token, sig);
  if (!payload) { res.redirect('/'); return; }
  res.redirect(payload.returnUrl as string);
});

export default router;

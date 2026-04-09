/**
 * server/services/mock-billing.ts
 *
 * Sandbox billing layer — zero external dependencies.
 *
 * Active when:
 *   BILLING_MODE=mock  (explicit opt-in)
 *   OR STRIPE_SECRET_KEY is absent / placeholder
 *
 * Flow:
 *   createCheckoutSession →  /api/mock-billing/checkout  (HMAC-signed token, 15 min TTL)
 *   createPortalSession   →  /api/mock-billing/portal    (HMAC-signed token, 15 min TTL)
 *
 *   GET  /api/mock-billing/checkout        renders checkout page
 *   POST /api/mock-billing/checkout        writes subscription to DB, redirects to successUrl
 *   GET  /api/mock-billing/portal          renders portal page with current sub details
 *   POST /api/mock-billing/portal/cancel   reverts to explorer, redirects to returnUrl
 *   GET  /api/mock-billing/cancel          redirects to cancelUrl (no DB write)
 *   GET  /api/mock-billing/portal/back     redirects to returnUrl
 *
 * To switch to real billing:
 *   1. Set STRIPE_SECRET_KEY to a real sk_test_/sk_live_ value in .env
 *   2. Optionally remove BILLING_MODE=mock
 *   3. Restart — isMockMode() returns false, all calls go to Stripe automatically.
 */

import crypto from 'crypto';
import { db }                   from '../db';
import { subscriptions }        from '../../shared/schema-subscription';
import { eq }                   from 'drizzle-orm';
import {
  SubscriptionTier,
  BillingCycle,
  TIER_DEFINITIONS,
} from '../../shared/subscription.types';

// ── Mode detection ────────────────────────────────────────────────────────────

/**
 * Returns true when the server should use mock billing instead of Stripe.
 * Called at the top of createCheckoutSession / createPortalSession in
 * stripe-subscription.ts — no other code needs to know about mock mode.
 */
export function isMockMode(): boolean {
  if (process.env.BILLING_MODE === 'mock') return true;
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  return (
    !key ||
    key.includes('localdev') ||
    key.includes('placeholder') ||
    key.includes('pending')
  );
}

// ── Token signing (HMAC-SHA256, base64url encoded) ────────────────────────────

function sign(encoded: string): string {
  const secret = process.env.JWT_SECRET ?? 'r3-mock-billing-dev-secret';
  return crypto.createHmac('sha256', secret).update(encoded).digest('hex');
}

function encodeToken(data: object): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decodes and verifies a mock billing token.
 * Returns null if the signature is invalid or the token has expired.
 */
export function verifyMockToken(
  token: string,
  sig: string,
): Record<string, unknown> | null {
  if (sign(token) !== sig) return null;
  try {
    const data = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf-8'),
    ) as Record<string, unknown>;
    if (typeof data.exp === 'number' && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// ── URL builders ──────────────────────────────────────────────────────────────

const TOKEN_TTL = 15 * 60 * 1_000; // 15 minutes

function serverBase(): string {
  return (
    process.env.SERVER_URL ??
    `http://localhost:${process.env.PORT ?? '3001'}`
  );
}

export interface MockCheckoutOpts {
  userId:       string;
  tier:         SubscriptionTier;
  billingCycle: BillingCycle;
  successUrl:   string;
  cancelUrl:    string;
  trialDays?:   number;
}

export function createMockCheckoutUrl(opts: MockCheckoutOpts): string {
  const encoded = encodeToken({
    userId:       opts.userId,
    tier:         opts.tier,
    billingCycle: opts.billingCycle,
    successUrl:   opts.successUrl,
    cancelUrl:    opts.cancelUrl,
    trialDays:    opts.trialDays ?? 14,
    exp:          Date.now() + TOKEN_TTL,
  });
  return `${serverBase()}/api/mock-billing/checkout?token=${encoded}&sig=${sign(encoded)}`;
}

export interface MockPortalOpts {
  userId:    string;
  returnUrl: string;
}

export function createMockPortalUrl(opts: MockPortalOpts): string {
  const encoded = encodeToken({
    userId:    opts.userId,
    returnUrl: opts.returnUrl,
    exp:       Date.now() + TOKEN_TTL,
  });
  return `${serverBase()}/api/mock-billing/portal?token=${encoded}&sig=${sign(encoded)}`;
}

// ── DB operations ─────────────────────────────────────────────────────────────

/**
 * Writes (or updates) a mock subscription row for the given user.
 * Uses explicit select-then-insert/update to avoid Drizzle unique-index
 * conflict target limitations on non-PK columns.
 */
export async function applyMockSubscription(
  userId:       string,
  tier:         SubscriptionTier,
  billingCycle: BillingCycle,
  trialDays = 14,
): Promise<void> {
  const now       = new Date();
  const trialEnd  = new Date(now.getTime() + trialDays * 86_400_000);
  const periodEnd = new Date(
    now.getTime() + (billingCycle === 'annual' ? 365 : 30) * 86_400_000,
  );

  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  const fields = {
    tier,
    status:              'trialing'  as const,
    billingCycle,
    stripeCustomerId:    `mock_cus_${userId.slice(0, 8)}`,
    stripeSubscriptionId:`mock_sub_${userId.slice(0, 8)}`,
    stripePriceId:       `mock_price_${tier}_${billingCycle}`,
    currentPeriodStart:  now,
    currentPeriodEnd:    periodEnd,
    cancelAtPeriodEnd:   false,
    trialStart:          now,
    trialEnd,
    updatedAt:           now,
  };

  if (existing[0]) {
    await db
      .update(subscriptions)
      .set(fields)
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      id: `mock_${userId}`,
      userId,
      ...fields,
    });
  }
}

/** Reverts a user's subscription to the free Explorer tier. */
export async function cancelMockSubscription(userId: string): Promise<void> {
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (!existing[0]) return;

  await db
    .update(subscriptions)
    .set({
      tier:             'explorer',
      status:           'canceled',
      cancelAtPeriodEnd: false,
      updatedAt:        new Date(),
    })
    .where(eq(subscriptions.userId, userId));
}

// ── HTML renderer ─────────────────────────────────────────────────────────────

const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0a0c0f; color: #c8d0dc;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    min-height: 100vh; display: flex;
    align-items: center; justify-content: center; padding: 2rem;
  }
  .card {
    background: #0f1318; border: 1px solid #1e2630;
    border-radius: 16px; padding: 2.5rem;
    max-width: 440px; width: 100%;
    box-shadow: 0 0 60px rgba(0,200,255,.05);
  }
  .badge {
    font-size: 10px; text-transform: uppercase; letter-spacing: .2em;
    color: #4dd9ff; border: 1px solid rgba(77,217,255,.22);
    background: rgba(77,217,255,.06); padding: 3px 10px;
    border-radius: 6px; display: inline-block; margin-bottom: 1.5rem;
  }
  h1 { font-size: 1.4rem; color: #e8edf5; margin-bottom: .4rem; }
  .sub { font-size: .8rem; color: #5a6a7a; margin-bottom: 2rem; line-height: 1.65; }
  .plan-box {
    background: #141920; border: 1px solid rgba(77,217,255,.15);
    border-radius: 12px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
  }
  .plan-label {
    font-size: .7rem; text-transform: uppercase; letter-spacing: .18em;
    color: #4dd9ff; margin-bottom: .45rem;
  }
  .plan-price { font-size: 2.4rem; color: #e8edf5; }
  .plan-price span { font-size: .85rem; color: #5a6a7a; margin-left: 2px; }
  .plan-cycle { font-size: .75rem; color: #5a6a7a; margin-top: .2rem; }
  .detail { font-size: .75rem; color: #5a6a7a; line-height: 1.8; }
  .detail strong { color: #c8d0dc; }
  .trial-note {
    font-size: .75rem; color: #3dbf88;
    border: 1px solid rgba(61,191,136,.2); background: rgba(61,191,136,.05);
    border-radius: 8px; padding: .6rem 1rem; margin-bottom: 1.75rem;
  }
  .btn {
    width: 100%; padding: .85rem; border-radius: 10px; border: none;
    cursor: pointer; font-family: inherit; font-size: .85rem;
    font-weight: 600; letter-spacing: .05em; transition: all .18s;
    display: flex; align-items: center; justify-content: center; gap: .5rem;
    text-decoration: none; margin-bottom: .75rem;
  }
  .btn-primary { background: #4dd9ff; color: #0a0c0f; }
  .btn-primary:hover { background: #7de8ff; box-shadow: 0 0 22px rgba(77,217,255,.3); }
  .btn-ghost {
    background: transparent; color: #5a6a7a;
    border: 1px solid #1e2630; font-size: .8rem;
  }
  .btn-ghost:hover { border-color: #2e3a4a; color: #c8d0dc; }
  .btn-danger {
    background: transparent; color: #ff6670;
    border: 1px solid rgba(255,102,112,.3); font-size: .8rem;
  }
  .btn-danger:hover {
    background: rgba(255,102,112,.08); border-color: rgba(255,102,112,.5);
  }
  .divider { height: 1px; background: #1e2630; margin: 1.5rem 0; }
  .notice {
    font-size: .7rem; color: #3a4a5a;
    text-align: center; line-height: 1.75;
  }
  .notice strong { color: #4a5a6a; }
  a { text-decoration: none; }
`;

function tierLabel(tier: SubscriptionTier): string {
  return TIER_DEFINITIONS[tier]?.displayName ?? tier;
}

function tierPrice(tier: SubscriptionTier, cycle: BillingCycle): string {
  const def = TIER_DEFINITIONS[tier];
  if (!def) return '?';
  const cents = cycle === 'annual' ? def.annualPriceCents : def.monthlyPriceCents;
  return `$${(cents / 100).toFixed(0)}`;
}

export function renderCheckoutPage(
  tier:         SubscriptionTier,
  billingCycle: BillingCycle,
  trialDays:    number,
  token:        string,
  sig:          string,
): string {
  const name  = tierLabel(tier);
  const price = tierPrice(tier, billingCycle);
  const cycle = billingCycle === 'annual' ? '/mo · billed annually' : '/mo';
  const saving = billingCycle === 'annual' ? '~20% savings vs monthly' : 'Switch to annual to save ~20%';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Checkout — R3 [SANDBOX]</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="badge">⚡ sandbox mode — no real charges</div>
    <h1>Complete your subscription</h1>
    <p class="sub">
      Local development checkout. No payment details are collected.<br/>
      Subscription state is written directly to your database.
    </p>

    <div class="plan-box">
      <div class="plan-label">R3 ${name}</div>
      <div class="plan-price">${price}<span>${cycle}</span></div>
      <div class="plan-cycle">${saving}</div>
    </div>

    <div class="trial-note">
      ✓ &nbsp;${trialDays}-day free trial included &mdash; cancel anytime
    </div>

    <form method="POST" action="/api/mock-billing/checkout">
      <input type="hidden" name="token" value="${token}"/>
      <input type="hidden" name="sig"   value="${sig}"/>
      <button type="submit" class="btn btn-primary">
        ✓ &nbsp;Activate ${name} Trial
      </button>
    </form>

    <a href="/api/mock-billing/cancel?token=${token}&sig=${sig}">
      <button class="btn btn-ghost">← Go back</button>
    </a>

    <div class="divider"></div>
    <p class="notice">
      <strong>SANDBOX</strong> — Simulates the full Stripe checkout flow.<br/>
      Set a real <strong>STRIPE_SECRET_KEY</strong> in <strong>.env</strong> to enable live billing.
    </p>
  </div>
</body>
</html>`;
}

export function renderPortalPage(
  tierName:     string,
  billingCycle: string | null,
  status:       string,
  periodEnd:    Date | null,
  token:        string,
  sig:          string,
): string {
  const periodStr = periodEnd
    ? periodEnd.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'N/A';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Billing Portal — R3 [SANDBOX]</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="card">
    <div class="badge">⚡ sandbox mode — mock billing portal</div>
    <h1>Manage subscription</h1>
    <p class="sub">Simulated billing portal. All changes apply immediately to your database.</p>

    <div class="plan-box">
      <div class="plan-label">Current Plan</div>
      <div class="detail">
        <strong>Plan</strong> &nbsp;&nbsp;&nbsp;${tierName}<br/>
        <strong>Status</strong> &nbsp;${status}<br/>
        <strong>Billing</strong> &nbsp;${billingCycle ?? 'N/A'}<br/>
        <strong>Renews</strong> &nbsp;${periodStr}
      </div>
    </div>

    <form method="POST" action="/api/mock-billing/portal/cancel"
          onsubmit="return confirm('Cancel subscription and revert to Explorer tier?')">
      <input type="hidden" name="token" value="${token}"/>
      <input type="hidden" name="sig"   value="${sig}"/>
      <button type="submit" class="btn btn-danger">
        Cancel subscription
      </button>
    </form>

    <a href="/api/mock-billing/portal/back?token=${token}&sig=${sig}">
      <button class="btn btn-ghost">← Back to app</button>
    </a>

    <div class="divider"></div>
    <p class="notice">
      <strong>SANDBOX</strong> — Simulates Stripe billing portal.<br/>
      Set a real <strong>STRIPE_SECRET_KEY</strong> in <strong>.env</strong> to enable the live portal.
    </p>
  </div>
</body>
</html>`;
}

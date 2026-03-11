/**
 * shared/subscription.types.ts
 *
 * Item 3 — Stripe Price IDs loaded from environment variables
 *
 * ROOT CAUSE: creator.stripePriceIdMonthly, creator.stripePriceIdAnnual,
 * pro_artist.stripePriceIdMonthly, pro_artist.stripePriceIdAnnual were all
 * hardcoded to empty string ''. createCheckoutSession() calls:
 *   if (!priceId) throw new Error(`No Stripe price configured for ${tier} ${billingCycle}`)
 * which means EVERY paid subscription upgrade attempt threw immediately,
 * before any Stripe API call was made. No user could ever upgrade.
 *
 * WHY THIS FIX IS CORRECT:
 * Price IDs are deployment-specific secrets — they belong in env vars, not
 * source code. The values are read once at module load via process.env.
 * In a browser bundle, Vite/webpack replaces process.env.X with undefined,
 * which falls back to null — safe because price IDs are never read client-side
 * (checkout is triggered server-side via tRPC). On the server they resolve to
 * the real Stripe price IDs.
 *
 * REQUIRED ENV VARS (add to .env and production secrets):
 *   STRIPE_CREATOR_MONTHLY_PRICE_ID=price_xxx
 *   STRIPE_CREATOR_YEARLY_PRICE_ID=price_xxx
 *   STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID=price_xxx
 *   STRIPE_PRO_ARTIST_YEARLY_PRICE_ID=price_xxx
 *
 * STARTUP GUARD: server/services/stripe-subscription.ts validates these are
 * set at startup — see the getPriceId() check there.
 */

export const SUBSCRIPTION_TIERS = ['explorer', 'creator', 'pro_artist'] as const;
export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'paused',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// ── Tier config ──────────────────────────────────────────────────────────────

export interface TierLimits {
  trackUploads: number | 'unlimited';
  savedProjects: number | 'unlimited';
  recordingMinutes: number | 'unlimited';
  aiTransitionsPerSession: number | 'unlimited';
  supportedFormats: ('mp3' | 'wav' | 'flac')[];
  exportFormats: ('mp3_320' | 'wav' | 'flac')[];
}

export interface TierFeatures {
  energyCurveAnalysis: boolean;
  keyCompatibility: boolean;
  aiMixDashboard: boolean;
  aiAutomixMode: boolean;
  transitionGraphEditor: boolean;
  effectsLibrary: 'basic' | 'full' | 'full_plus_custom';
  effectsPresets: boolean;
  effectsChainStacking: boolean;
  stemSeparation: boolean;
  rekordboxImport: boolean;
  seratolImport: boolean;
  projectSharing: boolean;
  sampleLibrary: 'starter' | 'full' | 'full_priority';
  tutorialLibrary: 'basic' | 'full';
  earlyAccess: boolean;
  support: 'community' | 'email_48h' | 'email_24h';
}

export interface TierDefinition {
  id: SubscriptionTier;
  displayName: string;
  tagline: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  /**
   * Stripe price IDs — null for explorer (free tier), loaded from env vars
   * for paid tiers. Never bundle these to the client.
   */
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
  limits: TierLimits;
  features: TierFeatures;
  color: string;
  badge?: string;
}

// ── Tier definitions (single source of truth) ────────────────────────────────
// Price IDs are read from environment variables so they never appear in source.
// typeof process === 'undefined' guard makes this safe in browser bundles.

const env = typeof process !== 'undefined' ? process.env : {};

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierDefinition> = {
  explorer: {
    id: 'explorer',
    displayName: 'Explorer',
    tagline: 'Start your journey — free forever',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    stripePriceIdMonthly: null,
    stripePriceIdAnnual: null,
    color: '#3A7D44',
    limits: {
      trackUploads: 10,
      savedProjects: 1,
      recordingMinutes: 0,
      aiTransitionsPerSession: 3,
      supportedFormats: ['mp3'],
      exportFormats: [],
    },
    features: {
      energyCurveAnalysis: false,
      keyCompatibility: false,
      aiMixDashboard: false,
      aiAutomixMode: false,
      transitionGraphEditor: false,
      effectsLibrary: 'basic',
      effectsPresets: false,
      effectsChainStacking: false,
      stemSeparation: false,
      rekordboxImport: false,
      seratolImport: false,
      projectSharing: false,
      sampleLibrary: 'starter',
      tutorialLibrary: 'basic',
      earlyAccess: false,
      support: 'community',
    },
  },

  creator: {
    id: 'creator',
    displayName: 'Creator',
    tagline: 'Your full creative studio',
    monthlyPriceCents: 1000,
    annualPriceCents: 800,
    // ROOT FIX: was hardcoded '' — now loaded from env vars
    stripePriceIdMonthly: env.STRIPE_CREATOR_MONTHLY_PRICE_ID ?? null,
    stripePriceIdAnnual: env.STRIPE_CREATOR_YEARLY_PRICE_ID ?? null,
    color: '#1A3C5E',
    badge: 'Most Popular',
    limits: {
      trackUploads: 200,
      savedProjects: 25,
      recordingMinutes: 60,
      aiTransitionsPerSession: 'unlimited',
      supportedFormats: ['mp3', 'wav', 'flac'],
      exportFormats: ['mp3_320'],
    },
    features: {
      energyCurveAnalysis: true,
      keyCompatibility: true,
      aiMixDashboard: true,
      aiAutomixMode: false,
      transitionGraphEditor: false,
      effectsLibrary: 'full',
      effectsPresets: true,
      effectsChainStacking: true,
      stemSeparation: false,
      rekordboxImport: false,
      seratolImport: false,
      projectSharing: false,
      sampleLibrary: 'full',
      tutorialLibrary: 'full',
      earlyAccess: false,
      support: 'email_48h',
    },
  },

  pro_artist: {
    id: 'pro_artist',
    displayName: 'Pro Artist',
    tagline: 'Perform without limits',
    monthlyPriceCents: 2500,
    annualPriceCents: 2000,
    // ROOT FIX: was hardcoded '' — now loaded from env vars
    stripePriceIdMonthly: env.STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID ?? null,
    stripePriceIdAnnual: env.STRIPE_PRO_ARTIST_YEARLY_PRICE_ID ?? null,
    color: '#B35A00',
    limits: {
      trackUploads: 'unlimited',
      savedProjects: 'unlimited',
      recordingMinutes: 'unlimited',
      aiTransitionsPerSession: 'unlimited',
      supportedFormats: ['mp3', 'wav', 'flac'],
      exportFormats: ['mp3_320', 'wav', 'flac'],
    },
    features: {
      energyCurveAnalysis: true,
      keyCompatibility: true,
      aiMixDashboard: true,
      aiAutomixMode: true,
      transitionGraphEditor: true,
      effectsLibrary: 'full_plus_custom',
      effectsPresets: true,
      effectsChainStacking: true,
      stemSeparation: true,
      rekordboxImport: true,
      seratolImport: true,
      projectSharing: true,
      sampleLibrary: 'full_priority',
      tutorialLibrary: 'full',
      earlyAccess: true,
      support: 'email_24h',
    },
  },
};

// ── Helper utilities ─────────────────────────────────────────────────────────

export function getTierDefinition(tier: SubscriptionTier): TierDefinition {
  return TIER_DEFINITIONS[tier];
}

export function tierAtLeast(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  const order: SubscriptionTier[] = ['explorer', 'creator', 'pro_artist'];
  return order.indexOf(userTier) >= order.indexOf(required);
}

export function canUseFeature(
  userTier: SubscriptionTier,
  feature: keyof TierFeatures,
): boolean {
  return !!TIER_DEFINITIONS[userTier].features[feature];
}

export function checkLimit(
  userTier: SubscriptionTier,
  limit: keyof TierLimits,
  currentUsage: number,
): { allowed: boolean; limit: number | 'unlimited'; remaining: number | 'unlimited' } {
  const def = TIER_DEFINITIONS[userTier].limits[limit];
  if (def === 'unlimited') return { allowed: true, limit: 'unlimited', remaining: 'unlimited' };
  const numericLimit = def as number;
  return {
    allowed: currentUsage < numericLimit,
    limit: numericLimit,
    remaining: Math.max(0, numericLimit - currentUsage),
  };
}

// ── User subscription state (returned from API) ──────────────────────────────

export interface UserSubscription {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
  stripeCustomerId: string | null;
}

export interface SubscriptionGateResult {
  allowed: boolean;
  requiredTier: SubscriptionTier;
  userTier: SubscriptionTier;
  upgradeUrl: string;
  message: string;
}
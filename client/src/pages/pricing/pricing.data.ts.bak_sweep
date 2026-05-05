/**
 * pricing.data.ts — Plan definitions derived from shared/subscription.types.ts
 *
 * PRICES come from TIER_DEFINITIONS.monthlyPriceCents / annualPriceCents
 * (divided by 100 for display). Never hardcode prices here — they live in
 * the shared source of truth so they stay in sync with Stripe configuration.
 *
 * BillingCycle is re-exported from shared — no local duplicate.
 *
 * Feature labels are UI-specific mappings of TierFeatures/TierLimits.
 * Canonical capability truth is in TIER_DEFINITIONS; labels here are
 * for display only.
 */

export type { BillingCycle } from '../../../../shared/subscription.types';
export type { SubscriptionTier as PlanId } from '../../../../shared/subscription.types';

import {
  TIER_DEFINITIONS,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
  type BillingCycle,
} from '../../../../shared/subscription.types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanFeature {
  readonly label:      string;
  readonly included:   boolean;
  readonly highlight?: boolean;
  readonly detail?:    string;
}

export interface StorageRow {
  readonly tier:     string;
  readonly tierKey:  SubscriptionTier;
  readonly uploads:  string;
  readonly projects: string;
  readonly stems:    string;
}

export interface Plan {
  readonly id:           SubscriptionTier;
  readonly name:         string;
  readonly tagline:      string;
  /** Dollars (not cents) — derived from TIER_DEFINITIONS */
  readonly monthlyPrice: number;
  readonly annualPrice:  number;
  readonly badge?:       string;
  readonly popular?:     true;
  readonly features:     readonly PlanFeature[];
  readonly cta:          string;
}

// ─── Helpers (pure functions, no React, unit-testable) ────────────────────────

export const resolvePrice    = (p: Plan, c: BillingCycle): number =>
  c === "annual" ? p.annualPrice : p.monthlyPrice;

export const _isCustomPricing = (p: Plan): boolean => p.monthlyPrice === -1;
export const isFree          = (p: Plan): boolean => p.monthlyPrice === 0;
export const annualTotal     = (p: Plan): number  => p.annualPrice * 12;

// ─── Feature label maps (UI only — canonical truth is in TIER_DEFINITIONS) ───

const FEATURES: Record<SubscriptionTier, readonly PlanFeature[]> = {
  explorer: [
    { label: "10 track uploads",              included: true  },
    { label: "1 saved project",               included: true  },
    { label: "3 AI transitions / session",    included: true  },
    { label: "mp3 playback",                  included: true  },
    { label: "Basic effects library",         included: true  },
    { label: "Community support",             included: true  },
    { label: "Energy curve analysis",         included: false },
    { label: "AI mix dashboard",              included: false },
    { label: "Cloud export",                  included: false },
    { label: "Stem separation",               included: false },
  ],
  creator: [
    { label: "200 track uploads",                        included: true                          },
    { label: "25 saved projects",                        included: true                          },
    { label: "Unlimited AI transitions",                 included: true, highlight: true         },
    { label: "mp3 / wav / flac playback",                included: true                          },
    { label: "mp3 320k export",                          included: true                          },
    { label: "60 min recording",                         included: true                          },
    { label: "Energy curve & key analysis",              included: true, highlight: true         },
    { label: "AI mix dashboard",                         included: true, highlight: true         },
    { label: "Full effects + chain stacking",            included: true                          },
    { label: "Email support (48h)",                      included: true                          },
  ],
  pro_artist: [
    { label: "Unlimited tracks & projects",              included: true, highlight: true         },
    { label: "Unlimited recording",                      included: true, highlight: true         },
    { label: "All export formats (wav / flac / mp3)",    included: true, highlight: true         },
    { label: "AI automix mode",                          included: true, highlight: true         },
    { label: "Transition graph editor",                  included: true, highlight: true         },
    { label: "Stem separation",                          included: true, highlight: true         },
    { label: "Rekordbox & Serato import",                included: true                          },
    { label: "Project sharing",                          included: true                          },
    { label: "Priority sample library + early access",   included: true                          },
    { label: "Email support (24h)",                      included: true                          },
  ],
};

const CTAS: Record<SubscriptionTier, string> = {
  explorer:   "Start Free",
  creator:    "Start Creator Trial",
  pro_artist: "Get Pro Artist",
};

// ─── PLANS — single source, derived, no hardcoded prices ─────────────────────

export const PLANS: readonly Plan[] = SUBSCRIPTION_TIERS.map(tierId => {
  const _def = TIER_DEFINITIONS[tierId];
  return {
    id:           tierId,
    name:         def.displayName,
    tagline:      def.tagline,
    monthlyPrice: def.monthlyPriceCents / 100,
    annualPrice:  def.annualPriceCents  / 100,
    badge:        def.badge,
    popular:      tierId === 'creator' ? true as const : undefined,
    features:     FEATURES[tierId],
    cta:          CTAS[tierId],
  } satisfies Plan;
});

// ─── Storage comparison rows ──────────────────────────────────────────────────

export const STORAGE_ROWS: readonly StorageRow[] = [
  { tier:"Explorer",   tierKey:"explorer",   uploads:"10 tracks",  projects:"1",         stems:"—"       },
  { tier:"Creator",    tierKey:"creator",    uploads:"200 tracks", projects:"25",        stems:"—"       },
  { tier:"Pro Artist", tierKey:"pro_artist", uploads:"Unlimited",  projects:"Unlimited", stems:"✓"       },
];

// ─── FAQ ─────────────────────────────────────────────────────────────────────

export const FAQ_ITEMS: readonly { q: string; a: string }[] = [
  {
    q: "Can I use my own audio hardware?",
    a: "Creator and Pro Artist support ASIO/CoreAudio routing via our Web MIDI + Web Audio bridge. Hardware I/O config panels are included in the Pro Artist tier.",
  },
  {
    q: "How does the AI mix assistant work?",
    a: "R3 sends session metadata (BPM, key, energy, EQ curves) to an on-platform model. Your audio never leaves your browser — only analysis data is transmitted.",
  },
  {
    q: "What happens to my projects if I downgrade?",
    a: "Projects are read-only above your plan's saved-project quota. Download or delete files to stay within limits. Nothing is automatically deleted.",
  },
  {
    q: "Can I import from Rekordbox or Serato?",
    a: "Yes — Rekordbox XML and Serato crate import are available on the Pro Artist tier. Creator and Explorer users can import standard audio files directly.",
  },
] as const;

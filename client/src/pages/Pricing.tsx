// ─────────────────────────────────────────────────────────────────────────────
// R3 · Pricing Page
// Drop into: client/src/pages/Pricing.tsx
// Add route in your router: <Route path="/pricing" element={<Pricing />} />
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionTier, TIER_DEFINITIONS } from '../../../shared/subscription.types';

const FEATURES_TABLE: { label: string; explorer: string; creator: string; pro_artist: string }[] =
  [
    { label: 'Tracks you can upload', explorer: 'Up to 10', creator: 'Up to 200', pro_artist: 'Unlimited' },
    { label: 'Audio formats', explorer: 'MP3', creator: 'MP3, WAV, FLAC', pro_artist: 'MP3, WAV, FLAC' },
    { label: 'Saved projects', explorer: '1', creator: '25', pro_artist: 'Unlimited' },
    { label: 'AI transitions per session', explorer: '3', creator: 'Unlimited', pro_artist: 'Unlimited' },
    { label: 'Energy curve analysis', explorer: '—', creator: '✓', pro_artist: '✓' },
    { label: 'Key compatibility matching', explorer: '—', creator: '✓', pro_artist: '✓' },
    { label: 'AI Mix Quality Dashboard', explorer: '—', creator: '✓', pro_artist: '✓' },
    { label: 'AI auto-mix mode', explorer: '—', creator: '—', pro_artist: '✓' },
    { label: 'Transition graph editor', explorer: '—', creator: '—', pro_artist: '✓' },
    { label: 'Effects library', explorer: 'Basic (5)', creator: 'Full (20+)', pro_artist: 'Full + custom' },
    { label: 'Save effects presets', explorer: '—', creator: '✓', pro_artist: '✓' },
    { label: 'Mix recording', explorer: '—', creator: 'Up to 60 min', pro_artist: 'Unlimited' },
    { label: 'Export quality', explorer: '—', creator: 'MP3 320kbps', pro_artist: 'WAV / FLAC lossless' },
    { label: 'Stem separation', explorer: '—', creator: '—', pro_artist: '✓' },
    { label: 'Rekordbox / Serato import', explorer: '—', creator: '—', pro_artist: '✓' },
    { label: 'Project collaboration', explorer: '—', creator: '—', pro_artist: '✓' },
    { label: 'Customer support', explorer: 'Community', creator: 'Email (48hr)', pro_artist: 'Priority (24hr)' },
    { label: 'Early access to new features', explorer: '—', creator: '—', pro_artist: '✓' },
  ];

const TIER_ORDER: SubscriptionTier[] = ['explorer', 'creator', 'pro_artist'];

export default function Pricing() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const { tier: currentTier, startCheckout, openPortal, isPaid, isLoading } = useSubscription();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  async function handleCTA(tier: SubscriptionTier) {
    if (tier === 'explorer') return; // already free
    if (tier === currentTier && isPaid) {
      await openPortal();
      return;
    }
    setLoadingTier(tier);
    try {
      await startCheckout(tier as Exclude<SubscriptionTier, 'explorer'>, billing);
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', background: '#f8f9fb', minHeight: '100vh' }}>
      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f2033 0%, #1A3C5E 100%)',
          color: '#fff',
          textAlign: 'center',
          padding: '80px 24px 64px',
        }}
      >
        <h1 style={{ margin: '0 0 12px', fontSize: '42px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Make music that sounds like you.
        </h1>
        <p style={{ margin: '0 0 40px', fontSize: '18px', color: '#a0bfd0', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' }}>
          Start free. Upgrade when you're ready. No pressure, ever.
        </p>

        {/* Billing toggle */}
        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '4px',
            gap: '4px',
          }}
        >
          {(['monthly', 'annual'] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBilling(cycle)}
              style={{
                padding: '8px 20px',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                fontWeight: billing === cycle ? 700 : 400,
                fontSize: '14px',
                background: billing === cycle ? '#fff' : 'transparent',
                color: billing === cycle ? '#1A3C5E' : '#a0bfd0',
                transition: 'all 0.15s',
              }}
            >
              {cycle === 'monthly' ? 'Monthly' : 'Annual · Save 20%'}
            </button>
          ))}
        </div>
      </div>

      {/* Tier cards */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: '0 24px',
          marginTop: '-32px',
          marginBottom: '64px',
        }}
      >
        {TIER_ORDER.map((tierId) => {
          const def = TIER_DEFINITIONS[tierId];
          const isCurrent = currentTier === tierId;
          const isPopular = tierId === 'creator';
          const priceCents = billing === 'annual' ? def.annualPriceCents : def.monthlyPriceCents;
          const isFree = priceCents === 0;

          let ctaLabel = isFree ? 'Get started free' : `Start 7-day free trial`;
          if (isCurrent && isPaid) ctaLabel = 'Manage subscription';
          if (isCurrent && !isPaid) ctaLabel = 'Current plan';
          if (loadingTier === tierId) ctaLabel = 'Redirecting…';

          return (
            <div
              key={tierId}
              style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '32px 28px',
                width: '300px',
                boxShadow: isPopular
                  ? `0 12px 40px rgba(26,60,94,0.18)`
                  : '0 4px 16px rgba(0,0,0,0.07)',
                border: isCurrent
                  ? `2px solid ${def.color}`
                  : isPopular
                  ? `2px solid ${def.color}`
                  : '2px solid transparent',
                position: 'relative',
                transform: isPopular ? 'translateY(-8px)' : 'none',
                transition: 'transform 0.2s',
              }}
            >
              {(def.badge || isCurrent) && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-14px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: isCurrent ? def.color : def.color,
                    color: '#fff',
                    padding: '4px 16px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isCurrent ? 'Your plan' : def.badge}
                </div>
              )}

              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: def.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {def.displayName}
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#777' }}>{def.tagline}</p>

              <div style={{ marginBottom: '24px' }}>
                {isFree ? (
                  <span style={{ fontSize: '36px', fontWeight: 800, color: '#1a1a1a' }}>Free</span>
                ) : (
                  <>
                    <span style={{ fontSize: '36px', fontWeight: 800, color: '#1a1a1a' }}>
                      ${(priceCents / 100).toFixed(0)}
                    </span>
                    <span style={{ fontSize: '14px', color: '#888' }}> / month</span>
                    {billing === 'annual' && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                        billed ${((priceCents / 100) * 12).toFixed(0)} annually
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={() => handleCTA(tierId)}
                disabled={isLoading || (isCurrent && !isPaid) || loadingTier !== null}
                style={{
                  width: '100%',
                  padding: '13px',
                  background:
                    isCurrent && !isPaid
                      ? '#e8e8e8'
                      : def.color,
                  color: isCurrent && !isPaid ? '#888' : '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: isCurrent && !isPaid ? 'default' : 'pointer',
                  fontWeight: 700,
                  fontSize: '14px',
                  marginBottom: '20px',
                  transition: 'opacity 0.2s',
                  opacity: loadingTier !== null && loadingTier !== tierId ? 0.6 : 1,
                }}
              >
                {ctaLabel}
              </button>

              {/* Key features list */}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {getKeyFeatures(tierId).map((f, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      marginBottom: '8px',
                      fontSize: '13px',
                      color: '#444',
                    }}
                  >
                    <span style={{ color: def.color, fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div style={{ maxWidth: '900px', margin: '0 auto 80px', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '24px', color: '#1A3C5E', marginBottom: '32px' }}>
          Full feature comparison
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={thStyle('left', '#1A3C5E')}>Feature</th>
                {TIER_ORDER.map((t) => (
                  <th key={t} style={thStyle('center', '#1A3C5E')}>
                    {TIER_DEFINITIONS[t].displayName}
                    {currentTier === t && (
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>
                        Your plan
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES_TABLE.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                  <td style={tdStyle('left')}>{row.label}</td>
                  {TIER_ORDER.map((t) => {
                    const val = row[t];
                    const isCheck = val === '✓';
                    const isDash = val === '—';
                    return (
                      <td
                        key={t}
                        style={{
                          ...tdStyle('center'),
                          color: isDash ? '#ccc' : isCheck ? '#2e7d32' : '#333',
                          fontWeight: isCheck ? 700 : 400,
                        }}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: '640px', margin: '0 auto 80px', padding: '0 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '24px', color: '#1A3C5E', marginBottom: '32px' }}>
          Questions
        </h2>
        {FAQ.map((item, i) => (
          <FAQItem key={i} q={item.q} a={item.a} />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function thStyle(align: 'left' | 'center', bg: string): React.CSSProperties {
  return {
    background: bg,
    color: '#fff',
    padding: '12px 16px',
    textAlign: align,
    fontSize: '13px',
    fontWeight: 600,
  };
}

function tdStyle(align: 'left' | 'center'): React.CSSProperties {
  return {
    padding: '10px 16px',
    textAlign: align,
    borderBottom: '1px solid #eee',
  };
}

function getKeyFeatures(tier: SubscriptionTier): string[] {
  const map: Record<SubscriptionTier, string[]> = {
    explorer: [
      'No download — runs in your browser',
      '2-deck mixing interface',
      'AI beat & BPM detection',
      'Upload up to 10 tracks',
      '3 AI transitions per session',
      'Community forums & basic tutorials',
    ],
    creator: [
      'Everything in Explorer',
      'Unlimited AI transitions',
      'Energy + key compatibility analysis',
      'AI Mix Quality Dashboard',
      '20+ studio-quality effects',
      'Record & export mixes (MP3 320kbps)',
      'Upload up to 200 tracks',
      '25 saved projects',
    ],
    pro_artist: [
      'Everything in Creator',
      'Unlimited tracks, projects & recording',
      'AI auto-mix mode',
      'Transition graph editor',
      'Stem separation',
      'Lossless export (WAV / FLAC)',
      'Rekordbox & Serato import',
      'Collaborate on projects',
    ],
  };
  return map[tier];
}

const FAQ = [
  {
    q: 'Do I need to download anything?',
    a: 'No. R3 runs entirely in your browser. Chrome and Edge give the best audio performance.',
  },
  {
    q: 'Can I try Creator before paying?',
    a: 'Yes — every paid plan starts with a 7-day free trial. No charge until the trial ends, and you can cancel any time.',
  },
  {
    q: 'What happens if I cancel?',
    a: "Your subscription stays active until the end of your billing period. After that you'll move to the Explorer free tier and keep access to everything you've saved.",
  },
  {
    q: 'Can I switch between monthly and annual?',
    a: 'Yes. You can change your billing cycle any time from your account settings. Switching to annual is prorated automatically.',
  },
  {
    q: 'Is my audio stored on R3 servers?',
    a: 'Tracks you upload are stored securely on our servers for playback within R3. We never share or process your audio with third parties without your consent. See our Privacy policy for full details.',
  },
  {
    q: 'I already use Serato / Rekordbox. Can I bring my library in?',
    a: 'Yes — on Pro Artist you can import your existing Rekordbox or Serato library including track metadata, BPM, and cue points.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: '1px solid #e5e7eb',
        cursor: 'pointer',
      }}
      onClick={() => setOpen((o) => !o)}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 0',
          fontWeight: 600,
          fontSize: '14px',
          color: '#1a1a1a',
          userSelect: 'none',
        }}
      >
        {q}
        <span style={{ fontSize: '18px', color: '#999', transition: 'transform 0.2s', transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
      </div>
      {open && (
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#555', lineHeight: 1.7 }}>{a}</p>
      )}
    </div>
  );
}

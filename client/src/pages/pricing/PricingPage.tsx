/**
 * PricingPage.tsx — R3 / NATIVE pricing experience
 *
 * Presentation follows the locked R3_Native_Auth_Color_Theme_Style.css
 * and its dedicated PRICING EXPERIENCE LAYER.
 *
 * Behavior remains in usePricing.ts.
 * Pricing data remains in pricing.data.ts.
 * This component intentionally contains no pricing hex palette.
 *
 * Route: <Route path="/pricing" component={PricingPage} />
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ChevronRight,
  Cpu,
  Layers,
  Loader2,
  Music2,
  Shield,
  Sparkles,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";

import "./PricingPage.css";

import {
  PLANS,
  STORAGE_ROWS,
  FAQ_ITEMS,
  annualTotal,
  isCustomPricing,
  isFree,
  resolvePrice,
} from "./pricing.data";
import type { BillingCycle, Plan } from "./pricing.data";

import { usePricing } from "./usePricing";
import type { SubscriptionTier } from "../../../../shared/subscription.types";

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGGER_DELAY = 0.07;
const FADE_DURATION = 0.45;

// ─── Static lookup maps ───────────────────────────────────────────────────────

const PLAN_ICON: Record<SubscriptionTier, React.ReactNode> = {
  explorer: <Music2 size={15} strokeWidth={1.8} />,
  creator: <Zap size={15} strokeWidth={1.8} />,
  pro_artist: <Layers size={15} strokeWidth={1.8} />,
};

const STAT_ITEMS = [
  { value: "< 3ms", label: "Audio latency", Icon: Cpu },
  { value: "4K+", label: "Active studios", Icon: Users },
  { value: "99.9%", label: "Uptime SLA", Icon: Shield },
  { value: "∞", label: "Track length", Icon: Layers },
] as const;

// ─── Animation helpers ───────────────────────────────────────────────────────

function useFadeUp(delay = 0) {
  const shouldReduceMotion = useReducedMotion();

  return shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: {
          delay,
          duration: FADE_DURATION,
          ease: "easeOut" as const,
        },
      };
}

// ─── Header ──────────────────────────────────────────────────────────────────

function PricingTopbar() {
  return (
    <header className="r3-pricing-topbar">
      <a className="r3-pricing-brand" href="/pricing" aria-label="R3 NATIVE pricing">
        <span className="r3-pricing-brand-mark" aria-hidden="true">
          R3
        </span>
        <span className="r3-pricing-brand-copy">
          <strong>R3//NATIVE</strong>
          <small>PRO AUDIO PLATFORM</small>
        </span>
      </a>

      <div className="r3-pricing-topbar-meta">
        <span className="r3-pricing-status">
          <span className="r3-pricing-status-led" aria-hidden="true" />
          SYSTEM / PRICING
        </span>
        <span className="r3-pricing-topbar-divider" aria-hidden="true" />
        <a href="/login?redirect=/pricing">SIGN IN</a>
      </div>
    </header>
  );
}

// ─── Billing toggle ──────────────────────────────────────────────────────────

function BillingToggle({
  cycle,
  onToggle,
  onSet,
}: {
  cycle: BillingCycle;
  onToggle: () => void;
  onSet: (c: BillingCycle) => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="billing" role="group" aria-label="Billing cycle">
      <button
        type="button"
        className={`billing-label ${cycle === "monthly" ? "is-active" : ""}`}
        onClick={() => onSet("monthly")}
        aria-pressed={cycle === "monthly"}
      >
        Monthly
      </button>

      <button
        type="button"
        className="billing-switch"
        data-cycle={cycle}
        onClick={onToggle}
        aria-label={`Switch to ${cycle === "monthly" ? "annual" : "monthly"} billing`}
        aria-pressed={cycle === "annual"}
      >
        <motion.span
          className="billing-switch-thumb"
          initial={false}
          animate={{
            x: cycle === "annual" ? 20 : 0,
          }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 40 }
          }
        />
      </button>

      <button
        type="button"
        className={`billing-label ${cycle === "annual" ? "is-active" : ""}`}
        onClick={() => onSet("annual")}
        aria-pressed={cycle === "annual"}
      >
        Annual
      </button>

      <AnimatePresence initial={false}>
        {cycle === "annual" && (
          <motion.span
            className="billing-save"
            initial={shouldReduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
          >
            Save ~20%
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Hero signal ─────────────────────────────────────────────────────────────

function HeroSignal() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="hero-signal" aria-label="R3 pricing capacity signal">
      <div className="hero-signal-label">
        SIGNAL / PLAN CAPACITY <span>LIVE</span>
      </div>

      <svg viewBox="0 0 760 62" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="signal-line cyan"
          d="M0 47 L44 46 L66 48 L84 39 L112 42 L139 24 L166 34 L198 30 L224 43 L255 39 L279 47 L307 44 L337 22 L361 35 L389 29 L418 43 L447 40 L470 50 L498 45 L525 33 L556 38 L580 25 L608 31 L637 20 L667 39 L700 35 L727 43 L760 40"
        />
        <path
          className="signal-line violet"
          d="M0 53 L35 52 L67 51 L91 54 L120 47 L150 49 L180 44 L214 48 L240 41 L270 45 L302 43 L330 47 L362 41 L397 45 L427 40 L455 44 L486 38 L520 41 L551 35 L586 39 L616 33 L651 36 L684 31 L718 35 L760 32"
        />
        <path
          className="signal-line magenta"
          d="M0 57 L48 56 L95 58 L142 54 L186 55 L230 51 L272 55 L319 53 L360 56 L406 49 L451 53 L497 48 L541 51 L589 45 L632 48 L675 44 L718 47 L760 43"
        />
        <path
          className="signal-line lime"
          d="M0 50 L42 49 L78 51 L111 45 L145 47 L181 38 L215 43 L249 41 L284 45 L321 39 L357 41 L395 36 L432 40 L468 34 L505 37 L543 31 L580 35 L617 29 L653 32 L689 26 L726 29 L760 26"
        />
      </svg>

      <div className="signal-scan" aria-hidden="true" />
      {!shouldReduceMotion && <div className="signal-noise" aria-hidden="true" />}
    </div>
  );
}

// ─── Price display ───────────────────────────────────────────────────────────

function PriceDisplay({
  plan,
  cycle,
}: {
  plan: Plan;
  cycle: BillingCycle;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (isFree(plan)) {
    return (
      <div className="plan-price">
        <span className="currency">$</span>
        <span className="amount">0</span>
        <span className="period">FOREVER</span>
      </div>
    );
  }

  if (isCustomPricing(plan)) {
    return (
      <div className="plan-price">
        <span className="custom-price">CUSTOM</span>
        <span className="period">CONTACT US</span>
      </div>
    );
  }

  const price = resolvePrice(plan, cycle);

  return (
    <>
      <div className="plan-price">
        <span className="currency">$</span>
        <motion.span
          key={`${plan.id}-${cycle}-${price}`}
          className="amount"
          initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {price}
        </motion.span>
        <span className="period">/ MO</span>
      </div>

      {cycle === "annual" && (
        <p className="plan-bill">
          BILLED ${annualTotal(plan)} / YEAR
        </p>
      )}
    </>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function PlanCta({
  plan,
  isPending,
  onCheckout,
}: {
  plan: Plan;
  isPending: boolean;
  onCheckout: (p: Plan) => void;
}) {
  return (
    <button
      type="button"
      className="plan-action"
      data-featured={plan.popular ? "true" : "false"}
      onClick={() => {
        if (!isPending) onCheckout(plan);
      }}
      disabled={isPending}
      aria-busy={isPending}
    >
      {isPending ? (
        <>
          <Loader2 size={13} className="animate-spin" />
          PROCESSING
        </>
      ) : (
        <>
          {plan.cta}
          <ChevronRight size={13} />
        </>
      )}
    </button>
  );
}

// ─── Feature row ─────────────────────────────────────────────────────────────

function FeatureRow({
  feature,
}: {
  feature: Plan["features"][number];
}) {
  return (
    <li
      className={`plan-feature ${feature.included ? "" : "is-excluded"} ${
        feature.highlight ? "emphasis" : ""
      }`}
    >
      <span className="plan-feature-mark" aria-hidden="true">
        {feature.included ? "✓" : "—"}
      </span>

      <span>
        <span className="plan-feature-label">{feature.label}</span>
        {feature.detail && feature.included && (
          <span className="plan-feature-detail">— {feature.detail}</span>
        )}
      </span>
    </li>
  );
}

// ─── Plan card ───────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  cycle,
  index,
  isPending,
  onCheckout,
}: {
  plan: Plan;
  cycle: BillingCycle;
  index: number;
  isPending: boolean;
  onCheckout: (p: Plan) => void;
}) {
  const fadeUpProps = useFadeUp(index * STAGGER_DELAY);

  return (
    <motion.article
      {...fadeUpProps}
      className={`plan tier-${plan.id} ${plan.popular ? "featured" : ""}`}
      aria-labelledby={`plan-title-${plan.id}`}
    >
      <div className="plan-head">
        <div className="plan-id">
          <span className="dot" aria-hidden="true" />
          <span className="plan-icon">{PLAN_ICON[plan.id]}</span>
          <span>{plan.name}</span>
        </div>

        {plan.badge && (
          <span className="plan-badge">
            {plan.badge}
          </span>
        )}

        {!plan.badge && plan.popular && (
          <span className="plan-badge">MOST POPULAR</span>
        )}
      </div>

      <h2 id={`plan-title-${plan.id}`} className="plan-title">
        {plan.name}
      </h2>

      <p className="plan-sub">{plan.tagline}</p>

      <PriceDisplay plan={plan} cycle={cycle} />

      <PlanCta
        plan={plan}
        isPending={isPending}
        onCheckout={onCheckout}
      />

      <ul className="plan-feature-list">
        {plan.features.map((feature) => (
          <FeatureRow
            key={`${plan.id}-${feature.label}`}
            feature={feature}
          />
        ))}
      </ul>
    </motion.article>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function StatsStrip() {
  const fadeUpProps = useFadeUp(0.2);

  return (
    <motion.div {...fadeUpProps} className="metrics" aria-label="Platform metrics">
      {STAT_ITEMS.map(({ value, label, Icon }) => (
        <div className="metric" key={label}>
          <div className="metric-icon-row">
            <Icon size={11} aria-hidden="true" />
            <span className="metric-k">{label}</span>
          </div>
          <span className="metric-v">{value}</span>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Storage comparison ─────────────────────────────────────────────────────

function StorageTable() {
  const fadeUpProps = useFadeUp(0.35);

  return (
    <motion.section
      {...fadeUpProps}
      className="comparison-panel"
      aria-labelledby="limits-title"
    >
      <div className="comparison-head">
        <Upload size={13} aria-hidden="true" />
        <span id="limits-title">LIMITS &amp; STORAGE</span>
      </div>

      <div className="comparison-grid">
        {STORAGE_ROWS.map((row) => (
          <div key={row.tierKey} className={`comparison-column tier-${row.tierKey}`}>
            <div className="comparison-tier">{row.tier}</div>

            <div className="comparison-item">
              <span>UPLOADS</span>
              <strong>{row.uploads}</strong>
            </div>

            <div className="comparison-item">
              <span>PROJECTS</span>
              <strong>{row.projects}</strong>
            </div>

            <div className="comparison-item">
              <span>STEMS</span>
              <strong>{row.stems}</strong>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="faq-shell" aria-labelledby="faq-title">
      <p id="faq-title" className="section-kicker">
        FREQUENTLY ASKED QUESTIONS
      </p>

      <div className="faq-list">
        {FAQ_ITEMS.map((item, index) => {
          const open = openIndex === index;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;

          return (
            <div className={`faq-item ${open ? "is-open" : ""}`} key={item.q}>
              <button
                id={buttonId}
                type="button"
                className="faq-button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                aria-controls={panelId}
              >
                <span>{item.q}</span>

                <motion.span
                  className="faq-chevron"
                  animate={{ rotate: open ? 90 : 0 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { duration: 0.2 }
                  }
                  aria-hidden="true"
                >
                  <ChevronRight size={13} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={{
                      duration: shouldReduceMotion ? 0 : 0.22,
                      ease: "easeInOut",
                    }}
                    className="faq-answer-wrap"
                  >
                    <div className="faq-answer">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Error toast ─────────────────────────────────────────────────────────────

function ErrorToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const toastRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    toastRef.current?.focus();
  }, []);

  return (
    <motion.div
      ref={toastRef}
      tabIndex={-1}
      className="error-toast"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle size={14} aria-hidden="true" />
      <span>{message}</span>

      <button
        type="button"
        className="error-toast-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        <X size={13} />
      </button>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const {
    cycle,
    setCycle,
    toggleCycle,
    checkoutStatus,
    initiateCheckout,
    clearError,
  } = usePricing();

  const pendingPlanId =
    checkoutStatus.type === "pending"
      ? checkoutStatus.planId
      : null;

  const headerFadeUp = useFadeUp(0);

  return (
    <div className="pricing-page">
      <div className="pricing-page-atmosphere" aria-hidden="true" />

      <PricingTopbar />

      <main className="pricing-stage">
        <div className="pricing-main">
          <motion.section
            {...headerFadeUp}
            className="pricing-hero"
            aria-labelledby="pricing-title"
          >
            <div className="hero-kicker">
              <span className="led" aria-hidden="true" />
              <Sparkles size={10} aria-hidden="true" />
              R3 V4 / SUBSCRIPTION
            </div>

            <h1 id="pricing-title">
              BUILD YOUR STUDIO.
              <br />
              <b>SCALE WHEN YOU&apos;RE READY.</b>
            </h1>

            <p className="hero-copy">
              Professional DJ &amp; DAW tools in the browser.{" "}
              <strong>No installs. No dongles.</strong>
            </p>

            <BillingToggle
              cycle={cycle}
              onToggle={toggleCycle}
              onSet={setCycle}
            />

            <HeroSignal />
          </motion.section>

          <StatsStrip />

          <section className="pricing-grid" aria-label="Subscription plans">
            {PLANS.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                cycle={cycle}
                index={index}
                isPending={pendingPlanId === plan.id}
                onCheckout={initiateCheckout}
              />
            ))}
          </section>

          <p className="pricing-note">
            <i aria-hidden="true" />
            <strong>14-day free trial on Creator &amp; Pro Artist</strong>
            <span>NO CREDIT CARD REQUIRED</span>
            <span>CANCEL ANYTIME</span>
            <i aria-hidden="true" />
          </p>

          <StorageTable />
          <FAQ />
        </div>
      </main>

      <footer className="r3-pricing-footer">
        <div className="r3-pricing-footer-brand">
          <strong>R3//NATIVE</strong>
          <span>BROWSER-NATIVE CREATIVE ENGINE</span>
        </div>

        <div className="r3-pricing-footer-slogan">
          <i aria-hidden="true" />
          CREATE · PRODUCE · PLAY · TRANSFORM
        </div>
      </footer>

      <AnimatePresence>
        {checkoutStatus.type === "error" && (
          <ErrorToast
            message={checkoutStatus.message}
            onDismiss={clearError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

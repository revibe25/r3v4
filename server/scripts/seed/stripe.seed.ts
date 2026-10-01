import { logger } from '../../lib/logger';
import Stripe from 'stripe';

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  throw new Error('STRIPE_SECRET_KEY is required for the Stripe seed.');
}

if (!stripeKey.startsWith('sk_test_')) {
  throw new Error(
    'Refusing to seed Stripe with a non-test secret key. ' +
      'This seed is TEST-only; use an sk_test_ key.',
  );
}

const stripe = new Stripe(stripeKey);

type PaidTier = 'creator' | 'pro_artist';
type BillingCycle = 'monthly' | 'annual';

const CATALOG = {
  creator: {
    productName: 'R3 Creator',
    productInternalId: 'creator',
    prices: {
      monthly: {
        amount: 1000,
        interval: 'month' as const,
        intervalCount: 1,
        key: 'STRIPE_CREATOR_MONTHLY_PRICE_ID',
      },
      annual: {
        amount: 9600,
        interval: 'year' as const,
        intervalCount: 1,
        key: 'STRIPE_CREATOR_YEARLY_PRICE_ID',
      },
    },
  },
  pro_artist: {
    productName: 'R3 Pro Artist',
    productInternalId: 'pro_artist',
    prices: {
      monthly: {
        amount: 2500,
        interval: 'month' as const,
        intervalCount: 1,
        key: 'STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID',
      },
      annual: {
        amount: 24000,
        interval: 'year' as const,
        intervalCount: 1,
        key: 'STRIPE_PRO_ARTIST_YEARLY_PRICE_ID',
      },
    },
  },
} as const;

async function findOrCreateProduct(
  tier: PaidTier,
  name: string,
  internalId: string,
): Promise<Stripe.Product> {
  const products = await stripe.products.list({ limit: 100, active: true });

  const existing = products.data.find(
    (product) => product.metadata.r3_tier === internalId,
  );

  if (existing) return existing;

  return stripe.products.create({
    name,
    metadata: {
      r3_tier: internalId,
      r3_source: 'r3v4-seed',
    },
  });
}

async function ensurePrice(
  tier: PaidTier,
  billingCycle: BillingCycle,
  product: Stripe.Product,
  config: {
    amount: number;
    interval: 'month' | 'year';
    intervalCount: number;
    key: string;
  },
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: 'recurring',
    limit: 100,
  });

  const existing = prices.data.find(
    (price) =>
      price.metadata.r3_tier === tier &&
      price.metadata.r3_billing_cycle === billingCycle,
  );

  if (existing) {
    const matches =
      existing.unit_amount === config.amount &&
      existing.currency === 'usd' &&
      existing.type === 'recurring' &&
      existing.recurring?.interval === config.interval &&
      existing.recurring?.interval_count === config.intervalCount &&
      existing.product === product.id;

    if (!matches) {
      throw new Error(
        `Existing Stripe Price ${existing.id} conflicts with the canonical ` +
          `${tier}/${billingCycle} definition. Refusing to create a duplicate.`,
      );
    }

    return existing;
  }

  return stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: config.amount,
    recurring: {
      interval: config.interval,
      interval_count: config.intervalCount,
    },
    metadata: {
      r3_tier: tier,
      r3_billing_cycle: billingCycle,
      r3_env_key: config.key,
      r3_source: 'r3v4-seed',
    },
  });
}

export async function seedStripe() {
  const result: Record<string, string> = {};

  for (const [tier, definition] of Object.entries(CATALOG) as [
    PaidTier,
    (typeof CATALOG)[PaidTier],
  ][]) {
    const product = await findOrCreateProduct(
      tier,
      definition.productName,
      definition.productInternalId,
    );

    for (const billingCycle of ['monthly', 'annual'] as const) {
      const price = await ensurePrice(
        tier,
        billingCycle,
        product,
        definition.prices[billingCycle],
      );

      result[definition.prices[billingCycle].key] = price.id;
    }
  }

  logger.info('Stripe TEST catalog verified/seeded');

  for (const [key, value] of Object.entries(result)) {
    logger.info(`${key}=${value}`);
  }
}

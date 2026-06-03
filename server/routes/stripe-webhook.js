// ─────────────────────────────────────────────────────────────────────────────
// R3 · Stripe Webhook Handler
// Drop into: server/routes/stripe-webhook.ts
// Register BEFORE bodyParser middleware in server/index.ts:
//   app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);
// ─────────────────────────────────────────────────────────────────────────────
import { logger } from '../lib/logger';
import { handleStripeWebhook } from '../services/stripe-subscription';
export async function stripeWebhookHandler(req, res) {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
    }
    try {
        // req.body must be the raw Buffer — use express.raw() on this route only
        await handleStripeWebhook(req.body, sig);
        res.json({ received: true });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Stripe webhook processing failed', { message, path: req.path });
        res.status(400).json({ error: message });
    }
}

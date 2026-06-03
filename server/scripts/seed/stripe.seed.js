import { logger } from '../../lib/logger';
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export async function seedStripe() {
    const products = await stripe.products.list({ limit: 100 });
    if (!products.data.find(p => p.metadata.internal_id === "monthly")) {
        await stripe.products.create({
            name: "Monthly Plan",
            metadata: { internal_id: "monthly" }
        });
    }
    logger.info("💳 Stripe seeded");
}

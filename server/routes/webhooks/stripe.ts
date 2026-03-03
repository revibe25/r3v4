import { Router } from "express";
import Stripe from "stripe";
import { db } from "../../db";
import { subscriptions } from "../../db/schema";
import { eq } from "drizzle-orm";

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover" as const,
});

router.post("/stripe", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return res.status(400).send("Webhook Error");
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const periodEnd = sub.items?.data?.[0]
      ? new Date((sub.items.data[0] as unknown as { current_period_end?: number }).current_period_end! * 1000)
      : null;

    await db.update(subscriptions)
      .set({ status: sub.status, ...(periodEnd && { currentPeriodEnd: periodEnd }) })
      .where(eq(subscriptions.stripeSubscriptionId, sub.id));
  }

  res.json({ received: true });
});

export default router;

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? (() => { throw new Error("STRIPE_SECRET_KEY is not set"); })());

export async function createCheckout(customerId: string, priceId: string) {
  return await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_URL ?? ''}/billing/success`,
    cancel_url: `${process.env.APP_URL ?? ''}/subscribe`
  });
}

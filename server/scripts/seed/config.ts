export function validateSeedEnv() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("❌ Seeding blocked in production");
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("❌ Missing Stripe key");
  }
}

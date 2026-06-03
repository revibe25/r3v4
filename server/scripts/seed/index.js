import { logger } from '../../lib/logger';
import { seedDatabase } from "./database.seed";
import { seedStripe } from "./stripe.seed";
import { validateSeedEnv } from "./config";
async function run() {
    validateSeedEnv();
    logger.info("🌱 Starting seed...");
    await seedDatabase();
    await seedStripe();
    logger.info("✅ Seed complete");
    process.exit(0);
}
run().catch(err => {
    logger.error("❌ Seed failed", err);
    process.exit(1);
});

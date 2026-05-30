import { logger } from '../../lib/logger';
import { db } from '../../db/index.js';

export async function seedDatabase() {
  // TODO: seed subscription plans when table shape is finalised
  // No subscriptionPlans table exists in current schema — stub until defined.

  logger.info("🗄️ Database seeded");
}

import { logger } from '../../lib/logger';

export async function seedDatabase() {
  await pg
    .insert(plans)
    .values([
      { id: "monthly", price: 999 },
      { id: "yearly", price: 9999 }
    ])
    .onConflictDoNothing();

  logger.info("🗄️ Database seeded");
}

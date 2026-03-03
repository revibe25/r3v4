import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { logger } from "../lib/logger";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/r3vibe";

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

export * from "./schema";

export async function testConnection() {
  try {
    await client`SELECT 1`;
    logger.info("✅ Database connection successful");
    return true;
  } catch (error) {
    logger.error("❌ Database connection failed", { error });
    return false;
  }
}

export async function closeConnection() {
  await client.end();
  logger.info("🔌 Database connection closed");
}

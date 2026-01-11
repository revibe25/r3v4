import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Database connection configuration
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/r3vibe";

// Create postgres client
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for use in other files
export * from "./schema";

// Test database connection
export async function testConnection() {
  try {
    await client`SELECT 1`;
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

// Close database connection (for graceful shutdown)
export async function closeConnection() {
  await client.end();
  console.log("🔌 Database connection closed");
}
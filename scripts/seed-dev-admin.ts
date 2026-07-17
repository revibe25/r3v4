import { db } from '../server/db/index';
import { users } from '../server/db/schema';
import bcrypt from 'bcrypt';

async function seedAdmin() {
  try {
    console.log('🌱 Seeding Earnest admin user...');
    
    const hashedPassword = await bcrypt.hash('dev-password-123', 10);
    
    await db.insert(users).values({
      id: 'earnest-admin-dev',
      email: 'earnestathepco@gmail.com',
      username: 'Earnest',
      password: hashedPassword,
      tier: 'pro_artist',
      isAdmin: true,
      // createdAt and updatedAt are auto-set by DB via defaultNow()
    }).onConflictDoNothing();
    
    console.log('✅ Seeded Earnest admin user');
    console.log('   Email: earnestathepco@gmail.com');
    console.log('   Password: dev-password-123');
    console.log('   Tier: pro_artist');
    console.log('   Admin: true');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

seedAdmin();

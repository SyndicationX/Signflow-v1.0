import { pool } from '../src/database/db';
import { hashPassword } from '../src/utils/password';

const ADMIN_EMAIL = 'admin@work.com';
const ADMIN_PASSWORD = '12345678';

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);

    if (existingUser.rows.length > 0) {
      console.log(`Admin user ${ADMIN_EMAIL} already exists — nothing to seed.`);
      await client.query('COMMIT');
      return;
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const orgResult = await client.query(
      `INSERT INTO organizations (name, plan, primary_color)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ['Admin Workspace', 'enterprise', '#2563eb'],
    );
    const organizationId = orgResult.rows[0].id as string;

    await client.query(
      `INSERT INTO users (email, password_hash, name, role, organization_id, email_verified)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ADMIN_EMAIL, passwordHash, 'Admin', 'owner', organizationId, true],
    );

    await client.query('COMMIT');
    console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

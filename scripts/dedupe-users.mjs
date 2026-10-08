import { Client } from 'pg';

const CONN = process.env.MIGRATE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

async function main() {
  const client = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('connected');

  // 1. Repoint related rows from duplicate users to the canonical (oldest) row per email
  const dups = await client.query(`
    WITH ranked AS (
      SELECT id, email, ROW_NUMBER() OVER (PARTITION BY email ORDER BY "createdAt" ASC, id ASC) AS rn
      FROM "User"
    )
    SELECT r.id AS dup_id, k.id AS keep_id
    FROM ranked r
    JOIN ranked k ON k.email = r.email AND k.rn = 1
    WHERE r.rn > 1
  `);
  console.log('duplicates to merge:', dups.rowCount);

  for (const row of dups.rows) {
    for (const table of ['Simulado', 'Tentativa', 'MonthlyUsage', 'QuestionFeedback']) {
      try {
        await client.query(`UPDATE "${table}" SET "userId" = $1 WHERE "userId" = $2`, [row.keep_id, row.dup_id]);
      } catch (e) {
        console.log(`  update ${table} skip:`, e.message);
      }
    }
    // MonthlyUsage has unique (userId, monthKey) — drop conflicting leftovers from dup
    try {
      await client.query(`
        DELETE FROM "MonthlyUsage" m
        USING "MonthlyUsage" k
        WHERE m."userId" = $1 AND k."userId" = $2 AND m."monthKey" = k."monthKey"
      `, [row.dup_id, row.keep_id]);
    } catch (e) { console.log('  monthlyUsage dedup skip:', e.message); }

    await client.query(`DELETE FROM "User" WHERE id = $1`, [row.dup_id]);
    console.log('  merged & deleted', row.dup_id, '->', row.keep_id);
  }

  // 2. Enforce unique email
  await client.query(`DROP INDEX IF EXISTS "User_email_key"`);
  const idx = await client.query(`CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`);
  console.log('unique email index created');

  const r = await client.query(`SELECT id,email,"isAdmin",(password IS NOT NULL) AS has_pw FROM "User" ORDER BY "createdAt"`);
  console.log('final users:', r.rowCount);
  r.rows.forEach(x => console.log(' ', x.email, '| admin:', x.isAdmin, '| pw:', x.has_pw));

  await client.end();
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });

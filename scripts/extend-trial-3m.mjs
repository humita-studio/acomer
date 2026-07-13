import postgres from 'postgres';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envFile = readFileSync(resolve('.env'), 'utf8');
const env = {};
envFile.split('\n').forEach((line) => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
    env[key.trim()] = value.trim();
  }
});

const connectionString = env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false });

async function main() {
  const before = await sql`
    SELECT slug, nombre, plan, billing_status, trial_ends_at, period_ends_at
    FROM restaurantes
    WHERE deleted_at IS NULL
    ORDER BY created_at
  `;

  console.log('--- Antes ---');
  for (const r of before) {
    console.log(
      `${r.slug.padEnd(20)} ${String(r.billing_status).padEnd(10)} trial=${r.trial_ends_at ?? 'null'} period=${r.period_ends_at ?? 'null'}`,
    );
  }

  // Extiende trial a 3 meses desde ahora para locales en trial o past_due
  // (no toca active/exempt/cancelled ni los que ya pagan).
  const updated = await sql`
    UPDATE restaurantes
    SET
      billing_status = 'trial',
      trial_ends_at = now() + interval '90 days'
    WHERE deleted_at IS NULL
      AND billing_status IN ('trial', 'past_due')
    RETURNING slug, billing_status, trial_ends_at
  `;

  console.log(`\n--- Actualizados: ${updated.length} ---`);
  for (const r of updated) {
    console.log(`${r.slug.padEnd(20)} ${r.billing_status} hasta ${r.trial_ends_at}`);
  }

  const skipped = before.filter(
    (r) => !['trial', 'past_due'].includes(r.billing_status),
  );
  if (skipped.length) {
    console.log(`\n--- Sin cambios (${skipped.length}): active/exempt/cancelled ---`);
    for (const r of skipped) {
      console.log(`${r.slug.padEnd(20)} ${r.billing_status}`);
    }
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

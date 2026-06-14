import postgres from 'postgres';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
const envFile = readFileSync(resolve('.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').replace(/^["']|["']$/g, '');
    env[key.trim()] = value.trim();
  }
});

const connectionString = env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL not found in .env');
  process.exit(1);
}

console.log('Connecting to:', connectionString.substring(0, 50) + '...');

const sql = postgres(connectionString, { prepare: false });

async function applyMigration(fileArg = null) {
  try {
    const migrationFile = fileArg || resolve('./drizzle/0000_powerful_meteorite.sql');
    const migrationSQL = readFileSync(migrationFile, 'utf8');
    
    // Split by statement-breakpoint comments and filter empty statements
    const statements = migrationSQL
      .split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`Applying ${statements.length} SQL statements...`);
    
    for (const statement of statements) {
      try {
        await sql.unsafe(statement);
        console.log('✓ Statement executed');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠ Skipped: Object already exists');
        } else {
          console.error('Statement failed:', statement.substring(0, 100));
          console.error('Error:', error);
          throw error;
        }
      }
    }
    
    console.log('✅ Migration applied successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

applyMigration(process.argv[2]);

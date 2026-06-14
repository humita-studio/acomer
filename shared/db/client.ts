import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize Drizzle.')
}

// Disable prefetch as it is not supported for Supabase pooler transaction mode.
export const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client, { schema })

export type DatabaseSchema = typeof schema
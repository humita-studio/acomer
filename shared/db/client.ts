import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize Drizzle.')
  }
  return connectionString
}

/**
 * Un solo cliente postgres por proceso.
 *
 * En Next.js (sobre todo en dev con HMR) el módulo se re-evalúa y, sin este
 * cache en `globalThis`, se abren pools nuevos sin cerrar los viejos. Con el
 * pooler de Supabase (límite ~200 clientes) eso termina en:
 *   PostgresError: (EMAXCONN) max client connections reached
 *
 * `max` bajo: el pooler en modo transaction (puerto 6543) no debe acaparar
 * muchas conexiones por instancia. En serverless conviene 1; en dev un poco
 * más permite requests concurrentes sin saturar el proyecto.
 */
const globalForDb = globalThis as typeof globalThis & {
  __acomer_pg?: ReturnType<typeof postgres>
  __acomer_drizzle?: ReturnType<typeof drizzle<typeof schema>>
}

function createClient() {
  const isProd = process.env.NODE_ENV === 'production'
  return postgres(getConnectionString(), {
    // Prefetch/prepared statements no son compatibles con el pooler transaction mode.
    prepare: false,
    max: isProd ? 3 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  })
}

export const client = globalForDb.__acomer_pg ?? createClient()
export const db = globalForDb.__acomer_drizzle ?? drizzle(client, { schema })

globalForDb.__acomer_pg = client
globalForDb.__acomer_drizzle = db

export type DatabaseSchema = typeof schema

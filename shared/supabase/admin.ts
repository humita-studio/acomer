import { createClient } from '@supabase/supabase-js'

import { getSupabaseSecretKey, getSupabaseUrl } from './config'

/**
 * Cliente administrativo de Supabase autenticado con la *secret key*.
 *
 * Tiene privilegios elevados (bypassa RLS y habilita `auth.admin`), por lo que
 * SOLO debe usarse en el servidor y jamás exponerse al navegador. A diferencia
 * del cliente de `server.ts`, no está ligado a las cookies del usuario ni
 * persiste sesión: es un cliente de servicio sin estado.
 *
 * Por seguridad este módulo no se reexporta desde `index.ts`; importalo
 * directamente desde `@/shared/supabase/admin` en código de servidor.
 */
export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

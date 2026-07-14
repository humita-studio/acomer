import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getSupabasePublishableKey, getSupabaseUrl } from './config'

/**
 * Un solo cliente browser por pestaña.
 * Crear uno nuevo en cada hook/efecto abre varios WebSockets de Realtime y
 * la campana del mozo puede no quedar suscripta al canal del admin.
 */
let browserClient: SupabaseClient | undefined

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey())
  return browserClient
}
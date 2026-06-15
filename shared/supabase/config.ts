export function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required to initialize Supabase.')
  }

  return supabaseUrl
}

export function getSupabasePublishableKey() {
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabasePublishableKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required to initialize Supabase.')
  }

  return supabasePublishableKey
}

/**
 * Secret key de Supabase (formato `sb_secret_...`, reemplaza a la antigua
 * service_role key). Otorga privilegios administrativos (bypassa RLS y habilita
 * `auth.admin`). NUNCA debe exponerse al navegador: por eso no lleva el prefijo
 * NEXT_PUBLIC_ y solo se lee en el servidor.
 */
export function getSupabaseSecretKey() {
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseSecretKey) {
    throw new Error('SUPABASE_SECRET_KEY is required for Supabase admin operations.')
  }

  return supabaseSecretKey
}
"use server"

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { getSupabasePublishableKey, getSupabaseUrl } from './config'

export async function createSupabaseServerClient() {
    const cookieStore = await cookies()

    return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
        cookies: {
            get(name) {
                return cookieStore.get(name)?.value
            },
            set(name, value, options) {
                try {
                    cookieStore.set(name, value, options)
                } catch {
                    // Server components cannot always mutate cookies; route handlers can.
                }
            },
            remove(name, options) {
                try {
                    cookieStore.set(name, '', { ...options, maxAge: 0 })
                } catch {
                    // Keep the helper usable in read-only server contexts.
                }
            },
        },
    })
}
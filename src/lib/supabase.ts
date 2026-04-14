import { createClient } from '@supabase/supabase-js';

// Try PUBLIC_ prefix first (Astro convention), fall back to non-prefixed
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl === 'your-supabase-project-url') {
    throw new Error(
        'SUPABASE_URL is required. Please check your .env file and make sure it contains a valid Supabase URL. ' +
        'Current value: ' + (supabaseUrl || 'undefined')
    );
}

if (!supabaseAnonKey || supabaseAnonKey === 'your-supabase-anon-key') {
    throw new Error(
        'SUPABASE_ANON_KEY is required. Please check your .env file and make sure it contains a valid Supabase anon key. ' +
        'Current value: ' + (supabaseAnonKey || 'undefined')
    );
}

/**
 * Shared anon-key client — use only for public data reads or auth token
 * validation (supabase.auth.getUser). Do NOT use this for user-owned data
 * because auth.uid() will be null and RLS will block the rows.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Create a per-request Supabase client that impersonates the authenticated
 * user by forwarding their JWT as the Authorization header.
 *
 * PostgREST will then set auth.uid() = user's UUID and use the `authenticated`
 * role, so RLS policies like `auth.uid() = user_id` work correctly on the
 * server — fixing the "session not found" class of bugs where server-side
 * queries return nothing because they run as anon.
 *
 * Usage: call this after requireAuth returns the token:
 *   const db = createAuthedClient(auth.token);
 */
export function createAuthedClient(accessToken: string) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${accessToken}` },
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

// Re-export commonly used types and utilities
export type { SupabaseClient } from '@supabase/supabase-js';

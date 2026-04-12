import { createClient } from '@supabase/supabase-js';

// Debug environment variables
console.log('Environment check:', {
    hasPublicSupabaseUrl: !!import.meta.env.PUBLIC_SUPABASE_URL,
    hasPublicSupabaseAnonKey: !!import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseUrl: !!import.meta.env.SUPABASE_URL,
    hasSupabaseAnonKey: !!import.meta.env.SUPABASE_ANON_KEY,
    envMode: import.meta.env.MODE,
});

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Re-export commonly used types and utilities
export type { SupabaseClient } from '@supabase/supabase-js';

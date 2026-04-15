import { supabase } from './supabase';
import type { Session, AuthError } from '@supabase/supabase-js';

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string, alias: string) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: alias,
                }
            }
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as AuthError };
    }
}

/**
 * Sign in a user with email and password
 */
export async function signIn(email: string, password: string) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as AuthError };
    }
}

/**
 * Sign out the current user
 */
export async function signOut() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { error: null };
    } catch (error) {
        return { error: error as AuthError };
    }
}

/**
 * Get the current session
 */
export async function getSession() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as AuthError };
    }
}

/**
 * Get the current user
 */
export async function getUser() {
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as AuthError };
    }
}

/**
 * Get user profile from profiles table
 */
export async function getProfileByUserId(userId: string) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, bio, created_at')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as AuthError };
    }
}

/**
 * Reset password for a user
 */
export async function resetPasswordForEmail(email: string) {
    try {
        const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/user/reset-password`,
        });
        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as AuthError };
    }
}

/**
 * Update user profile
 */
export async function updateProfile(user_id: string, username?: string, avatar_url?: string, bio?: string) {
    try {
        // Validate user_id
        if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
            throw new Error('Invalid user ID');
        }

        // Prepare updates with user_id for upsert
        const updates: {
            id: string;
            username?: string;
            avatar_url?: string;
            bio?: string;
        } = {
            id: user_id,
        };

        // Only add fields if they are provided and not empty
        if (username !== undefined && username.trim() !== '') {
            updates.username = username.trim();
        }

        if (avatar_url !== undefined && avatar_url.trim() !== '') {
            updates.avatar_url = avatar_url.trim();
        }

        if (bio !== undefined && bio.trim() !== '') {
            updates.bio = bio.trim();
        }

        const { data, error } = await supabase
            .from('profiles')
            .upsert(updates)
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as Error };
    }
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string) {
    try {
        const { data, error } = await supabase.auth.updateUser({
            password: newPassword,
        });
        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as AuthError };
    }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';
import { createAuthedClient } from '../../../lib/supabase';

export const prerender = false;

export const PATCH: APIRoute = async ({ request }) => {
    // Authenticate
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return jsonResponse({ error: 'Invalid JSON body' }, 400);
        }

        const updates: Record<string, string> = {};

        if (typeof body.bio === 'string') {
            updates.bio = body.bio.trim();
        }

        if (typeof body.username === 'string' && body.username.trim() !== '') {
            updates.username = body.username.trim();
        }

        // Must have at least one field to update
        if (Object.keys(updates).length === 0) {
            return jsonResponse({ error: 'No updatable fields provided' }, 400);
        }

        const db = createAuthedClient(auth.token);
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .update(updates)
            .eq('id', auth.userId)
            .select('id, username, avatar_url, bio, created_at')
            .single();

        if (profileError) {
            console.error('update-profile error:', profileError);
            return jsonResponse({ error: profileError.message || 'Failed to update profile' }, 500);
        }

        return jsonResponse({ success: true, profile });
    } catch (err) {
        console.error('update-profile unexpected error:', err);
        return jsonResponse({ error: 'Unexpected server error' }, 500);
    }
};

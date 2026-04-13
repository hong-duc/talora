/**
 * /api/sessions/[id]
 *
 * GET → return a single session with all its messages, ordered by created_at.
 *       Used by ChatWindow on mount to load the conversation history.
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const sessionId = params.id;
    if (!sessionId) return jsonResponse({ error: 'Session ID is required' }, 400);

    // Fetch the session — enforcing ownership via user_id
    const session = await fetchSession(sessionId, auth.userId);
    if (!session) return jsonResponse({ error: 'Session not found' }, 404);

    // Fetch all messages for this session in chronological order
    const messages = await fetchMessages(sessionId);

    return jsonResponse({ session, messages });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch a session row, ensuring it belongs to the requesting user.
 * Joins the story so ChatWindow can display the story title in the header.
 */
async function fetchSession(sessionId: string, userId: string) {
    const { data, error } = await supabase
        .from('story_sessions')
        .select(`
            id,
            title,
            story_id,
            start_id,
            created_at,
            updated_at,
            stories (
                id,
                title,
                description,
                setting,
                tone,
                world_rules,
                lore,
                characters,
                descriptiveness,
                dialogue_ratio,
                pacing,
                emotional_intensity,
                cover_image_url
            )
        `)
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

    if (error || !data) return null;
    return data;
}

/** Fetch all messages for the session, oldest first */
async function fetchMessages(sessionId: string) {
    const { data } = await supabase
        .from('messages')
        .select('id, session_id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

    return data ?? [];
}

/**
 * /api/sessions
 *
 * GET  → list the authenticated user's story sessions (sidebar data)
 * POST → create a new session for a story, inserting the opening message
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';

export const prerender = false;

// ─── GET /api/sessions ────────────────────────────────────────────────────────

/**
 * Returns all sessions for the current user, ordered by most recent activity.
 * Joins the story title so the sidebar can render without extra fetches.
 */
export const GET: APIRoute = async ({ request }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { data, error } = await supabase
        .from('story_sessions')
        .select(`
            id,
            title,
            created_at,
            updated_at,
            story_id,
            stories ( title, cover_image_url )
        `)
        .eq('user_id', auth.userId)
        .order('updated_at', { ascending: false });

    if (error) {
        return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ sessions: data ?? [] });
};

// ─── POST /api/sessions ───────────────────────────────────────────────────────

/**
 * Creates a new story session and inserts the opening message.
 *
 * Expected body: { story_id: string, start_id?: string }
 *
 * Flow:
 *  1. Validate the story exists
 *  2. Create the story_sessions row
 *  3. If start_id supplied, fetch the story_starts row and insert its
 *     first_message as the initial assistant message
 *  4. Return the new session
 */
export const POST: APIRoute = async ({ request }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Parse and validate request body
    const body = await parseBody(request);
    if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400);

    const { story_id, start_id } = body;
    if (!story_id) return jsonResponse({ error: 'story_id is required' }, 400);

    // 1. Verify the story exists and grab a title for the session
    const story = await fetchStory(story_id);
    if (!story) return jsonResponse({ error: 'Story not found' }, 404);

    // 2. Create the session row
    const session = await createSession({
        story_id,
        user_id: auth.userId,
        start_id: start_id ?? null,
        // Default session title = story title
        title: story.title,
    });
    if (!session) return jsonResponse({ error: 'Failed to create session' }, 500);

    // 3. Insert the opening message if a story_start was chosen
    if (start_id) {
        await insertOpeningMessage(session.id, start_id);
    }

    return jsonResponse({ session }, 201);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely parse the JSON request body; returns null on failure */
async function parseBody(request: Request): Promise<Record<string, any> | null> {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

/** Fetch a story record — only id and title needed here */
async function fetchStory(storyId: string): Promise<{ id: string; title: string } | null> {
    const { data, error } = await supabase
        .from('stories')
        .select('id, title')
        .eq('id', storyId)
        .single();

    if (error || !data) return null;
    return data;
}

/** Insert a story_sessions row and return it */
async function createSession(params: {
    story_id: string;
    user_id: string;
    start_id: string | null;
    title: string;
}) {
    const { data, error } = await supabase
        .from('story_sessions')
        .insert({
            story_id: params.story_id,
            user_id: params.user_id,
            start_id: params.start_id,
            title: params.title,
        })
        .select()
        .single();

    if (error || !data) return null;
    return data;
}

/**
 * Fetch the story_start and insert its first_message as the
 * first assistant message in the new session.
 */
async function insertOpeningMessage(sessionId: string, startId: string): Promise<void> {
    // Fetch the chosen opening scenario
    const { data: start } = await supabase
        .from('story_starts')
        .select('first_message')
        .eq('id', startId)
        .single();

    if (!start?.first_message) return;

    // Insert as role='assistant' — this is the AI's opening line
    await supabase.from('messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: start.first_message,
    });
}

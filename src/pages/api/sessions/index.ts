/**
 * /api/sessions
 *
 * GET  → list the authenticated user's story sessions (sidebar data)
 * POST → create a new session for a story, inserting the opening message
 *
 * NOTE — story_sessions.story_id has no FK to stories.id in the current
 * schema, so PostgREST auto-join syntax `stories ( title, ... )` returns
 * PGRST200 "Could not find a relationship".  We work around this by fetching
 * sessions first, then batch-loading story metadata in a second query and
 * merging them in memory.
 */

import type { APIRoute } from 'astro';
import { createAuthedClient } from '../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';
import type { SupabaseClient } from '../../../lib/supabase';

export const prerender = false;

// ─── GET /api/sessions ────────────────────────────────────────────────────────

export const GET: APIRoute = async ({ request }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const db = createAuthedClient(auth.token);

    // Step 1 — fetch sessions (no joins — story_sessions has no FK to stories)
    const { data: sessions, error } = await db
        .from('story_sessions')
        .select('id, title, created_at, updated_at, story_id')
        .eq('user_id', auth.userId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('[GET /api/sessions] query error:', error.message, error.code);
        return jsonResponse({ error: error.message }, 500);
    }

    if (!sessions || sessions.length === 0) {
        return jsonResponse({ sessions: [] });
    }

    // Step 2 — batch-load story metadata in one query, then merge in memory
    const storyIds = [...new Set(sessions.map((s) => s.story_id).filter(Boolean))];

    const { data: storiesData } = await db
        .from('stories')
        .select('id, title, cover_image_url')
        .in('id', storyIds);

    const storyMap = new Map((storiesData ?? []).map((s) => [s.id, s]));

    const result = sessions.map((s) => ({
        ...s,
        stories: storyMap.get(s.story_id) ?? null,
    }));

    return jsonResponse({ sessions: result });
};

// ─── POST /api/sessions ───────────────────────────────────────────────────────

/**
 * Creates a new story session and inserts the opening message.
 *
 * Expected body: { story_id: string, start_id?: string }
 *
 * Optimised flow:
 *  1. [requireAuth] + [parseBody]              → parallel
 *  2. [fetchStory]  + [fetchStoryStart]        → parallel
 *  3. createSession                             → sequential (needs story title)
 *  4. insertOpeningMessage                      → first_message already in memory
 */
export const POST: APIRoute = async ({ request }) => {
    const [auth, body] = await Promise.all([
        requireAuth(request),
        parseBody(request),
    ]);

    if (auth.error) return auth.error;
    if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400);

    const { story_id, start_id } = body;
    if (!story_id) return jsonResponse({ error: 'story_id is required' }, 400);

    const db = createAuthedClient(auth.token);

    const [story, storyStart] = await Promise.all([
        fetchStory(db, story_id),
        start_id ? fetchStoryStart(db, start_id) : Promise.resolve(null),
    ]);

    if (!story) return jsonResponse({ error: 'Story not found' }, 404);

    const { data: session, errorMessage: sessionError } = await createSession(db, {
        story_id,
        user_id: auth.userId,
        start_id: start_id ?? null,
        title: story.title,
    });

    if (!session) {
        return jsonResponse(
            { error: `Failed to create session: ${sessionError ?? 'unknown error'}` },
            500,
        );
    }

    if (storyStart?.first_message) {
        await insertOpeningMessage(db, session['id'] as string, storyStart.first_message);
    }

    return jsonResponse({ session }, 201);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseBody(request: Request): Promise<Record<string, any> | null> {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

async function fetchStory(
    db: SupabaseClient,
    storyId: string,
): Promise<{ id: string; title: string } | null> {
    const { data, error } = await db
        .from('stories')
        .select('id, title')
        .eq('id', storyId)
        .single();
    if (error || !data) return null;
    return data;
}

async function fetchStoryStart(
    db: SupabaseClient,
    startId: string,
): Promise<{ first_message: string } | null> {
    const { data } = await db
        .from('story_starts')
        .select('first_message')
        .eq('id', startId)
        .single();
    return data ?? null;
}

async function createSession(
    db: SupabaseClient,
    params: { story_id: string; user_id: string; start_id: string | null; title: string },
): Promise<{ data: Record<string, unknown> | null; errorMessage: string | null }> {
    const { data, error } = await db
        .from('story_sessions')
        .insert({
            story_id: params.story_id,
            user_id: params.user_id,
            start_id: params.start_id,
            title: params.title,
        })
        .select()
        .single();

    if (error) {
        console.error('[createSession] error:', error.message, error.code, error.hint);
        return { data: null, errorMessage: error.message };
    }
    if (!data) {
        return { data: null, errorMessage: 'Insert returned no data' };
    }
    return { data: data as unknown as Record<string, unknown>, errorMessage: null };
}

async function insertOpeningMessage(
    db: SupabaseClient,
    sessionId: string,
    firstMessage: string,
): Promise<void> {
    await db.from('messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: firstMessage,
    });
}

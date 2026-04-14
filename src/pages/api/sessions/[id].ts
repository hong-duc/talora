/**
 * /api/sessions/[id]
 *
 * GET → return a single session with all its messages, ordered by created_at.
 *       Used by ChatWindow on mount to load the conversation history.
 *
 * NOTE — story_sessions.story_id has no FK to stories.id in the current
 * schema, so PostgREST auto-join syntax `stories ( ... )` returns PGRST200.
 * We fetch the session row first (ownership check), then load the story and
 * messages in a parallel second round-trip.
 */

import type { APIRoute } from 'astro';
import { createAuthedClient } from '../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const sessionId = params.id;
    if (!sessionId) return jsonResponse({ error: 'Session ID is required' }, 400);

    const db = createAuthedClient(auth.token);

    // Step 1 — verify ownership (no join — avoids the missing FK issue)
    const { data: sessionRow, error: sessionErr } = await db
        .from('story_sessions')
        .select('id, title, story_id, start_id, created_at, updated_at')
        .eq('id', sessionId)
        .eq('user_id', auth.userId)
        .single();

    if (sessionErr || !sessionRow) {
        console.error('[GET /api/sessions/id] session query error:', sessionErr?.message, sessionErr?.code);
        return jsonResponse({ error: 'Session not found' }, 404);
    }

    // Step 2 — load story metadata, messages, and story_start in parallel
    const [storyResult, messagesResult, storyStartResult] = await Promise.all([
        db
            .from('stories')
            .select(
                'id, title, description, setting, tone, world_rules, lore, characters, ' +
                'descriptiveness, dialogue_ratio, pacing, emotional_intensity, auto_style, cover_image_url',
            )
            .eq('id', sessionRow.story_id)
            .single(),
        db
            .from('messages')
            .select('id, session_id, role, content, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true }),
        // Fetch story_start opening message when the session was started with one
        sessionRow.start_id
            ? db
                .from('story_starts')
                .select('id, title, first_message')
                .eq('id', sessionRow.start_id)
                .single()
            : Promise.resolve({ data: null, error: null }),
    ]);

    if (storyResult.error) {
        console.error('[GET /api/sessions/id] story query error:', storyResult.error.message);
    }

    const session = {
        ...sessionRow,
        stories: storyResult.data ?? null,
    };

    return jsonResponse({
        session,
        messages: messagesResult.data ?? [],
        // Provides the opening message so the client can display it even if the
        // DB insert failed or the session was loaded before the message was committed
        storyStart: storyStartResult.data ?? null,
    });
};

// ─── DELETE /api/sessions/[id] ────────────────────────────────────────────────

/**
 * Delete a session and all its messages (cascade handled by FK in DB).
 * Only the session owner can delete it.
 */
export const DELETE: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const sessionId = params.id;
    if (!sessionId) return jsonResponse({ error: 'Session ID is required' }, 400);

    const db = createAuthedClient(auth.token);

    // Verify ownership
    const { data: sessionRow } = await db
        .from('story_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', auth.userId)
        .single();

    if (!sessionRow) return jsonResponse({ error: 'Session not found' }, 404);

    // Delete all messages first (safety — should cascade but be explicit)
    await db.from('messages').delete().eq('session_id', sessionId);

    // Delete the session itself
    const { error: deleteErr } = await db
        .from('story_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', auth.userId);

    if (deleteErr) {
        console.error('[DELETE /api/sessions/id] delete error:', deleteErr.message);
        return jsonResponse({ error: deleteErr.message }, 500);
    }

    return jsonResponse({ success: true });
};

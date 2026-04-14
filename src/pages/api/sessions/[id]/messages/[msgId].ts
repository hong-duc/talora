/**
 * /api/sessions/[id]/messages/[msgId]
 *
 * PATCH  → edit the content of a single message.
 * DELETE → delete this message AND every message that follows it
 *          (keeps conversation coherent — you can't have the AI respond
 *           to a message that no longer exists).
 *
 * Both methods require the caller to own the parent session.
 */

import type { APIRoute } from 'astro';
import { createAuthedClient } from '../../../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../../../lib/api-auth';

export const prerender = false;

// ─── PATCH /api/sessions/[id]/messages/[msgId] ───────────────────────────────

export const PATCH: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id: sessionId, msgId } = params;
    if (!sessionId || !msgId) {
        return jsonResponse({ error: 'Session ID and Message ID are required' }, 400);
    }

    const body = await parseBody(request);
    const newContent = body?.content?.trim();
    if (!newContent) {
        return jsonResponse({ error: 'content is required' }, 400);
    }

    const db = createAuthedClient(auth.token);

    // Verify the session belongs to the user (ownership check via join)
    if (!(await ownsSession(db, sessionId, auth.userId))) {
        return jsonResponse({ error: 'Session not found' }, 404);
    }

    // Verify the message belongs to this session
    const { data: existing, error: fetchErr } = await db
        .from('messages')
        .select('id, session_id')
        .eq('id', msgId)
        .eq('session_id', sessionId)
        .single();

    if (fetchErr || !existing) {
        return jsonResponse({ error: 'Message not found' }, 404);
    }

    // Update content
    const { data: updated, error: updateErr } = await db
        .from('messages')
        .update({ content: newContent })
        .eq('id', msgId)
        .select()
        .single();

    if (updateErr || !updated) {
        return jsonResponse({ error: updateErr?.message ?? 'Update failed' }, 500);
    }

    return jsonResponse({ message: updated });
};

// ─── DELETE /api/sessions/[id]/messages/[msgId] ──────────────────────────────

export const DELETE: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { id: sessionId, msgId } = params;
    if (!sessionId || !msgId) {
        return jsonResponse({ error: 'Session ID and Message ID are required' }, 400);
    }

    const db = createAuthedClient(auth.token);

    // Ownership check
    if (!(await ownsSession(db, sessionId, auth.userId))) {
        return jsonResponse({ error: 'Session not found' }, 404);
    }

    // Fetch the target message to get its created_at
    const { data: target, error: fetchErr } = await db
        .from('messages')
        .select('id, created_at')
        .eq('id', msgId)
        .eq('session_id', sessionId)
        .single();

    if (fetchErr || !target) {
        return jsonResponse({ error: 'Message not found' }, 404);
    }

    // Delete this message AND everything after it in the same session
    const { error: deleteErr } = await db
        .from('messages')
        .delete()
        .eq('session_id', sessionId)
        .gte('created_at', target.created_at);   // >= this timestamp = this msg + all later

    if (deleteErr) {
        return jsonResponse({ error: deleteErr.message }, 500);
    }

    return jsonResponse({ success: true, deletedFrom: target.created_at });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ownsSession(
    db: ReturnType<typeof createAuthedClient>,
    sessionId: string,
    userId: string,
): Promise<boolean> {
    const { data } = await db
        .from('story_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
    return !!data;
}

async function parseBody(request: Request): Promise<Record<string, any> | null> {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

/**
 * /api/sessions/[id]/reroll
 *
 * POST → Re-generate the last AI reply for a session.
 *
 * Covers two UI use-cases:
 *  1. Retry after AI failure  — last message is from user, no assistant msg to remove.
 *  2. Reroll an existing reply — last message is from assistant; we delete it first,
 *     then regenerate from the remaining history (which ends with a user message).
 *
 * Flow:
 *  1. Auth + session ownership check
 *  2. Load AI config, story, scene-state in parallel
 *  3. If last message is from assistant → delete it
 *  4. Fetch updated history
 *  5. Call AI
 *  6. Insert new assistant message + touch session
 */

import type { APIRoute } from 'astro';
import { createAuthedClient } from '../../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { generateReply } from '../../../../lib/ai-client';
import { decryptApiKey } from '../../../../lib/ai-crypto';
import type { Message, Story, SceneState, AiProvider } from '../../../../lib/types';
import type { ResolvedAiConfig } from '../../../../lib/ai-client';
import type { SupabaseClient } from '../../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const sessionId = params.id;
    if (!sessionId) return jsonResponse({ error: 'Session ID is required' }, 400);

    const db = createAuthedClient(auth.token);

    // Ownership check
    const { data: session } = await db
        .from('story_sessions')
        .select('id, story_id')
        .eq('id', sessionId)
        .eq('user_id', auth.userId)
        .single();

    if (!session) return jsonResponse({ error: 'Session not found' }, 404);

    // Load AI config, story and scene state in parallel
    const [aiConfig, story, sceneState] = await Promise.all([
        loadAiConfig(db, auth.userId),
        fetchStory(db, session.story_id),
        fetchSceneState(db, sessionId),
    ]);

    if (!aiConfig) {
        return jsonResponse(
            { error: 'No AI configuration found. Please set one up in Settings.' },
            422,
        );
    }

    if (!story) return jsonResponse({ error: 'Story not found' }, 500);

    // Fetch all messages ordered by creation time
    const allMessages = await fetchMessages(db, sessionId);

    if (allMessages.length === 0) {
        return jsonResponse({ error: 'No messages to reroll — send a message first.' }, 422);
    }

    // Find the index of the LAST user message in the ordered list.
    // Working with array indices is immune to timestamp-tie non-determinism.
    const lastUserIdx = allMessages.reduce(
        (best, m, i) => (m.role === 'user' ? i : best),
        -1,
    );

    if (lastUserIdx === -1) {
        return jsonResponse(
            { error: 'Cannot reroll: send a message first so the story can continue.' },
            422,
        );
    }

    // Slice the history to include everything up to and including the last user
    // message — this is what the AI will see.
    const history = allMessages.slice(0, lastUserIdx + 1);

    // Delete every message that comes AFTER the last user message (by ID).
    // This is deterministic and unaffected by timestamp ties.
    const msgIdsToDelete = allMessages.slice(lastUserIdx + 1).map((m) => m.id).filter(Boolean);
    if (msgIdsToDelete.length > 0) {
        await db
            .from('messages')
            .delete()
            .eq('session_id', sessionId)
            .in('id', msgIdsToDelete);
    }

    // Call the AI
    let replyText: string;
    try {
        replyText = await generateReply(history, story, aiConfig, sceneState ?? undefined);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'AI call failed';
        console.error('[reroll] AI call failed:', message);
        return jsonResponse({ error: message }, 502);
    }

    // Persist new reply and touch session
    const { data: assistantMsg, error: insertErr } = await db
        .from('messages')
        .insert({ session_id: sessionId, role: 'assistant', content: replyText })
        .select()
        .single();

    await db
        .from('story_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

    if (insertErr || !assistantMsg) {
        return jsonResponse({ error: 'Failed to save AI reply' }, 500);
    }

    return jsonResponse({ message: assistantMsg });
};

// ─── Shared helpers (duplicated from messages.ts to keep files self-contained) ─

async function loadAiConfig(db: SupabaseClient, userId: string): Promise<ResolvedAiConfig | null> {
    const { data } = await db
        .from('ai_configs')
        .select('provider, model, api_key_enc, base_url, generation_params')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) return null;

    let apiKey: string;
    try {
        apiKey = await decryptApiKey(data.api_key_enc ?? '');
    } catch {
        return null;
    }
    if (!apiKey) return null;

    const gp = (data.generation_params ?? {}) as Record<string, unknown>;

    return {
        provider: data.provider as AiProvider,
        model: data.model,
        apiKey,
        baseUrl: data.base_url ?? undefined,
        maxTokens: typeof gp.max_tokens === 'number' ? gp.max_tokens : undefined,
        temperature: typeof gp.temperature === 'number' ? gp.temperature : undefined,
        topP: typeof gp.top_p === 'number' ? gp.top_p : undefined,
        topK: typeof gp.top_k === 'number' ? gp.top_k : undefined,
    };
}

async function fetchStory(db: SupabaseClient, storyId: string): Promise<Story | null> {
    const { data } = await db.from('stories').select('*').eq('id', storyId).single();
    return data ?? null;
}

async function fetchSceneState(db: SupabaseClient, sessionId: string): Promise<SceneState | null> {
    const { data } = await db
        .from('scene_states')
        .select('*')
        .eq('session_id', sessionId)
        .single();
    return data ?? null;
}

async function fetchMessages(db: SupabaseClient, sessionId: string): Promise<Message[]> {
    const { data } = await db
        .from('messages')
        .select('id, session_id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
    return (data ?? []) as Message[];
}

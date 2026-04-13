/**
 * /api/sessions/[id]/messages
 *
 * POST → save the user's message, call the AI, save its reply, return both.
 *
 * Flow:
 *  1. Authenticate + validate the session belongs to the user
 *  2. Save the user's message to `messages`
 *  3. Load the user's active AI config from `ai_configs`
 *  4. Fetch full message history + story record for the AI prompt
 *  5. Call the AI via ai-client.ts
 *  6. Save the assistant reply
 *  7. Update scene_states with any extracted context (best-effort)
 *  8. Touch story_sessions.updated_at so the sidebar sorts correctly
 *  9. Return the assistant message
 */

import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { generateReply } from '../../../../lib/ai-client';
import { decryptApiKey } from '../../../../lib/ai-crypto';
import type { Message, Story, SceneState, AiProvider } from '../../../../lib/types';
import type { ResolvedAiConfig } from '../../../../lib/ai-client';

export const prerender = false;

// ─── POST /api/sessions/[id]/messages ────────────────────────────────────────

export const POST: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const sessionId = params.id;
    if (!sessionId) return jsonResponse({ error: 'Session ID is required' }, 400);

    // Parse input
    const body = await parseBody(request);
    if (!body?.content?.trim()) {
        return jsonResponse({ error: 'Message content is required' }, 400);
    }
    const userText = body.content.trim();

    // 1. Confirm session ownership
    const session = await fetchSession(sessionId, auth.userId);
    if (!session) return jsonResponse({ error: 'Session not found' }, 404);

    // 2. Save the user's message
    const userMsg = await insertMessage(sessionId, 'user', userText);
    if (!userMsg) return jsonResponse({ error: 'Failed to save message' }, 500);

    // 3. Load the user's active AI config
    const aiConfig = await loadAiConfig(auth.userId);
    if (!aiConfig) {
        return jsonResponse(
            { error: 'No AI configuration found. Please set one up in Settings.' },
            422
        );
    }

    // 4. Fetch full history + story for the prompt
    const [history, story, sceneState] = await Promise.all([
        fetchMessages(sessionId),
        fetchStory(session.story_id),
        fetchSceneState(sessionId),
    ]);

    if (!story) return jsonResponse({ error: 'Story not found' }, 500);

    // 5. Call the AI — gracefully handle provider errors
    let replyText: string;
    try {
        replyText = await generateReply(history, story, aiConfig, sceneState ?? undefined);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'AI call failed';
        return jsonResponse({ error: message }, 502);
    }

    // 6. Save the assistant reply
    const assistantMsg = await insertMessage(sessionId, 'assistant', replyText);
    if (!assistantMsg) return jsonResponse({ error: 'Failed to save AI reply' }, 500);

    // 7. Touch session updated_at so the sidebar correctly re-sorts (best-effort)
    await touchSession(sessionId);

    return jsonResponse({ message: assistantMsg });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function parseBody(request: Request): Promise<{ content?: string } | null> {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

/** Verify the session exists and belongs to the user */
async function fetchSession(sessionId: string, userId: string) {
    const { data } = await supabase
        .from('story_sessions')
        .select('id, story_id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
    return data;
}

/** Insert one message row and return it */
async function insertMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
    const { data, error } = await supabase
        .from('messages')
        .insert({ session_id: sessionId, role, content })
        .select()
        .single();
    if (error) return null;
    return data as Message;
}

/**
 * Load the user's default (or first) AI config and decrypt the API key.
 * Returns null if no config is found, which triggers a 422 to prompt setup.
 */
async function loadAiConfig(userId: string): Promise<ResolvedAiConfig | null> {
    // Prefer the config marked as default; fall back to the most recently created
    const { data } = await supabase
        .from('ai_configs')
        .select('provider, model, api_key_enc, base_url, is_default')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (!data) return null;

    // Decrypt — this happens server-side only; the plaintext key never reaches the client
    const apiKey = await decryptApiKey(data.api_key_enc ?? '');

    return {
        provider: data.provider as AiProvider,
        model: data.model,
        apiKey,
        baseUrl: data.base_url ?? undefined,
    };
}

/** Fetch all messages in the session (for the AI context window) */
async function fetchMessages(sessionId: string): Promise<Message[]> {
    const { data } = await supabase
        .from('messages')
        .select('id, session_id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
    return (data ?? []) as Message[];
}

/** Fetch the story record for the system prompt */
async function fetchStory(storyId: string): Promise<Story | null> {
    const { data } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();
    return data ?? null;
}

/** Fetch the current scene state for added context in the AI prompt */
async function fetchSceneState(sessionId: string): Promise<SceneState | null> {
    const { data } = await supabase
        .from('scene_states')
        .select('*')
        .eq('session_id', sessionId)
        .single();
    return data ?? null;
}

/** Bump session updated_at so the sidebar re-sorts by recency */
async function touchSession(sessionId: string): Promise<void> {
    await supabase
        .from('story_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
}

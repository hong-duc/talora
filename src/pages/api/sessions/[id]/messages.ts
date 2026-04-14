/**
 * /api/sessions/[id]/messages
 *
 * POST → save the user's message, call the AI, save its reply, return it.
 *
 * Optimised flow (parallel where dependencies allow):
 *  1. requireAuth                                     → validates JWT
 *  2. fetchSession                                    → ownership check
 *  3. [insertUserMsg] + [loadAiConfig]
 *     + [fetchStory]  + [fetchSceneState]             → parallel after ownership confirmed
 *  4. fetchMessages                                   → after user msg committed
 *  5. generateReply                                   → AI call (blocking by nature)
 *  6. [insertAssistantMsg] + [touchSession]           → parallel DB writes
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

// ─── Debug logger ─────────────────────────────────────────────────────────────

/** Log debug info — always on server side, filtered by DEBUG flag in env */
function debug(step: string, ...args: unknown[]): void {
    // Always log in development; in production only if DEBUG_CHAT=true
    const isDev = import.meta.env.DEV;
    const isDebugEnabled = import.meta.env.DEBUG_CHAT === 'true';
    if (isDev || isDebugEnabled) {
        console.debug(`[chat/messages] ${step}`, ...args);
    }
}

// ─── POST /api/sessions/[id]/messages ────────────────────────────────────────

export const POST: APIRoute = async ({ request, params }) => {
    const t0 = Date.now();
    debug('▶ start', { sessionId: params.id });

    const auth = await requireAuth(request);
    if (auth.error) {
        debug('✗ auth failed');
        return auth.error;
    }
    debug('✓ auth', { userId: auth.userId });

    const sessionId = params.id;
    if (!sessionId) return jsonResponse({ error: 'Session ID is required' }, 400);

    // Parse input
    const body = await parseBody(request);
    if (!body?.content?.trim()) {
        return jsonResponse({ error: 'Message content is required' }, 400);
    }
    const userText = body.content.trim();
    debug('✓ parsed body', { charLen: userText.length });

    // Authenticated DB client — forwards the user's JWT so auth.uid() is set
    // in RLS. Required for ai_configs (strict `auth.uid() = user_id` policy)
    // and story_sessions/messages (user-scoped policies).
    const db = createAuthedClient(auth.token);

    // 1. Confirm session ownership before doing any writes
    const session = await fetchSession(db, sessionId, auth.userId);
    if (!session) {
        debug('✗ session not found', { sessionId });
        return jsonResponse({ error: 'Session not found' }, 404);
    }
    debug('✓ session', { sessionId, storyId: session.story_id });

    // 2. Persist the user message and load all AI context in parallel.
    //    These four operations are independent of each other:
    //      • insertUserMsg  — writes first so history is consistent afterwards
    //      • loadAiConfig   — needs auth.uid() from authenticated client (RLS)
    //      • fetchStory     — public read, but authenticated client is fine too
    //      • fetchSceneState — session-scoped, no cross-dependency
    debug('… parallel: insertUserMsg + loadAiConfig + fetchStory + fetchSceneState');
    const tParallel = Date.now();

    let userMsg: Message | null;
    let aiConfig: ResolvedAiConfig | null;
    let story: Story | null;
    let sceneState: SceneState | null;

    try {
        [userMsg, aiConfig, story, sceneState] = await Promise.all([
            insertMessage(db, sessionId, 'user', userText),
            loadAiConfig(db, auth.userId),
            fetchStory(db, session.story_id),
            fetchSceneState(db, sessionId),
        ]);
    } catch (err) {
        if (err instanceof DecryptionError) {
            debug('✗ decryption error', { userId: auth.userId });
            return jsonResponse({ error: err.message }, 422);
        }
        throw err; // Re-throw unexpected errors
    }

    debug(`✓ parallel done in ${Date.now() - tParallel}ms`, {
        userMsgId: userMsg?.id ?? null,
        hasAiConfig: !!aiConfig,
        storyTitle: story?.title ?? null,
        hasSceneState: !!sceneState,
    });

    if (!userMsg) {
        console.error('[chat/messages] failed to insert user message', { sessionId });
        return jsonResponse({ error: 'Failed to save message' }, 500);
    }

    if (!aiConfig) {
        debug('✗ no AI config found for user', { userId: auth.userId });
        return jsonResponse(
            { error: 'No AI configuration found. Please set one up in Settings.' },
            422,
        );
    }
    debug('✓ AI config', { provider: aiConfig.provider, model: aiConfig.model });

    if (!story) {
        console.error('[chat/messages] story not found', { storyId: session.story_id });
        return jsonResponse({ error: 'Story not found' }, 500);
    }
    debug('✓ story', {
        title: story.title,
        autoStyle: story.auto_style,
        hasTone: !!story.tone?.length,
        hasWorldRules: !!story.world_rules,
        hasLore: !!story.lore,
        characterCount: story.characters?.length ?? 0,
    });

    // 3. Fetch full message history — must happen AFTER userMsg is committed
    //    (Promise.all above guarantees the insert resolved before we reach here)
    const history = await fetchMessages(db, sessionId);
    debug('✓ history loaded', { messageCount: history.length });

    // 4. Call the AI — this is the dominant latency, nothing to parallelize here
    debug('… calling AI provider', {
        provider: aiConfig.provider,
        model: aiConfig.model,
        historyMessages: history.length,
    });
    const tAi = Date.now();

    let replyText: string;
    try {
        replyText = await generateReply(history, story, aiConfig, sceneState ?? undefined);
        debug(`✓ AI reply received in ${Date.now() - tAi}ms`, { replyLen: replyText.length });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'AI call failed';
        console.error('[chat/messages] AI call failed:', message, {
            provider: aiConfig.provider,
            model: aiConfig.model,
            sessionId,
            elapsedMs: Date.now() - tAi,
        });
        return jsonResponse({ error: message }, 502);
    }

    // 5. Save the assistant reply and bump session.updated_at in parallel
    debug('… saving assistant reply + touching session');
    const [assistantMsg] = await Promise.all([
        insertMessage(db, sessionId, 'assistant', replyText),
        touchSession(db, sessionId),
    ]);

    if (!assistantMsg) {
        console.error('[chat/messages] failed to insert assistant message', { sessionId });
        return jsonResponse({ error: 'Failed to save AI reply' }, 500);
    }

    debug(`✓ done — total ${Date.now() - t0}ms`, { assistantMsgId: assistantMsg.id });

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
async function fetchSession(db: SupabaseClient, sessionId: string, userId: string) {
    const { data } = await db
        .from('story_sessions')
        .select('id, story_id')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();
    return data;
}

/** Insert one message row and return it */
async function insertMessage(
    db: SupabaseClient,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
) {
    const { data, error } = await db
        .from('messages')
        .insert({ session_id: sessionId, role, content })
        .select()
        .single();
    if (error) {
        console.error('[chat/messages] insertMessage error:', error.message, { sessionId, role });
        return null;
    }
    return data as Message;
}

/**
 * Load the user's default (or first) AI config and decrypt the API key.
 * Returns null if no config is found, which triggers a 422 to prompt setup.
 *
 * Requires an authenticated client — the ai_configs RLS policy is strict:
 * `auth.uid() = user_id`. An anon-key client would always return nothing.
 */
async function loadAiConfig(db: SupabaseClient, userId: string): Promise<ResolvedAiConfig | null> {
    const { data, error } = await db
        .from('ai_configs')
        .select('provider, model, api_key_enc, base_url, is_default')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        debug('loadAiConfig DB error', { code: error.code, message: error.message });
    }

    if (!data) return null;

    // Decrypt — happens server-side only; plaintext key never reaches the client.
    // Wrap in try/catch: AES-256-GCM throws when the auth tag doesn't verify
    // (e.g. SETTINGS_ENCRYPTION_KEY was rotated after the key was stored).
    let apiKey: string;
    try {
        apiKey = await decryptApiKey(data.api_key_enc ?? '');
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[chat/messages] API key decryption failed — SETTINGS_ENCRYPTION_KEY may have changed:', msg, { userId });
        // Throw a typed error so the caller can return a 422 with a helpful message
        throw new DecryptionError('API key decryption failed. Please re-save your API key in Settings.');
    }

    if (!apiKey) {
        debug('loadAiConfig — empty API key after decryption', { userId });
        return null;
    }

    return {
        provider: data.provider as AiProvider,
        model: data.model,
        apiKey,
        baseUrl: data.base_url ?? undefined,
    };
}

/** Sentinel error thrown when AES-256-GCM decryption fails */
class DecryptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DecryptionError';
    }
}

/** Fetch all messages in the session (for the AI context window) */
async function fetchMessages(db: SupabaseClient, sessionId: string): Promise<Message[]> {
    const { data } = await db
        .from('messages')
        .select('id, session_id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
    return (data ?? []) as Message[];
}

/** Fetch the story record for the system prompt */
async function fetchStory(db: SupabaseClient, storyId: string): Promise<Story | null> {
    const { data } = await db.from('stories').select('*').eq('id', storyId).single();
    return data ?? null;
}

/** Fetch the current scene state for added context in the AI prompt */
async function fetchSceneState(db: SupabaseClient, sessionId: string): Promise<SceneState | null> {
    const { data } = await db
        .from('scene_states')
        .select('*')
        .eq('session_id', sessionId)
        .single();
    return data ?? null;
}

/** Bump session updated_at so the sidebar re-sorts by recency */
async function touchSession(db: SupabaseClient, sessionId: string): Promise<void> {
    await db
        .from('story_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
}

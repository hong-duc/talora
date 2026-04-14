/**
 * /api/user/ai-configs
 *
 * GET  → list the user's saved AI configurations (api_key NEVER returned)
 * POST → create a new AI configuration (api_key encrypted before storage)
 */

import type { APIRoute } from 'astro';
import { createAuthedClient } from '../../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { encryptApiKey, maskApiKey } from '../../../../lib/ai-crypto';
import type { AiProvider } from '../../../../lib/types';
import type { SupabaseClient } from '../../../../lib/supabase';

export const prerender = false;

// ─── GET /api/user/ai-configs ─────────────────────────────────────────────────

/**
 * Returns all configs for the user.
 * api_key_enc is replaced with api_key_masked ("••••••••") so the client
 * knows a key is saved without ever receiving the plaintext or ciphertext.
 */
export const GET: APIRoute = async ({ request }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Authenticated client required — ai_configs RLS: `auth.uid() = user_id`
    const db = createAuthedClient(auth.token);

    const { data, error } = await db
        .from('ai_configs')
        .select('id, name, provider, model, base_url, is_default, created_at, updated_at, api_key_enc')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: true });

    if (error) return jsonResponse({ error: error.message }, 500);

    // Strip the encrypted key — replace with a masked placeholder
    const configs = (data ?? []).map(maskConfig);

    return jsonResponse({ configs });
};

// ─── POST /api/user/ai-configs ────────────────────────────────────────────────

/**
 * Creates a new AI config.
 * Expected body: { name, provider, model, api_key, base_url?, is_default? }
 *
 * Flow:
 *  1. Validate required fields
 *  2. If is_default=true, clear existing defaults for this user first
 *  3. Encrypt the api_key before inserting
 *  4. Return the new config (masked)
 */
export const POST: APIRoute = async ({ request }) => {
    const [auth, body] = await Promise.all([
        requireAuth(request),
        parseBody(request),
    ]);

    if (auth.error) return auth.error;
    if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400);

    const validation = validateConfigBody(body);
    if (validation.error) return jsonResponse({ error: validation.error }, 400);

    // Authenticated client required — ai_configs RLS: `auth.uid() = user_id`
    const db = createAuthedClient(auth.token);

    // If this config is being set as default, clear other defaults first
    if (body.is_default) {
        await clearDefaults(db, auth.userId);
    }

    // Encrypt api_key before storage — plaintext never touches the DB
    const api_key_enc = await encryptApiKey(body.api_key ?? '');

    const { data, error } = await db
        .from('ai_configs')
        .insert({
            user_id: auth.userId,
            name: body.name.trim(),
            provider: body.provider,
            model: body.model.trim(),
            api_key_enc,
            base_url: body.base_url?.trim() || null,
            is_default: body.is_default ?? false,
        })
        .select()
        .single();

    if (error || !data) return jsonResponse({ error: error?.message ?? 'Insert failed' }, 500);

    return jsonResponse({ config: maskConfig(data) }, 201);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip api_key_enc, replace with masked indicator */
function maskConfig(row: Record<string, any>) {
    const { api_key_enc, ...rest } = row;
    return { ...rest, api_key_masked: maskApiKey(api_key_enc ?? '') };
}

async function parseBody(request: Request): Promise<Record<string, any> | null> {
    try { return await request.json(); } catch { return null; }
}

/** Validate required config fields */
function validateConfigBody(body: Record<string, any>): { error?: string } {
    if (!body.name?.trim()) return { error: 'name is required' };
    if (!body.provider) return { error: 'provider is required' };
    if (!body.model?.trim()) return { error: 'model is required' };

    const validProviders: AiProvider[] = ['deepseek', 'openrouter', 'langdb', 'custom'];
    if (!validProviders.includes(body.provider)) {
        return { error: `provider must be one of: ${validProviders.join(', ')}` };
    }

    // Custom provider must have a base_url
    if (body.provider === 'custom' && !body.base_url?.trim()) {
        return { error: 'base_url is required for custom provider' };
    }

    return {};
}

/** Set all configs for this user to is_default=false before marking a new default */
async function clearDefaults(db: SupabaseClient, userId: string): Promise<void> {
    await db
        .from('ai_configs')
        .update({ is_default: false })
        .eq('user_id', userId);
}

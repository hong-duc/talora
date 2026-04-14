/**
 * /api/user/ai-configs/[id]
 *
 * PUT    → update an existing AI config (re-encrypts api_key if a new one is provided)
 * DELETE → remove a config
 */

import type { APIRoute } from 'astro';
import { createAuthedClient } from '../../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { encryptApiKey, maskApiKey } from '../../../../lib/ai-crypto';
import type { AiProvider } from '../../../../lib/types';
import type { SupabaseClient } from '../../../../lib/supabase';

export const prerender = false;

// ─── PUT /api/user/ai-configs/[id] ───────────────────────────────────────────

/**
 * Update an existing config.
 * If api_key is provided in the body (non-empty, non-masked), it is re-encrypted.
 * If api_key is omitted or is the mask placeholder, the stored key is kept as-is.
 */
export const PUT: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const configId = params.id;
    if (!configId) return jsonResponse({ error: 'Config ID is required' }, 400);

    // Authenticated client required — ai_configs RLS: `auth.uid() = user_id`
    const db = createAuthedClient(auth.token);

    // Confirm ownership before update
    const existing = await fetchOwnedConfig(db, configId, auth.userId);
    if (!existing) return jsonResponse({ error: 'Config not found' }, 404);

    const body = await parseBody(request);
    if (!body) return jsonResponse({ error: 'Invalid JSON body' }, 400);

    // Validate provider if it's being changed
    if (body.provider) {
        const validProviders: AiProvider[] = ['deepseek', 'openrouter', 'langdb', 'custom'];
        if (!validProviders.includes(body.provider)) {
            return jsonResponse({ error: `Invalid provider: ${body.provider}` }, 400);
        }
        // Custom provider must have a base_url (either new or already stored)
        const newBaseUrl = body.base_url?.trim() || existing.base_url;
        if (body.provider === 'custom' && !newBaseUrl) {
            return jsonResponse({ error: 'base_url is required for custom provider' }, 400);
        }
    }

    // Build update payload — only include fields that were actually provided
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body.name?.trim()) updates.name = body.name.trim();
    if (body.provider) updates.provider = body.provider;
    if (body.model?.trim()) updates.model = body.model.trim();
    if (body.base_url !== undefined) updates.base_url = body.base_url?.trim() || null;

    // Only re-encrypt the key if a real new value was sent
    // The masked placeholder ("••••••••") means "keep existing key"
    const isNewKey = body.api_key && body.api_key !== existing.api_key_masked;
    if (isNewKey) {
        updates.api_key_enc = await encryptApiKey(body.api_key);
    }

    // Handle default switching: if setting to default, clear others first
    if (body.is_default === true) {
        await clearDefaults(db, auth.userId);
        updates.is_default = true;
    } else if (body.is_default === false) {
        updates.is_default = false;
    }

    const { data, error } = await db
        .from('ai_configs')
        .update(updates)
        .eq('id', configId)
        .eq('user_id', auth.userId)       // defense-in-depth ownership check
        .select()
        .single();

    if (error || !data) return jsonResponse({ error: error?.message ?? 'Update failed' }, 500);

    // Return the updated config with the key masked
    const { api_key_enc, ...rest } = data;
    return jsonResponse({ config: { ...rest, api_key_masked: maskApiKey(api_key_enc ?? '') } });
};

// ─── DELETE /api/user/ai-configs/[id] ────────────────────────────────────────

/** Remove a config. The user must own it. */
export const DELETE: APIRoute = async ({ request, params }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const configId = params.id;
    if (!configId) return jsonResponse({ error: 'Config ID is required' }, 400);

    // Authenticated client required — ai_configs RLS: `auth.uid() = user_id`
    const db = createAuthedClient(auth.token);

    const { error } = await db
        .from('ai_configs')
        .delete()
        .eq('id', configId)
        .eq('user_id', auth.userId);   // only delete rows the user owns

    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ success: true });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch a config row and confirm it belongs to the user */
async function fetchOwnedConfig(db: SupabaseClient, configId: string, userId: string) {
    const { data } = await db
        .from('ai_configs')
        .select('id, api_key_enc, base_url')
        .eq('id', configId)
        .eq('user_id', userId)
        .single();
    // Expose a synthetic masked field alongside the raw enc for comparison
    if (!data) return null;
    return { ...data, api_key_masked: maskApiKey(data.api_key_enc ?? '') };
}

async function parseBody(request: Request): Promise<Record<string, any> | null> {
    try { return await request.json(); } catch { return null; }
}

/** Clear all default flags for a user before promoting a new default */
async function clearDefaults(db: SupabaseClient, userId: string): Promise<void> {
    await db
        .from('ai_configs')
        .update({ is_default: false })
        .eq('user_id', userId);
}

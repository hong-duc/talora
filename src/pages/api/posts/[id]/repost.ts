/**
 * /api/posts/[id]/repost
 *
 * POST   — Repost a post (with optional quote text).
 * DELETE — Remove own repost.
 */

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { createAuthedClient } from '../../../../lib/supabase';
import type { RepostRequest } from '../../../../lib/api-types';

export const prerender = false;

// ─── POST /api/posts/[id]/repost ───────────────────────────────────────────────

export const POST: APIRoute = async ({ params, request }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    let body: RepostRequest = {};
    try {
        body = await request.json();
    } catch {
        // Optional body
    }

    const db = createAuthedClient(auth.token);

    // Check if already reposted
    const { data: existing } = await db
        .from('post_reposts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', auth.userId)
        .maybeSingle();

    if (existing) {
        return jsonResponse({ error: 'You have already reposted this post.' }, 409);
    }

    const { data: repost, error } = await db
        .from('post_reposts')
        .insert({
            post_id: postId,
            user_id: auth.userId,
            quote_content: body.quote_content?.trim() || null,
        })
        .select('id, post_id, user_id, quote_content, created_at')
        .single();

    if (error) {
        console.error('Repost error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    // Increment repost_count
    const { data: post } = await db
        .from('posts')
        .select('repost_count')
        .eq('id', postId)
        .single();
    const newCount = (post?.repost_count || 0) + 1;
    await db.from('posts').update({ repost_count: newCount }).eq('id', postId);

    return jsonResponse({ success: true, repost }, 201);
};

// ─── DELETE /api/posts/[id]/repost ─────────────────────────────────────────────

export const DELETE: APIRoute = async ({ params, request }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const db = createAuthedClient(auth.token);

    // Check if repost exists
    const { data: existing } = await db
        .from('post_reposts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', auth.userId)
        .maybeSingle();

    if (!existing) {
        return jsonResponse({ error: 'You have not reposted this post.' }, 404);
    }

    const { error } = await db
        .from('post_reposts')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', auth.userId);

    if (error) {
        console.error('Unrepost error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    // Decrement repost_count
    const { data: post } = await db
        .from('posts')
        .select('repost_count')
        .eq('id', postId)
        .single();
    const newCount = Math.max(0, (post?.repost_count || 1) - 1);
    await db.from('posts').update({ repost_count: newCount }).eq('id', postId);

    return jsonResponse({ success: true });
};
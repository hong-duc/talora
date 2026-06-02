/**
 * /api/posts/[id]
 *
 * GET    — Get a single post by ID.
 * PUT    — Update own post (content, visibility).
 * DELETE — Soft-delete own post (sets is_deleted = true).
 */

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';
import { createAuthedClient, supabase } from '../../../lib/supabase';
import type { UpdatePostRequest } from '../../../lib/api-types';

export const prerender = false;

// ─── GET /api/posts/[id] ───────────────────────────────────────────────────────

export const GET: APIRoute = async ({ params, request }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    // Try to get the current user ID from Bearer token (optional)
    let userId: string | null = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const { data } = await supabase.auth.getUser(authHeader.slice(7));
        userId = data?.user?.id ?? null;
    }

    const db = userId
        ? createAuthedClient(authHeader!.slice(7))
        : supabase;

    const { data: post, error } = await db
        .from('posts')
        .select(`
            id,
            content,
            author_id,
            story_id,
            character_id,
            image_urls,
            visibility,
            like_count,
            comment_count,
            repost_count,
            is_deleted,
            created_at,
            updated_at,
            author:profiles!posts_author_id_fkey(id, username, avatar_url),
            story:stories!posts_story_id_fkey(id, title),
            character:characters!posts_character_id_fkey(id, name, avatar_url)
        `)
        .eq('id', postId)
        .single();

    if (error || !post) {
        return jsonResponse({ error: 'Post not found.' }, 404);
    }

    let liked_by_me = false;
    let reposted_by_me = false;

    if (userId) {
        const [{ data: likes }, { data: reposts }] = await Promise.all([
            db.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
            db.from('post_reposts').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle(),
        ]);
        liked_by_me = !!likes;
        reposted_by_me = !!reposts;
    }

    return jsonResponse({
        post: { ...post, liked_by_me, reposted_by_me },
    });
};

// ─── PUT /api/posts/[id] ───────────────────────────────────────────────────────

export const PUT: APIRoute = async ({ params, request }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Verify ownership
    const db = createAuthedClient(auth.token);

    const { data: existing } = await db
        .from('posts')
        .select('author_id, is_deleted')
        .eq('id', postId)
        .single();

    if (!existing) return jsonResponse({ error: 'Post not found.' }, 404);
    if (existing.author_id !== auth.userId) {
        return jsonResponse({ error: 'You can only edit your own posts.' }, 403);
    }
    if (existing.is_deleted) return jsonResponse({ error: 'Cannot edit a deleted post.' }, 400);

    let body: UpdatePostRequest;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }

    const updates: Record<string, any> = {};
    if (body.content !== undefined) {
        if (!body.content.trim()) return jsonResponse({ error: 'Content cannot be empty.' }, 400);
        if (body.content.length > 5000) return jsonResponse({ error: 'Content too long.' }, 400);
        updates.content = body.content.trim();
    }
    if (body.visibility !== undefined) {
        const valid = ['public', 'followers', 'unlisted'];
        if (!valid.includes(body.visibility)) {
            return jsonResponse({ error: `Visibility must be one of: ${valid.join(', ')}` }, 400);
        }
        updates.visibility = body.visibility;
    }

    if (Object.keys(updates).length === 0) {
        return jsonResponse({ error: 'No valid fields to update.' }, 400);
    }

    const { data: updated, error } = await db
        .from('posts')
        .update(updates)
        .select(`
            id,
            content,
            author_id,
            story_id,
            character_id,
            image_urls,
            visibility,
            like_count,
            comment_count,
            repost_count,
            created_at,
            updated_at,
            author:profiles!posts_author_id_fkey(id, username, avatar_url)
        `)
        .eq('id', postId)
        .single();

    if (error) {
        console.error('PUT /api/posts/[id] error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true, post: updated });
};

// ─── DELETE /api/posts/[id] ────────────────────────────────────────────────────

export const DELETE: APIRoute = async ({ params, request }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const db = createAuthedClient(auth.token);

    // Verify ownership
    const { data: existing } = await db
        .from('posts')
        .select('author_id, is_deleted')
        .eq('id', postId)
        .single();

    if (!existing) return jsonResponse({ error: 'Post not found.' }, 404);
    if (existing.author_id !== auth.userId) {
        return jsonResponse({ error: 'You can only delete your own posts.' }, 403);
    }

    // Soft-delete
    const { error } = await db
        .from('posts')
        .update({ is_deleted: true })
        .eq('id', postId);

    if (error) {
        console.error('DELETE /api/posts/[id] error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true });
};
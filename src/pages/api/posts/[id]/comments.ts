/**
 * /api/posts/[id]/comments
 *
 * GET  — Get threaded comments for a post.
 * POST — Create a new comment (or reply) on a post.
 * DELETE — Delete own comment (uses query param ?comment_id=xxx).
 */

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { createAuthedClient, supabase } from '../../../../lib/supabase';
import type { CreatePostCommentRequest } from '../../../../lib/api-types';

export const prerender = false;

// ─── GET /api/posts/[id]/comments ──────────────────────────────────────────────

export const GET: APIRoute = async ({ params }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    // Fetch all comments for this post (not deleted), with author
    const { data: comments, error } = await supabase
        .from('post_comments')
        .select(`
            id,
            post_id,
            author_id,
            parent_id,
            content,
            like_count,
            is_deleted,
            created_at,
            author:profiles!post_comments_author_id_fkey(id, username, avatar_url)
        `)
        .eq('post_id', postId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('GET post_comments error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    // Build threaded structure: top-level comments get their replies nested
    const topLevel: any[] = [];
    const replyMap = new Map<string, any[]>();

    (comments || []).forEach((c: any) => {
        const comment = { ...c };
        if (comment.parent_id) {
            const replies = replyMap.get(comment.parent_id) || [];
            replies.push(comment);
            replyMap.set(comment.parent_id, replies);
        } else {
            topLevel.push(comment);
        }
    });

    // Attach replies to their parents
    const threaded = topLevel.map((comment: any) => ({
        ...comment,
        replies: replyMap.get(comment.id) || [],
    }));

    return jsonResponse({ comments: threaded });
};

// ─── POST /api/posts/[id]/comments ─────────────────────────────────────────────

export const POST: APIRoute = async ({ params, request }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    let body: CreatePostCommentRequest;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }

    if (!body.content || !body.content.trim()) {
        return jsonResponse({ error: 'Comment content is required.' }, 400);
    }

    if (body.content.length > 2000) {
        return jsonResponse({ error: 'Comment must be under 2000 characters.' }, 400);
    }

    const db = createAuthedClient(auth.token);

    // If it's a reply, verify the parent comment exists and belongs to the same post
    if (body.parent_id) {
        const { data: parent } = await db
            .from('post_comments')
            .select('id, post_id')
            .eq('id', body.parent_id)
            .eq('post_id', postId)
            .maybeSingle();

        if (!parent) {
            return jsonResponse({ error: 'Parent comment not found or does not belong to this post.' }, 400);
        }
    }

    const { data: comment, error } = await db
        .from('post_comments')
        .insert({
            post_id: postId,
            author_id: auth.userId,
            parent_id: body.parent_id || null,
            content: body.content.trim(),
        })
        .select(`
            id,
            post_id,
            author_id,
            parent_id,
            content,
            like_count,
            is_deleted,
            created_at,
            author:profiles!post_comments_author_id_fkey(id, username, avatar_url)
        `)
        .single();

    if (error) {
        console.error('POST comment error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    // Increment comment_count on the post
    const { data: post } = await db
        .from('posts')
        .select('comment_count')
        .eq('id', postId)
        .single();
    const newCount = (post?.comment_count || 0) + 1;
    await db.from('posts').update({ comment_count: newCount }).eq('id', postId);

    return jsonResponse({ success: true, comment }, 201);
};

// ─── DELETE /api/posts/[id]/comments?comment_id=xxx ────────────────────────────

export const DELETE: APIRoute = async ({ params, request, url }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    const commentId = url.searchParams.get('comment_id');
    if (!commentId) return jsonResponse({ error: 'comment_id query param required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const db = createAuthedClient(auth.token);

    // Verify ownership
    const { data: existing } = await db
        .from('post_comments')
        .select('author_id')
        .eq('id', commentId)
        .eq('post_id', postId)
        .maybeSingle();

    if (!existing) return jsonResponse({ error: 'Comment not found.' }, 404);
    if (existing.author_id !== auth.userId) {
        return jsonResponse({ error: 'You can only delete your own comments.' }, 403);
    }

    // Soft-delete
    const { error } = await db
        .from('post_comments')
        .update({ is_deleted: true })
        .eq('id', commentId);

    if (error) {
        console.error('DELETE comment error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    // Decrement comment_count
    const { data: post } = await db
        .from('posts')
        .select('comment_count')
        .eq('id', postId)
        .single();
    const newCount = Math.max(0, (post?.comment_count || 1) - 1);
    await db.from('posts').update({ comment_count: newCount }).eq('id', postId);

    return jsonResponse({ success: true });
};
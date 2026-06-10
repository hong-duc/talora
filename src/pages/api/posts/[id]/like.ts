/**
 * /api/posts/[id]/like
 *
 * POST — Toggle like on a post. If the user already liked it, unlike it.
 *        Returns the new like state.
 */

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { createAuthedClient } from '../../../../lib/supabase';
import { eventHub } from '../../../../lib/event-hub';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
    const postId = params.id;
    if (!postId) return jsonResponse({ error: 'Post ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const db = createAuthedClient(auth.token);

    // Check if already liked
    const { data: existing } = await db
        .from('post_likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', auth.userId)
        .maybeSingle();

    if (existing) {
        // Unlike: delete the like row
        const { error: delErr } = await db
            .from('post_likes')
            .delete()
            .eq('post_id', postId)
            .eq('user_id', auth.userId);

        if (delErr) {
            console.error('Unlike error:', delErr);
            return jsonResponse({ error: delErr.message }, 500);
        }

        // Decrement like_count on the post (clamp to 0)
        const { data: post } = await db
            .from('posts')
            .select('like_count')
            .eq('id', postId)
            .single();
        const newCount = Math.max(0, (post?.like_count || 1) - 1);
        await db.from('posts').update({ like_count: newCount }).eq('id', postId);

        return jsonResponse({ liked: false, like_count: newCount });
    }

    // Like: insert the like row
    const { error: insErr } = await db
        .from('post_likes')
        .insert({ post_id: postId, user_id: auth.userId });

    if (insErr) {
        console.error('Like error:', insErr);
        return jsonResponse({ error: insErr.message }, 500);
    }

    // Increment like_count
    const { data: post } = await db
        .from('posts')
        .select('like_count, author_id')
        .eq('id', postId)
        .single();
    const newCount = (post?.like_count || 0) + 1;
    await db.from('posts').update({ like_count: newCount }).eq('id', postId);

    // Fire notification event
    if (post?.author_id) {
        eventHub.emit({
            type: 'post_like',
            actorId: auth.userId,
            recipientId: post.author_id,
            entityId: postId,
        });
    }

    return jsonResponse({ liked: true, like_count: newCount });
};
/**
 * /api/user/[id]/follow
 *
 * POST   — Follow the target user (authenticated caller becomes the follower).
 * DELETE — Unfollow the target user.
 *
 * The [id] param is the target user's profile id (the person being followed /
 * unfollowed). The authenticated caller's id is resolved from the Bearer token
 * or the sb-access-token cookie via requireAuth.
 *
 * The database trigger `on_user_follow` automatically keeps `follower_count`
 * and `following_count` on the `profiles` table in sync.
 */

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';
import { createAuthedClient } from '../../../../lib/supabase';

export const prerender = false;

// ─── POST /api/user/[id]/follow ───────────────────────────────────────────────

export const POST: APIRoute = async ({ params, request }) => {
    const targetUserId = params.id;
    if (!targetUserId) return jsonResponse({ error: 'User ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Prevent self-follow (the DB also has a CHECK constraint, but fail fast here)
    if (auth.userId === targetUserId) {
        return jsonResponse({ error: 'You cannot follow yourself.' }, 400);
    }

    const db = createAuthedClient(auth.token);

    const { error } = await db
        .from('user_followers')
        .insert({ follower_id: auth.userId, following_id: targetUserId });

    if (error) {
        // Unique-violation means the user is already following — treat as success
        if (error.code === '23505') {
            return jsonResponse({ success: true, alreadyFollowing: true });
        }
        console.error('follow insert error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true });
};

// ─── DELETE /api/user/[id]/follow ─────────────────────────────────────────────

export const DELETE: APIRoute = async ({ params, request }) => {
    const targetUserId = params.id;
    if (!targetUserId) return jsonResponse({ error: 'User ID required.' }, 400);

    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const db = createAuthedClient(auth.token);

    const { error } = await db
        .from('user_followers')
        .delete()
        .eq('follower_id', auth.userId)
        .eq('following_id', targetUserId);

    if (error) {
        console.error('unfollow delete error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    return jsonResponse({ success: true });
};

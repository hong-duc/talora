/**
 * /api/stories/[id]/rate
 *
 * GET  — returns average rating, total count, and the caller's own rating (if authenticated).
 * POST — upserts the authenticated user's rating (1–5 integers).
 *        Each user can only rate a story once; submitting again updates their rating.
 */

import type { APIRoute } from 'astro';
import { supabase, createAuthedClient } from '../../../../lib/supabase';
import { jsonResponse } from '../../../../lib/api-auth';

export const prerender = false;

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Try to extract userId from a Bearer token (non-throwing, returns null on any error) */
async function tryGetUserId(request: Request): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return null;

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
}

/** Compute the average rating from a list of rating rows */
function computeAverage(rows: Array<{ rating: number | null }>): number {
    if (!rows.length) return 0;
    const sum = rows.reduce((acc, r) => acc + (r.rating ?? 0), 0);
    // Round to one decimal place
    return Math.round((sum / rows.length) * 10) / 10;
}

// ─── GET /api/stories/[id]/rate ───────────────────────────────────────────────

export const GET: APIRoute = async ({ params, request }) => {
    const storyId = params.id;
    if (!storyId) return jsonResponse({ error: 'Story ID required.' }, 400);

    // Fetch all ratings for this story
    const { data: ratings, error } = await supabase
        .from('story_ratings')
        .select('rating, user_id')
        .eq('story_id', storyId);

    if (error) return jsonResponse({ error: error.message }, 500);

    const totalRatings = ratings?.length ?? 0;
    const averageRating = computeAverage(ratings ?? []);

    // Optionally resolve the calling user's own rating — no auth required
    let userRating: number | null = null;
    const userId = await tryGetUserId(request);
    if (userId && ratings) {
        const found = ratings.find((r) => r.user_id === userId);
        userRating = found?.rating ?? null;
    }

    return jsonResponse({ averageRating, totalRatings, userRating });
};

// ─── POST /api/stories/[id]/rate ─────────────────────────────────────────────

export const POST: APIRoute = async ({ params, request }) => {
    const storyId = params.id;
    if (!storyId) return jsonResponse({ error: 'Story ID required.' }, 400);

    // Require authentication for submitting a rating
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return jsonResponse({ error: 'Sign in to rate this story.' }, 401);

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
        return jsonResponse({ error: 'Invalid or expired session.' }, 401);
    }
    const userId = userData.user.id;

    // Validate the rating value
    const body = await request.json().catch(() => ({}));
    const { rating } = body as { rating?: unknown };

    if (
        typeof rating !== 'number' ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5
    ) {
        return jsonResponse({ error: 'Rating must be an integer between 1 and 5.' }, 400);
    }

    // Use authenticated client to satisfy RLS policies for insert/update
    const db = createAuthedClient(token);

    // Upsert: one row per (story_id, user_id) — updating on conflict
    const { error: upsertError } = await db
        .from('story_ratings')
        .upsert(
            { story_id: storyId, user_id: userId, rating },
            { onConflict: 'story_id,user_id' },
        );

    if (upsertError) return jsonResponse({ error: upsertError.message }, 500);

    // Recalculate the aggregate so the UI can update immediately
    const { data: ratings, error: fetchError } = await db
        .from('story_ratings')
        .select('rating')
        .eq('story_id', storyId);

    if (fetchError) return jsonResponse({ error: fetchError.message }, 500);

    const totalRatings = ratings?.length ?? 0;
    const averageRating = computeAverage(ratings ?? []);

    return jsonResponse({ success: true, averageRating, totalRatings, userRating: rating });
};

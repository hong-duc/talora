/**
 * /api/stories/[id]/comments
 *
 * GET  — Fetch paginated top-level comments for a story, joined with author profiles.
 *         Supports cursor-based pagination (?cursor=<iso_date>&limit=<n>).
 *         Public — no auth required to read.
 *
 * POST — Create a new comment (or reply) for a story.
 *         Requires authentication.
 *         Body: { content: string, parent_id?: string }
 */

import type { APIRoute } from 'astro';
import { supabase, createAuthedClient } from '../../../../lib/supabase';
import { requireAuth, jsonResponse } from '../../../../lib/api-auth';

export const prerender = false;

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// ─── GET /api/stories/[id]/comments ──────────────────────────────────────────

export const GET: APIRoute = async ({ params, request }) => {
    const storyId = params.id;
    if (!storyId) return jsonResponse({ error: 'Story ID required.' }, 400);

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor'); // ISO timestamp for pagination
    const limitParam = parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);

    // ── Total count query (runs in parallel with the page query) ─────────────
    const countPromise = supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('story_id', storyId)
        .is('parent_id', null);

    // ── Page query: top-level comments ordered by newest first ───────────────
    // Cursor pagination: fetch rows created_at < cursor (for newest-first order)
    let pageQuery = supabase
        .from('comments')
        .select('id, content, created_at, user_id, parent_id, profiles(username, avatar_url)')
        .eq('story_id', storyId)
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(limit + 1); // fetch one extra to know if there's a next page

    if (cursor) {
        pageQuery = pageQuery.lt('created_at', cursor);
    }

    const [countResult, pageResult] = await Promise.all([countPromise, pageQuery]);

    if (countResult.error) {
        return jsonResponse({ error: countResult.error.message }, 500);
    }
    if (pageResult.error) {
        return jsonResponse({ error: pageResult.error.message }, 500);
    }

    const rows = pageResult.data ?? [];
    const hasMore = rows.length > limit;
    const comments = hasMore ? rows.slice(0, limit) : rows;

    // The next cursor is the created_at of the last item in this page
    const nextCursor = hasMore && comments.length > 0
        ? comments[comments.length - 1].created_at
        : null;

    return jsonResponse({
        comments,
        total: countResult.count ?? 0,
        nextCursor,
    });
};

// ─── POST /api/stories/[id]/comments ─────────────────────────────────────────

export const POST: APIRoute = async ({ params, request }) => {
    const storyId = params.id;
    if (!storyId) return jsonResponse({ error: 'Story ID required.' }, 400);

    // Require authentication
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Parse + validate body
    const body = await request.json().catch(() => ({}));
    const { content, parent_id } = body as { content?: unknown; parent_id?: unknown };

    if (typeof content !== 'string' || content.trim().length === 0) {
        return jsonResponse({ error: 'Comment content cannot be empty.' }, 400);
    }
    if (content.trim().length > 2000) {
        return jsonResponse({ error: 'Comment must be 2000 characters or fewer.' }, 400);
    }
    if (parent_id !== undefined && typeof parent_id !== 'string') {
        return jsonResponse({ error: 'parent_id must be a string UUID.' }, 400);
    }

    // Use authenticated client so RLS (auth.uid() = user_id) is satisfied
    const db = createAuthedClient(auth.token);

    const insertPayload: Record<string, string> = {
        story_id: storyId,
        user_id: auth.userId,
        content: content.trim(),
    };
    if (parent_id) insertPayload.parent_id = parent_id;

    const { data: inserted, error: insertError } = await db
        .from('comments')
        .insert(insertPayload)
        .select('id, content, created_at, user_id, parent_id')
        .single();

    if (insertError) return jsonResponse({ error: insertError.message }, 500);

    // Fetch the author's profile to include in the response (avoids a client refetch)
    const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', auth.userId)
        .maybeSingle();

    return jsonResponse({
        comment: {
            ...inserted,
            profiles: profile ?? { username: null, avatar_url: null },
        },
    }, 201);
};

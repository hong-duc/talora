/**
 * /api/posts
 *
 * GET  — Paginated public feed of posts (with author, like/repost flags).
 * POST — Create a new post.
 */

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';
import { createAuthedClient, supabase } from '../../../lib/supabase';
import type { CreatePostRequest } from '../../../lib/api-types';

export const prerender = false;

// ─── GET /api/posts ────────────────────────────────────────────────────────────

export const GET: APIRoute = async ({ request, url }) => {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // Try to get the current user ID from Bearer token (optional – used to
    // set liked_by_me / reposted_by_me flags). If the user isn't signed in
    // we still serve the public feed.
    let userId: string | null = null;
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const { data } = await supabase.auth.getUser(authHeader.slice(7));
        userId = data?.user?.id ?? null;
    }

    const db = userId
        ? createAuthedClient(authHeader!.slice(7))
        : supabase;

    // 1. Count total posts
    const { count: total } = await db
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('visibility', 'public');

    // 2. Fetch posts with author, story, character
    const { data: posts, error } = await db
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
            created_at,
            updated_at,
            author:profiles!posts_author_id_fkey(id, username, avatar_url),
            story:stories!posts_story_id_fkey(id, title),
            character:characters!posts_character_id_fkey(id, name, avatar_url)
        `)
        .eq('is_deleted', false)
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('GET /api/posts error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    // 3. If user is logged in, get their likes & reposts for liked_by_me / reposted_by_me
    let likedPostIds = new Set<string>();
    let repostedPostIds = new Set<string>();

    if (userId && posts?.length) {
        const postIds = posts.map((p: any) => p.id);
        const [{ data: likes }, { data: reposts }] = await Promise.all([
            db.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', userId),
            db.from('post_reposts').select('post_id').in('post_id', postIds).eq('user_id', userId),
        ]);
        likes?.forEach((l: any) => likedPostIds.add(l.post_id));
        reposts?.forEach((r: any) => repostedPostIds.add(r.post_id));
    }

    const enriched = (posts || []).map((p: any) => ({
        ...p,
        liked_by_me: likedPostIds.has(p.id),
        reposted_by_me: repostedPostIds.has(p.id),
    }));

    const totalPages = Math.ceil((total || 0) / limit);

    return jsonResponse({
        posts: enriched,
        pagination: {
            page,
            limit,
            total: total || 0,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        },
    });
};

// ─── POST /api/posts ───────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    let body: CreatePostRequest;
    try {
        body = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body.' }, 400);
    }

    if (!body.content || !body.content.trim()) {
        return jsonResponse({ error: 'Post content is required.' }, 400);
    }

    if (body.content.length > 5000) {
        return jsonResponse({ error: 'Post content must be under 5000 characters.' }, 400);
    }

    const db = createAuthedClient(auth.token);

    const insertData: Record<string, any> = {
        author_id: auth.userId,
        content: body.content.trim(),
        visibility: body.visibility || 'public',
    };

    if (body.story_id) insertData.story_id = body.story_id;
    if (body.character_id) insertData.character_id = body.character_id;
    if (body.image_urls?.length) insertData.image_urls = body.image_urls.slice(0, 10);

    const { data: post, error } = await db
        .from('posts')
        .insert(insertData)
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
        .single();

    if (error) {
        console.error('POST /api/posts error:', error);
        return jsonResponse({ error: error.message }, 500);
    }

    // Attach tags if provided
    if (body.tags?.length && post) {
        const tagInserts = body.tags.map((tag) => {
            if (tag.id) {
                return { post_id: post.id, tag_id: tag.id };
            }
            return null;
        }).filter(Boolean);

        if (tagInserts.length > 0) {
            await db.from('post_tags').insert(tagInserts);
        }
    }

    return jsonResponse({ success: true, post: { ...post, liked_by_me: false, reposted_by_me: false } }, 201);
};
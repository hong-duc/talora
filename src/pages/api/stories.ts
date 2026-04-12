import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { createApiHandler, createApiResponse, parsePagination, createPaginationMeta } from '../../lib/api-utils';
import type { StoryResponse, PaginatedStoryResponse } from '../../lib/api-types';
import { errors } from '../../lib/error';

export const prerender = false;

// Helper to transform Supabase data to StoryResponse
function transformStoryData(data: any): StoryResponse {
    // Handle author - could be array or object
    let author = null;
    if (data.author) {
        if (Array.isArray(data.author) && data.author.length > 0) {
            author = {
                id: data.author[0].id,
                username: data.author[0].username,
                avatar_url: data.author[0].avatar_url,
            };
        } else if (typeof data.author === 'object' && data.author.id) {
            author = {
                id: data.author.id,
                username: data.author.username,
                avatar_url: data.author.avatar_url,
            };
        }
    }

    // Handle tags - extract from story_tags join
    const tags: Array<{ id: string; name: string }> = [];
    const storyTags = data.story_tags || [];

    for (const link of storyTags) {
        if (link?.tags) {
            if (Array.isArray(link.tags)) {
                for (const tag of link.tags) {
                    if (tag?.id && tag?.name) {
                        tags.push({ id: tag.id, name: tag.name });
                    }
                }
            } else if (link.tags.id && link.tags.name) {
                tags.push({ id: link.tags.id, name: link.tags.name });
            }
        }
    }

    return {
        id: data.id,
        author_id: data.author_id,
        title: data.title,
        description: data.description || undefined,
        cover_image_url: data.cover_image_url || undefined,
        rating: data.rating || undefined,
        created_at: data.created_at,
        author,
        tags,
    };
}

const getStoriesHandler = async ({ request }: Parameters<APIRoute>[0]) => {
    const url = new URL(request.url);

    // Parse pagination parameters
    const { page, limit, offset } = parsePagination(url, {
        limit: 20,
        maxLimit: 100,
    });

    // Parse optional filters
    const authorId = url.searchParams.get('author_id');
    const search = url.searchParams.get('search')?.trim();
    const includeAllStatuses = url.searchParams.get('all_statuses') === 'true';

    try {
        // Build query - only show public stories by default
        let query = supabase
            .from('stories')
            .select(
                `
                id,
                title,
                description,
                cover_image_url,
                created_at,
                author_id,
                author:profiles!stories_author_id_fkey(id, username, avatar_url),
                story_tags(
                    tags(id, name)
                )
                `,
                { count: 'exact' }
            )
            .order('created_at', { ascending: false });

        // Only filter by public status if not requesting all statuses
        if (!includeAllStatuses) {
            query = query.eq('is_public', true);
        }

        // Apply filters
        if (authorId) {
            query = query.eq('author_id', authorId);
        }

        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        console.log('Executing Supabase query with params:', { page, limit, offset, authorId, search, includeAllStatuses });
        const { data, error, count } = await query;
        console.log('Supabase response:', { data: data?.length, error, count });

        if (error) {
            console.error('Supabase query error details:', error);
            // Fall back to simple query without joins
            console.log('Falling back to simple query...');
            let simpleQuery = supabase
                .from('stories')
                .select('id, title, description, cover_image_url, created_at, author_id', { count: 'exact' })
                .order('created_at', { ascending: false });

            if (!includeAllStatuses) {
                simpleQuery = simpleQuery.eq('is_public', true);
            }
            if (authorId) {
                simpleQuery = simpleQuery.eq('author_id', authorId);
            }
            if (search) {
                simpleQuery = simpleQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
            }
            simpleQuery = simpleQuery.range(offset, offset + limit - 1);

            const { data: simpleData, error: simpleError, count: simpleCount } = await simpleQuery;

            if (simpleError) {
                return createApiResponse(false, errors.database('Failed to fetch stories', simpleError));
            }

            const stories: StoryResponse[] = (Array.isArray(simpleData) ? simpleData : []).map((story: any) => ({
                id: story.id,
                author_id: story.author_id,
                title: story.title,
                description: story.description || undefined,
                cover_image_url: story.cover_image_url || undefined,
                created_at: story.created_at,
                author: null,
                tags: [],
            }));

            const total = simpleCount || 0;
            const pagination = createPaginationMeta(page, limit, total);
            return createApiResponse(true, { stories, pagination } as PaginatedStoryResponse);
        }

        const stories = Array.isArray(data) ? data.map(transformStoryData) : [];
        const total = count || 0;
        const pagination = createPaginationMeta(page, limit, total);

        console.log('Returning stories:', stories.length);
        return createApiResponse(true, { stories, pagination } as PaginatedStoryResponse);
    } catch (error) {
        console.error('Unexpected error in getStoriesHandler:', error);
        return createApiResponse(false, errors.unknown('Failed to load stories', error as Error));
    }
};

export const GET = createApiHandler(getStoriesHandler);
import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import type { Tag, TagCategory, TagCategoryGroup } from '../../lib/types';

export const prerender = false;

type TagRow = Tag & { category_id: string | null };

const DEFAULT_COLOR = '#6b7280';

export const GET: APIRoute = async ({ request }) => {
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q')?.trim() ?? '';

        const { data: categories, error: categoriesError } = await supabase
            .from('tag_categories')
            .select('id, name, color');

        if (categoriesError) {
            return new Response(
                JSON.stringify({ error: categoriesError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let tagsQuery = supabase
            .from('tags')
            .select('id, name, category_id');

        if (query) {
            tagsQuery = tagsQuery.ilike('name', `%${query}%`);
        }

        const { data: tags, error: tagsError } = await tagsQuery;

        if (tagsError) {
            return new Response(
                JSON.stringify({ error: tagsError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const categoryMap = new Map<string, TagCategoryGroup>();
        (categories || []).forEach((category: TagCategory) => {
            categoryMap.set(category.id, {
                id: category.id,
                name: category.name,
                color: category.color || DEFAULT_COLOR,
                tags: [],
            });
        });

        const uncategorized: TagCategoryGroup = {
            id: 'uncategorized',
            name: 'Uncategorized',
            color: DEFAULT_COLOR,
            tags: [],
        };

        (tags || []).forEach((tag: TagRow) => {
            const tagItem: Tag = { id: tag.id, name: tag.name };
            if (tag.category_id && categoryMap.has(tag.category_id)) {
                categoryMap.get(tag.category_id)?.tags.push(tagItem);
                return;
            }
            uncategorized.tags.push(tagItem);
        });

        const grouped = Array.from(categoryMap.values()).filter(
            (category) => category.tags.length > 0
        );

        if (uncategorized.tags.length > 0) {
            grouped.push(uncategorized);
        }

        return new Response(
            JSON.stringify({ categories: grouped }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Failed to load tags.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

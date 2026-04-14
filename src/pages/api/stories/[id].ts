import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { updateStory } from '../../../lib/stories';

export const prerender = false;

type UpdateStoryTag = {
    id: string | null;
    name: string;
};

const normalizeTagName = (value: string) => value.trim();
const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

export const GET: APIRoute = async ({ params }) => {
    const id = params.id;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Story id is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        console.log(`Fetching story ${id} from Supabase...`);

        // Simple approach: get story with author separately
        const { data: storyData, error: storyError } = await supabase
            .from('stories')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (storyError) {
            console.error('Supabase story query error:', storyError);
            return new Response(JSON.stringify({ error: storyError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!storyData) {
            return new Response(JSON.stringify({ error: 'Story not found.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Get author profile separately
        let author = null;
        if (storyData.author_id) {
            const { data: authorData, error: authorError } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', storyData.author_id)
                .maybeSingle();

            if (!authorError && authorData) {
                author = {
                    id: authorData.id,
                    username: authorData.username,
                    avatar_url: authorData.avatar_url,
                };
            }
        }

        // Get tags separately
        const tags: Array<{ id: string; name: string }> = [];
        const { data: tagLinks, error: tagError } = await supabase
            .from('story_tags')
            .select('tags(id, name)')
            .eq('story_id', id);

        if (!tagError && tagLinks) {
            for (const link of tagLinks) {
                if (link?.tags) {
                    // tags is an array with one element based on Supabase join
                    const tagArray = Array.isArray(link.tags) ? link.tags : [link.tags];
                    for (const tag of tagArray) {
                        if (tag?.id && tag?.name) {
                            tags.push({ id: tag.id, name: tag.name });
                        }
                    }
                }
            }
        }

        // Get story_starts separately
        const story_starts: Array<{
            id?: string;
            title: string;
            content: string;
            sort_order: number;
        }> = [];
        const { data: storyStartsData, error: storyStartsError } = await supabase
            .from('story_starts')
            .select('id, title, first_message, sort_order')
            .eq('story_id', id)
            .order('sort_order', { ascending: true });

        if (!storyStartsError && storyStartsData) {
            for (const start of storyStartsData) {
                story_starts.push({
                    id: start.id,
                    title: start.title,
                    content: start.first_message,
                    sort_order: start.sort_order,
                });
            }
        }

        const story = {
            id: storyData.id,
            title: storyData.title,
            tagline: storyData.tagline || null,
            description: storyData.description,
            cover_image_url: storyData.cover_image_url,
            created_at: storyData.created_at,
            author_id: storyData.author_id,
            author,
            tags,
            story_starts,
            is_public: storyData.is_public ?? true,
            // World-building fields
            setting: storyData.setting || null,
            tone: storyData.tone || [],
            world_rules: storyData.world_rules || null,
            descriptiveness: storyData.descriptiveness || 3,
            dialogue_ratio: storyData.dialogue_ratio || 3,
            pacing: storyData.pacing || 'medium',
            emotional_intensity: storyData.emotional_intensity || 3,
            auto_style: storyData.auto_style ?? true,
            characters: storyData.characters || [],
            lore: storyData.lore || null,
        };

        return new Response(
            JSON.stringify({ story }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Unexpected error in story detail API:', error);
        return new Response(JSON.stringify({ error: 'Failed to load story.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

export const PUT: APIRoute = async ({ params, request }) => {
    const id = params.id;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Story id is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const {
            title,
            tagline,
            description,
            cover_image_url,
            tags,
            story_starts,
            author_id, // For authorization check
            is_public,
            // World-building fields
            setting,
            tone,
            world_rules,
            descriptiveness,
            dialogue_ratio,
            pacing,
            emotional_intensity,
            auto_style,
            characters,
            lore,
        } = body;

        // Validate required fields
        if (!title || title.trim() === '') {
            return new Response(
                JSON.stringify({ error: 'Title is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Verify the user owns the story
        const { data: existingStory, error: storyError } = await supabase
            .from('stories')
            .select('author_id')
            .eq('id', id)
            .maybeSingle();

        if (storyError) {
            console.error('Supabase story query error:', storyError);
            return new Response(JSON.stringify({ error: storyError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!existingStory) {
            return new Response(JSON.stringify({ error: 'Story not found.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (existingStory.author_id !== author_id) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: You can only edit your own stories.' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Process new fields (similar to create endpoint)
        // Process tone array
        const toneArray = Array.isArray(tone) ? tone.filter(t => typeof t === 'string' && t.trim() !== '').map(t => t.trim()) : [];

        // Process characters JSON
        let charactersJson = null;
        if (characters) {
            try {
                charactersJson = Array.isArray(characters) ? characters : JSON.parse(characters);
                // Validate characters structure
                if (Array.isArray(charactersJson)) {
                    charactersJson = charactersJson.filter(char =>
                        char && typeof char === 'object' && typeof char.name === 'string' && char.name.trim() !== ''
                    );
                } else {
                    charactersJson = null;
                }
            } catch (e) {
                charactersJson = null;
            }
        }

        // Process numeric fields with validation
        const descriptivenessNum = typeof descriptiveness === 'number' ?
            Math.max(1, Math.min(5, descriptiveness)) :
            (typeof descriptiveness === 'string' ?
                Math.max(1, Math.min(5, parseInt(descriptiveness) || 3)) : 3);

        const dialogueRatioNum = typeof dialogue_ratio === 'number' ?
            Math.max(1, Math.min(5, dialogue_ratio)) :
            (typeof dialogue_ratio === 'string' ?
                Math.max(1, Math.min(5, parseInt(dialogue_ratio) || 3)) : 3);

        const emotionalIntensityNum = typeof emotional_intensity === 'number' ?
            Math.max(1, Math.min(5, emotional_intensity)) :
            (typeof emotional_intensity === 'string' ?
                Math.max(1, Math.min(5, parseInt(emotional_intensity) || 3)) : 3);

        // Validate pacing
        const validPacing = ['slow', 'medium', 'fast'].includes(pacing) ? pacing : 'medium';

        // Update story with all fields
        const { data: _updatedStory, error: updateError } = await updateStory(id, {
            title: title.trim(),
            tagline: tagline?.trim() || undefined,
            description: description?.trim() || undefined,
            cover_image_url: cover_image_url || undefined,
            updated_at: new Date().toISOString(),
            ...(typeof is_public === 'boolean' ? { is_public } : {}),
            // New fields
            setting: setting?.trim() || undefined,
            tone: toneArray.length > 0 ? toneArray : undefined,
            world_rules: world_rules?.trim() || undefined,
            descriptiveness: descriptivenessNum,
            dialogue_ratio: dialogueRatioNum,
            pacing: validPacing,
            emotional_intensity: emotionalIntensityNum,
            auto_style: typeof auto_style === 'boolean' ? auto_style : true,
            characters: charactersJson || undefined,
            lore: lore?.trim() || undefined,
        });

        if (updateError) {
            return new Response(
                JSON.stringify({ error: updateError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Handle tag updates
        const rawTags: UpdateStoryTag[] = Array.isArray(tags) ? tags : [];
        const normalizedTags = rawTags
            .map((tag) => ({
                id: typeof tag?.id === 'string' ? tag.id : null,
                name: typeof tag?.name === 'string' ? normalizeTagName(tag.name) : '',
            }))
            .filter((tag) => tag.name.length > 0);

        // Get current tags for comparison
        const { data: currentTagLinks, error: currentTagError } = await supabase
            .from('story_tags')
            .select('tag_id')
            .eq('story_id', id);

        if (currentTagError) {
            console.error('Error fetching current tags:', currentTagError);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch current tags.' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const currentTagIds = (currentTagLinks || []).map(link => link.tag_id);
        const newTagIds: string[] = [];

        if (normalizedTags.length > 0) {
            const uniqueTags = normalizedTags.reduce<UpdateStoryTag[]>((acc, tag) => {
                const idKey = tag.id ?? null;
                const nameKey = normalizeTagName(tag.name).toLowerCase();
                if (acc.some((item) => (idKey ? item.id === idKey : item.name.toLowerCase() === nameKey))) {
                    return acc;
                }
                acc.push(tag);
                return acc;
            }, []);

            const { data: customCategory, error: customCategoryError } = await supabase
                .from('tag_categories')
                .select('id')
                .ilike('name', 'custom')
                .maybeSingle();

            if (customCategoryError || !customCategory?.id) {
                return new Response(
                    JSON.stringify({ error: customCategoryError?.message || 'Custom tag category not found.' }),
                    { status: 500, headers: { 'Content-Type': 'application/json' } }
                );
            }

            for (const tag of uniqueTags) {
                if (tag.id) {
                    newTagIds.push(tag.id);
                    continue;
                }

                const { data: existingTag, error: existingTagError } = await supabase
                    .from('tags')
                    .select('id')
                    .ilike('name', tag.name)
                    .maybeSingle();

                if (existingTagError) {
                    console.error('Error checking existing tag:', existingTagError);
                    continue;
                }

                if (existingTag?.id) {
                    newTagIds.push(existingTag.id);
                    continue;
                }

                const { data: newTag, error: newTagError } = await supabase
                    .from('tags')
                    .insert([
                        {
                            name: tag.name,
                            slug: slugify(tag.name),
                            category_id: customCategory.id,
                            is_official: false,
                            created_by: author_id,
                        },
                    ])
                    .select('id')
                    .single();

                if (newTagError || !newTag?.id) {
                    console.error('Error creating new tag:', newTagError);
                    continue;
                }

                newTagIds.push(newTag.id);
            }
        }

        // Compare current and new tags to update relationships
        const tagsToAdd = newTagIds.filter(tagId => !currentTagIds.includes(tagId));
        const tagsToRemove = currentTagIds.filter(tagId => !newTagIds.includes(tagId));

        // Add new relationships
        if (tagsToAdd.length > 0) {
            const { error: addTagsError } = await supabase
                .from('story_tags')
                .insert(tagsToAdd.map(tagId => ({ story_id: id, tag_id: tagId })));

            if (addTagsError) {
                console.error('Error adding new tag relationships:', addTagsError);
            }
        }

        // Remove old relationships
        if (tagsToRemove.length > 0) {
            const { error: removeTagsError } = await supabase
                .from('story_tags')
                .delete()
                .eq('story_id', id)
                .in('tag_id', tagsToRemove);

            if (removeTagsError) {
                console.error('Error removing old tag relationships:', removeTagsError);
            }
        }

        // Handle story_starts updates
        if (story_starts && Array.isArray(story_starts)) {
            // First, delete all existing story_starts for this story
            const { error: deleteStartsError } = await supabase
                .from('story_starts')
                .delete()
                .eq('story_id', id);

            if (deleteStartsError) {
                console.error('Error deleting existing story starts:', deleteStartsError);
            }

            // Insert new story_starts
            const validStarts = story_starts
                .filter((start: any) =>
                    start &&
                    typeof start.title === 'string' &&
                    start.title.trim() !== '' &&
                    typeof start.content === 'string' &&
                    start.content.trim() !== '' &&
                    typeof start.sort_order === 'number'
                )
                .map((start: any) => ({
                    story_id: id,
                    title: start.title.trim(),
                    first_message: start.content.trim(),
                    sort_order: start.sort_order,
                }));

            if (validStarts.length > 0) {
                const { error: insertStartsError } = await supabase
                    .from('story_starts')
                    .insert(validStarts);

                if (insertStartsError) {
                    console.error('Error inserting story starts:', insertStartsError);
                }
            }
        }

        // Fetch the updated story with tags
        const { data: finalStoryData, error: finalError } = await supabase
            .from('stories')
            .select(`
                *,
                story_tags (
                    tags (
                        id,
                        name
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (finalError) {
            console.error('Error fetching updated story:', finalError);
            return new Response(
                JSON.stringify({ error: 'Story updated but failed to fetch final data.' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const finalTags = (finalStoryData.story_tags || []).map((link: any) => {
            const tag = Array.isArray(link.tags) ? link.tags[0] : link.tags;
            return { id: tag?.id, name: tag?.name };
        }).filter((tag: any) => tag.id && tag.name);

        const finalStory = {
            id: finalStoryData.id,
            title: finalStoryData.title,
            description: finalStoryData.description,
            cover_image_url: finalStoryData.cover_image_url,
            created_at: finalStoryData.created_at,
            author_id: finalStoryData.author_id,
            tags: finalTags,
        };

        return new Response(
            JSON.stringify({ success: true, story: finalStory }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Unexpected error in story update API:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to update story' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

/**
 * PATCH /api/stories/[id]
 *
 * Lightweight update for a single field — currently used for the is_public toggle.
 * Expects JSON body: { author_id: string, is_public: boolean }
 */
export const PATCH: APIRoute = async ({ params, request }) => {
    const id = params.id;
    if (!id) {
        return new Response(JSON.stringify({ error: 'Story id is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const { author_id, is_public } = body;

        if (!author_id) {
            return new Response(JSON.stringify({ error: 'author_id is required.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (typeof is_public !== 'boolean') {
            return new Response(JSON.stringify({ error: 'is_public must be a boolean.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Ownership check
        const { data: existing } = await supabase
            .from('stories')
            .select('author_id')
            .eq('id', id)
            .maybeSingle();

        if (!existing) {
            return new Response(JSON.stringify({ error: 'Story not found.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        if (existing.author_id !== author_id) {
            return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { error: updateError } = await supabase
            .from('stories')
            .update({ is_public, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (updateError) {
            return new Response(JSON.stringify({ error: updateError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ success: true, is_public }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err) {
        console.error('Unexpected error in story PATCH:', err);
        return new Response(JSON.stringify({ error: 'Failed to update story.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

/**
 * DELETE /api/stories/[id]
 * 
 * Deletes a story and all its related data (tags, story_starts).
 * Only the story author can delete their own story.
 * Expects JSON body: { author_id: string }
 */
export const DELETE: APIRoute = async ({ params, request }) => {
    const id = params.id;

    if (!id) {
        return new Response(JSON.stringify({ error: 'Story id is required.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await request.json();
        const { author_id } = body;

        if (!author_id) {
            return new Response(
                JSON.stringify({ error: 'Author ID is required for authorization.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Verify the story exists and the user owns it
        const { data: existingStory, error: storyError } = await supabase
            .from('stories')
            .select('author_id')
            .eq('id', id)
            .maybeSingle();

        if (storyError) {
            console.error('Supabase story query error:', storyError);
            return new Response(JSON.stringify({ error: storyError.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!existingStory) {
            return new Response(JSON.stringify({ error: 'Story not found.' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (existingStory.author_id !== author_id) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: You can only delete your own stories.' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Delete related data first (cascade manually to avoid FK issues)
        // 1. Delete story_tags
        const { error: tagsDeleteError } = await supabase
            .from('story_tags')
            .delete()
            .eq('story_id', id);

        if (tagsDeleteError) {
            console.error('Error deleting story tags:', tagsDeleteError);
        }

        // 2. Delete story_starts
        const { error: startsDeleteError } = await supabase
            .from('story_starts')
            .delete()
            .eq('story_id', id);

        if (startsDeleteError) {
            console.error('Error deleting story starts:', startsDeleteError);
        }

        // 3. Delete the story itself
        const { error: deleteError } = await supabase
            .from('stories')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting story:', deleteError);
            return new Response(
                JSON.stringify({ error: deleteError.message }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Story deleted successfully.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Unexpected error in story delete API:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to delete story' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

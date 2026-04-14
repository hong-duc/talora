import type { APIRoute } from 'astro';
import { createStory, uploadCoverImage, updateStory } from '../../lib/stories';
import { supabase } from '../../lib/supabase';
import type { Story, StoryCharacterJson } from '../../lib/types';

export const prerender = false;

// ============================================================================
// TYPES
// ============================================================================

type CreateStoryTag = {
    id: string | null;
    name: string;
};

type StoryStart = {
    title: string;
    content: string;
    sort_order: number;
};

type ParsedStoryData = {
    author_id?: string;
    authorId?: string;       // camelCase alias from the store
    title: string;
    tagline?: string;
    description?: string;
    tags?: CreateStoryTag[];
    story_starts?: StoryStart[];
    firstMessages?: StoryStart[];  // camelCase alias from the store
    setting?: string;
    tone?: string[] | string;
    world_rules?: string;
    worldRules?: string;     // camelCase alias from the store
    style: {
        descriptiveness?: number | string;
        dialogue_ratio?: number | string;
        dialogueRatio?: number | string;         // camelCase alias
        pacing?: string;
        emotional_intensity?: number | string;
        emotionalIntensity?: number | string;    // camelCase alias
        auto_style?: boolean;
        autoStyle?: boolean;                      // camelCase alias
    };
    characters?: StoryCharacterJson[] | string;
    lore?: string;
};

type FormDataResult = {
    storyData: ParsedStoryData;
    coverImageFile: File | null;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse form data from request
 */
async function parseFormData(request: Request): Promise<FormDataResult> {
    const formData = await request.formData();
    const storyDataJson = formData.get('storyData') as string;
    const coverImageFile = formData.get('coverimage') as File | null;

    if (!storyDataJson) {
        throw new Error('Missing storyData in form data');
    }

    const storyData = JSON.parse(storyDataJson) as ParsedStoryData;
    return { storyData, coverImageFile };
}

/**
 * Resolve author_id from either camelCase or snake_case field
 */
function resolveAuthorId(data: ParsedStoryData): string {
    return (data.author_id || data.authorId || '').trim();
}

/**
 * Resolve world_rules from either camelCase or snake_case field
 */
function resolveWorldRules(data: ParsedStoryData): string | undefined {
    return (data.world_rules || data.worldRules || '')?.trim() || undefined;
}

/**
 * Resolve story_starts from either camelCase or snake_case field
 */
function resolveStoryStarts(data: ParsedStoryData): StoryStart[] {
    return data.story_starts || data.firstMessages || [];
}

/**
 * Validate required story data fields
 */
function validateStoryData(data: ParsedStoryData): { isValid: boolean; error?: string } {
    const authorId = resolveAuthorId(data);
    if (!authorId) {
        return { isValid: false, error: 'Author ID is required' };
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
        return { isValid: false, error: 'Title is required' };
    }

    return { isValid: true };
}

/**
 * Process tone array from mixed input
 */
function processToneArray(tones?: string[] | string): string[] {
    if (!tones) return [];

    if (Array.isArray(tones)) {
        return tones.filter(t => typeof t === 'string' && t.trim() !== '').map(t => t.trim());
    }

    if (typeof tones === 'string') {
        try {
            const parsed = JSON.parse(tones);
            return Array.isArray(parsed)
                ? parsed.filter(t => typeof t === 'string' && t.trim() !== '').map(t => t.trim())
                : [];
        } catch {
            return [];
        }
    }

    return [];
}

/**
 * Process characters JSON from mixed input
 */
function processCharactersJson(characters?: StoryCharacterJson[] | string): StoryCharacterJson[] | undefined {
    if (!characters) return undefined;

    try {
        const charactersArray = Array.isArray(characters)
            ? characters
            : JSON.parse(characters);

        if (!Array.isArray(charactersArray)) return undefined;

        return charactersArray.filter(char =>
            char &&
            typeof char === 'object' &&
            typeof char.name === 'string' &&
            char.name.trim() !== ''
        );
    } catch {
        return undefined;
    }
}

/**
 * Process numeric field with validation (1-5 range)
 */
function processNumericField(value?: number | string, defaultValue = 3): number {
    if (typeof value === 'number') {
        return Math.max(1, Math.min(5, value));
    }

    if (typeof value === 'string') {
        const parsed = parseInt(value);
        if (!isNaN(parsed)) {
            return Math.max(1, Math.min(5, parsed));
        }
    }

    return defaultValue;
}

/**
 * Process pacing field with validation
 */
function processPacing(pacing?: string): 'slow' | 'medium' | 'fast' {
    const validPacing = ['slow', 'medium', 'fast'];
    return validPacing.includes(pacing || '') ? pacing as 'slow' | 'medium' | 'fast' : 'medium';
}

/**
 * Create story record in database
 */
async function createStoryRecord(data: ParsedStoryData): Promise<{ story: Story | null; error: Error | null }> {
    const toneArray = processToneArray(data.tone);
    const charactersJson = processCharactersJson(data.characters);
    // Resolve camelCase / snake_case aliases from the store
    const descriptivenessNum = processNumericField(data.style.descriptiveness);
    const dialogueRatioNum = processNumericField(data.style.dialogue_ratio ?? data.style.dialogueRatio);
    const emotionalIntensityNum = processNumericField(data.style.emotional_intensity ?? data.style.emotionalIntensity);
    const validPacing = processPacing(data.style.pacing);
    const autoStyle = typeof data.style.auto_style === 'boolean'
        ? data.style.auto_style
        : typeof data.style.autoStyle === 'boolean'
            ? data.style.autoStyle
            : true;

    const storyData = {
        author_id: resolveAuthorId(data),
        title: data.title.trim(),
        tagline: data.tagline?.trim() || undefined,
        description: data.description?.trim() || undefined,
        cover_image_url: '', // Empty string initially
        setting: data.setting?.trim() || undefined,
        tone: toneArray.length > 0 ? toneArray : undefined,
        world_rules: resolveWorldRules(data),
        descriptiveness: descriptivenessNum,
        dialogue_ratio: dialogueRatioNum,
        pacing: validPacing,
        emotional_intensity: emotionalIntensityNum,
        auto_style: autoStyle,
        characters: charactersJson || undefined,
        lore: data.lore?.trim() || undefined,
    };

    const { data: story, error } = await createStory(storyData);
    return { story, error };
}

/**
 * Upload cover image and update story if file provided
 */
async function uploadCoverImageIfProvided(
    file: File | null,
    story: Story
): Promise<{ success: boolean; error?: string; coverImageUrl?: string }> {
    if (!file || file.size === 0) {
        return { success: true }; // No file to upload
    }

    try {
        const { url, error } = await uploadCoverImage(file, story.id!, story.title);

        if (error || !url) {
            return {
                success: false,
                error: `Failed to upload cover image: ${error?.message || 'Unknown error'}`
            };
        }

        // Update story with cover image URL
        const { error: updateError } = await updateStory(story.id!, { cover_image_url: url });

        if (updateError) {
            return {
                success: false,
                error: `Failed to update story with cover image: ${updateError.message}`
            };
        }

        return { success: true, coverImageUrl: url };
    } catch (error) {
        return {
            success: false,
            error: `Unexpected error during cover image upload: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

/**
 * Normalize tag name
 */
const normalizeTagName = (value: string): string => value.trim();

/**
 * Slugify tag name
 */
const slugify = (value: string): string =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

/**
 * Process tags for story
 */
async function processTags(
    storyId: string,
    tags: CreateStoryTag[] = [],
    authorId: string
): Promise<{ success: boolean; error?: string }> {
    if (tags.length === 0) {
        return { success: true };
    }

    // Normalize and deduplicate tags
    const normalizedTags = tags
        .map((tag) => ({
            id: typeof tag?.id === 'string' ? tag.id : null,
            name: typeof tag?.name === 'string' ? normalizeTagName(tag.name) : '',
        }))
        .filter((tag) => tag.name.length > 0);

    const uniqueTags = normalizedTags.reduce<CreateStoryTag[]>((acc, tag) => {
        const idKey = tag.id ?? null;
        const nameKey = normalizeTagName(tag.name).toLowerCase();
        if (acc.some((item) => (idKey ? item.id === idKey : item.name.toLowerCase() === nameKey))) {
            return acc;
        }
        acc.push(tag);
        return acc;
    }, []);

    if (uniqueTags.length === 0) {
        return { success: true };
    }

    // Get custom tag category
    const { data: customCategory, error: customCategoryError } = await supabase
        .from('tag_categories')
        .select('id')
        .ilike('name', 'custom')
        .maybeSingle();

    if (customCategoryError || !customCategory?.id) {
        return {
            success: false,
            error: customCategoryError?.message || 'Custom tag category not found.'
        };
    }

    const tagIds: string[] = [];

    // Process each tag
    for (const tag of uniqueTags) {
        if (tag.id) {
            tagIds.push(tag.id);
            continue;
        }

        // Check if tag already exists
        const { data: existingTag, error: existingTagError } = await supabase
            .from('tags')
            .select('id')
            .ilike('name', tag.name)
            .maybeSingle();

        if (existingTagError) {
            return { success: false, error: existingTagError.message };
        }

        if (existingTag?.id) {
            tagIds.push(existingTag.id);
            continue;
        }

        // Create new tag
        const { data: newTag, error: newTagError } = await supabase
            .from('tags')
            .insert([
                {
                    name: tag.name,
                    slug: slugify(tag.name),
                    category_id: customCategory.id,
                    is_official: false,
                    created_by: authorId,
                },
            ])
            .select('id')
            .single();

        if (newTagError || !newTag?.id) {
            return {
                success: false,
                error: newTagError?.message || 'Failed to create tag.'
            };
        }

        tagIds.push(newTag.id);
    }

    // Associate tags with story
    if (tagIds.length > 0) {
        const { error: storyTagsError } = await supabase
            .from('story_tags')
            .insert(tagIds.map((tagId) => ({ story_id: storyId, tag_id: tagId })));

        if (storyTagsError) {
            return { success: false, error: storyTagsError.message };
        }
    }

    return { success: true };
}

/**
 * Process story starts
 */
async function processStoryStarts(
    storyId: string,
    storyStarts: StoryStart[] = []
): Promise<{ success: boolean; error?: string }> {
    if (storyStarts.length === 0) {
        return { success: true };
    }

    const validStarts = storyStarts
        .filter((start) =>
            start &&
            typeof start.title === 'string' &&
            start.title.trim() !== '' &&
            typeof start.content === 'string' &&
            start.content.trim() !== '' &&
            typeof start.sort_order === 'number'
        )
        .map((start) => ({
            story_id: storyId,
            title: start.title.trim(),
            first_message: start.content.trim(),
            sort_order: start.sort_order,
        }));

    if (validStarts.length === 0) {
        return { success: true };
    }

    const { error: storyStartsError } = await supabase
        .from('story_starts')
        .insert(validStarts);

    if (storyStartsError) {
        return { success: false, error: storyStartsError.message };
    }

    return { success: true };
}

/**
 * Build API response
 */
function buildResponse(
    status: number,
    data: Record<string, any>,
    headers?: Record<string, string>
): Response {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: { ...defaultHeaders, ...headers }
        }
    );
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export const POST: APIRoute = async ({ request }) => {
    try {
        // 1. Parse form data
        const { storyData, coverImageFile } = await parseFormData(request);

        // 2. Validate required fields
        const validation = validateStoryData(storyData);
        if (!validation.isValid) {
            return buildResponse(400, { error: validation.error });
        }

        // 3. Create story record (with empty cover image URL)
        const { story, error: createError } = await createStoryRecord(storyData);
        if (createError || !story) {
            return buildResponse(500, {
                error: createError?.message || 'Failed to create story.'
            });
        }

        // Validate story has ID
        if (!story.id) {
            return buildResponse(500, {
                error: 'Story created but missing ID'
            });
        }

        // 4. Upload cover image if provided
        const uploadResult = await uploadCoverImageIfProvided(coverImageFile, story);

        // 5. Process tags
        const tagsResult = await processTags(
            story.id!,
            storyData.tags,
            resolveAuthorId(storyData)
        );
        if (!tagsResult.success) {
            // Story already created, but tag processing failed
            return buildResponse(207, {
                success: true,
                story,
                warnings: [
                    `Story created successfully but failed to process tags: ${tagsResult.error}`,
                    ...(uploadResult.success ? [] : [`Cover image upload failed: ${uploadResult.error}`])
                ].filter(Boolean)
            });
        }

        // 6. Process story starts
        const storyStartsResult = await processStoryStarts(
            story.id!,
            resolveStoryStarts(storyData)
        );
        if (!storyStartsResult.success) {
            // Story created, tags processed, but story starts failed
            return buildResponse(207, {
                success: true,
                story,
                warnings: [
                    `Story created successfully but failed to process story starts: ${storyStartsResult.error}`,
                    ...(uploadResult.success ? [] : [`Cover image upload failed: ${uploadResult.error}`])
                ].filter(Boolean)
            });
        }

        // 7. Return final response
        if (!uploadResult.success) {
            // Story created successfully, but cover image upload failed
            return buildResponse(207, {
                success: true,
                story,
                warning: `Story created successfully but cover image upload failed: ${uploadResult.error}`,
                cover_image_url: '' // Still empty string
            });
        }

        // Everything succeeded
        return buildResponse(201, {
            success: true,
            story: {
                ...story,
                cover_image_url: uploadResult.coverImageUrl || ''
            }
        });

    } catch (error) {
        console.error('Create story error:', error);
        return buildResponse(500, {
            error: 'Failed to create story',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

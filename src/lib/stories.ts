import { supabase, createAuthedClient } from './supabase';
import type { SupabaseClient } from './supabase';
import type { Story } from './types';

/**
 * Upload a cover image to Supabase Storage bucket "images"
 * @param file - The image file to upload (JPEG, PNG, or WebP)
 * @param storyId - The story UUID (used in file path)
 * @param title - The story title (used in file path)
 * @returns The public URL of the uploaded image or error
 */
export async function uploadCoverImage(
    file: File,
    storyId: string,
    title: string,
    client?: SupabaseClient
): Promise<{ url: string | null; error: Error | null }> {
    try {
        // Validate UUID format (basic check)
        if (!storyId || typeof storyId !== 'string' || storyId.trim() === '') {
            throw new Error('Invalid story ID: must be a non-empty string');
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            throw new Error(`Invalid file type: ${file.type}. Supported types: JPEG, PNG, WebP`);
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new Error(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 5MB limit`);
        }

        // Sanitize title for file path
        const sanitizedTitle = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${storyId}-${sanitizedTitle}/cover.${fileExt}`;

        // Use the authenticated client if provided (required when bucket RLS restricts anon writes)
        const storageClient = client ?? supabase;

        // Delete any existing file first (ignore error — file may not exist yet).
        // This avoids the UPDATE/SELECT RLS check triggered by upsert: true,
        // which fails when bucket policies only allow INSERT.
        await storageClient.storage.from('images_2').remove([fileName]);

        const { error } = await storageClient.storage
            .from('images_2')
            .upload(fileName, file, {
                cacheControl: 'public, max-age=31536000, immutable',
                upsert: false,
            });

        if (error) throw error;

        // Get public URL (always use the same base client — public URL is deterministic)
        const { data: urlData } = storageClient.storage
            .from('images_2')
            .getPublicUrl(fileName);

        return { url: urlData.publicUrl, error: null };
    } catch (error) {
        return { url: null, error: error as Error };
    }
}

/**
 * Create a new story in the database
 * @param storyData - The story data to insert
 * @param client - Optional authenticated Supabase client (required for RLS INSERT policies)
 * @returns The created story or error
 */
export async function createStory(
    storyData: Omit<Story, 'created_at' | 'rating' | 'updated_at'>,
    client?: SupabaseClient
): Promise<{ data: Story | null; error: Error | null }> {
    try {
        const db = client ?? supabase;
        const { data, error } = await db
            .from('stories')
            .insert([storyData])
            .select()
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as Error };
    }
}

/**
 * Get a story by ID
 * @param id - The story ID
 * @returns The story or error
 */
export async function getStoryById(id: string): Promise<{ data: Story | null; error: Error | null }> {
    try {
        const { data, error } = await supabase
            .from('stories')
            .select()
            .eq('id', id)
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as Error };
    }
}

/**
 * Get all stories for a user
 * @param userId - The user ID
 * @returns Array of stories or error
 */
export async function getUserStories(userId: string): Promise<{ data: Story[] | null; error: Error | null }> {
    try {
        const { data, error } = await supabase
            .from('stories')
            .select()
            .eq('author_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as Error };
    }
}

/**
 * Update a story
 * @param id - The story ID
 * @param storyData - The story data to update
 * @returns The updated story or error
 */
export async function updateStory(
    id: string,
    storyData: Partial<Story>,
    client?: SupabaseClient
): Promise<{ data: Story | null; error: Error | null }> {

    try {
        const db = client ?? supabase;
        const { data, error } = await db
            .from('stories')
            .update(storyData)
            .eq('id', id)
            .select("*")
            .maybeSingle()
        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        return { data: null, error: error as Error };
    }
}

/**
 * Delete a story
 * @param id - The story ID
 * @returns Success status or error
 */
export async function deleteStory(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await supabase
            .from('stories')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error as Error };
    }
}
import type { SupabaseClient } from './supabase';

/**
 * Upload an editor image to Supabase Storage bucket "images" under editor-images/{storyId}/
 * @param file - The image file to upload (JPEG, PNG, or WebP)
 * @param storyId - The story UUID (used in file path)
 * @returns The public URL of the uploaded image or error
 */
export async function uploadEditorImage(
    file: File,
    storyId: string,
    client: SupabaseClient
): Promise<{ url: string | null; error: Error | null }> {
    try {
        // Validate storyId
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

        // Generate safe filename
        const timestamp = Date.now();
        const sanitizedName = file.name
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .replace(/^_+|_+$/g, '');
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${timestamp}-${sanitizedName}`;
        const filePath = `editor-images/${storyId}/${fileName}.${fileExt}`;

        const { error } = await client.storage
            .from('images_2')
            .upload(filePath, file, {
                cacheControl: 'public, max-age=31536000, immutable',
                upsert: false, // Don't overwrite existing files
            });

        if (error) throw error;

        // Get public URL
        const { data: urlData } = client?.storage
            .from('images_2')
            .getPublicUrl(filePath);

        return { url: urlData.publicUrl, error: null };
    } catch (error) {
        console.error('Editor image upload error:', error);
        return { url: null, error: error as Error };
    }
}

/**
 * Delete an editor image from Supabase Storage
 * @param filePath - Full path to the file in storage (e.g., "editor-images/{storyId}/{filename}")
 * @returns Success status or error
 */
export async function deleteEditorImage(
    filePath: string,
    client: SupabaseClient
): Promise<{ success: boolean; error: Error | null }> {
    try {
        const { error } = await client.storage
            .from('images_2')
            .remove([filePath]);

        if (error) throw error;

        return { success: true, error: null };
    } catch (error) {
        console.error('Editor image deletion error:', error);
        return { success: false, error: error as Error };
    }
}

/**
 * List all editor images for a story
 * @param storyId - The story UUID
 * @returns Array of image URLs and paths or error
 */
export async function listEditorImages(
    storyId: string,
    client: SupabaseClient
): Promise<{ data: Array<{ url: string; path: string }> | null; error: Error | null }> {
    try {
        const { data, error } = await client.storage
            .from('images_2')
            .list(`editor-images/${storyId}`);

        if (error) throw error;

        const images = (data || []).map(item => {
            const path = `editor-images/${storyId}/${item.name}`;
            const { data: urlData } = client.storage
                .from('images_2')
                .getPublicUrl(path);
            return {
                url: urlData.publicUrl,
                path
            };
        });

        return { data: images, error: null };
    } catch (error) {
        console.error('Editor image listing error:', error);
        return { data: null, error: error as Error };
    }
}
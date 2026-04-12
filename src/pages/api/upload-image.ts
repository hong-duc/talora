import type { APIRoute } from 'astro';
import { uploadCoverImage } from '../../lib/stories';
import { uploadEditorImage } from '../../lib/editor-images';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const storyId = formData.get('storyId') as string;
        const title = formData.get('title') as string;
        const type = (formData.get('type') as string) || 'cover'; // 'cover' or 'editor'

        // Validate file
        if (!file) {
            return new Response(
                JSON.stringify({ error: 'No file provided' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return new Response(
                JSON.stringify({ error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return new Response(
                JSON.stringify({ error: 'File size exceeds 5MB limit' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Validate storyId
        if (!storyId) {
            return new Response(
                JSON.stringify({ error: 'Story ID is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let url: string | null = null;
        let error: Error | null = null;

        if (type === 'editor') {
            // Upload editor image (title not required)
            const result = await uploadEditorImage(file, storyId);
            url = result.url;
            error = result.error;
        } else {
            // Upload cover image (title required)
            if (!title) {
                return new Response(
                    JSON.stringify({ error: 'Title is required for cover images' }),
                    { status: 400, headers: { 'Content-Type': 'application/json' } }
                );
            }
            const result = await uploadCoverImage(file, storyId, title);
            url = result.url;
            error = result.error;
        }

        if (error || !url) {
            return new Response(
                JSON.stringify({ error: error?.message || 'Failed to upload image' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, url, type }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Upload error:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to upload image' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

import type { APIRoute } from 'astro';
import { requireAuth, jsonResponse } from '../../../lib/api-auth';
import { createAuthedClient } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {

    // Authenticate
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    // Create a single authenticated client for the entire request
    const supabase = createAuthedClient(auth.token);

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return jsonResponse({ error: 'No file provided' }, 400);
        }

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            return jsonResponse(
                { error: 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.' },
                400
            );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return jsonResponse({ error: 'File size exceeds 5MB limit' }, 400);
        }

        // Determine file extension
        const extMap: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
        };
        const ext = extMap[file.type] || 'jpg';

        // Upload to images bucket at avatars/<userId>.<ext>
        const filePath = `avatars/${auth.userId}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('images_2')
            .upload(filePath, file, {
                cacheControl: 'public, max-age=3600',
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            console.error('Avatar upload error:', uploadError);
            return jsonResponse({ error: uploadError.message || 'Failed to upload avatar' }, 500);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('images_2')
            .getPublicUrl(filePath);

        const avatarUrl = urlData.publicUrl;

        // Update profiles table with new avatar_url
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', auth.userId)
            .select('id, username, avatar_url, bio, created_at')
            .single();

        if (profileError) {
            console.error('Profile update error:', profileError);
            return jsonResponse({ error: profileError.message || 'Failed to update profile' }, 500);
        }

        return jsonResponse({ success: true, url: avatarUrl, profile });
    } catch (err) {
        console.error('upload-avatar unexpected error:', err);
        return jsonResponse({ error: 'Unexpected server error' }, 500);
    }
};

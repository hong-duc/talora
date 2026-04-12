import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getProfileByUserId } from '../../../lib/auth';


export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        // Accept an access token from the Authorization header sent by the client
        const authHeader = request.headers.get('Authorization');
        const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        let userId: string | null = null;

        if (accessToken) {
            // Validate the token by calling getUser with it
            const { data, error } = await supabase.auth.getUser(accessToken);
            if (!error && data?.user) {
                userId = data.user.id;
            }
        }

        if (!userId) {
            return new Response(
                JSON.stringify({ signedIn: false, profile: null }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { data: profile, error: profileError } = await getProfileByUserId(userId);

        if (profileError) {
            return new Response(
                JSON.stringify({ error: profileError.message || 'Failed to load profile.' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({ signedIn: true, profile }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: 'Failed to check session.' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};

import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getProfileByUserId } from '../../../lib/auth';


export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const { data, error } = await supabase.auth.getUser();

        if (error || !data?.user) {
            return new Response(
                JSON.stringify({ signedIn: false, profile: null }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const { data: profile, error: profileError } = await getProfileByUserId(data.user.id);

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

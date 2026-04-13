/**
 * api-auth.ts
 * Shared helper for authenticating requests in API route handlers.
 *
 * Why: Several API routes need the same "get user from Bearer token" logic.
 * Centralising it avoids copy-paste and keeps each route focused on its job.
 *
 * How: Reads the Authorization header, validates the token with Supabase,
 * and returns the user ID or null if unauthenticated.
 */

import { supabase } from './supabase';

/** Result of authenticating a request */
export type AuthResult =
    | { userId: string; error: null }
    | { userId: null; error: Response };

/**
 * Authenticate the request via Bearer token.
 * Returns the authenticated userId, or a ready-to-return 401 Response.
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return {
            userId: null,
            error: json401('Missing or invalid Authorization header'),
        };
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        return {
            userId: null,
            error: json401('Invalid or expired token'),
        };
    }

    return { userId: data.user.id, error: null };
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/** Build a JSON 401 response */
function json401(message: string): Response {
    return jsonResponse({ error: message }, 401);
}

/** Build a JSON response with the given status */
export function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * api-auth.ts
 * Shared helper for authenticating requests in API route handlers.
 *
 * Why: Several API routes need the same "get user from Bearer token" logic.
 * Centralising it avoids copy-paste and keeps each route focused on its job.
 *
 * How: Reads the Authorization header, validates the token with Supabase,
 * and returns the user ID + raw token (needed to create an authenticated DB
 * client that satisfies RLS) or a ready-made 401 Response on failure.
 *
 * Performance note: `requireAuth` calls `supabase.auth.getUser(token)` which
 * makes a remote round-trip to Supabase on every request to guarantee the
 * token hasn't been revoked. If latency becomes a concern, consider verifying
 * the JWT signature locally with `jose` + SUPABASE_JWT_SECRET, and only
 * calling getUser when you need hard revocation guarantees.
 */

import { supabase } from './supabase';

/** Result of authenticating a request */
export type AuthResult =
    | { userId: string; token: string; error: null }
    | { userId: null; token: null; error: Response };

/**
 * Authenticate the request via Bearer token.
 * Returns the authenticated userId + raw JWT token, or a ready-to-return
 * 401 Response.
 *
 * The token is returned so callers can create an authenticated Supabase
 * client (createAuthedClient) that forwards the JWT to PostgREST, making
 * auth.uid() non-null and allowing RLS policies to work correctly.
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
    let token: string | null = null;

    // 1. Try to get the token from the Authorization header (for API calls)
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    } else {
        // 2. Try to get the token from cookies (for direct browser navigations to SSR pages)
        //    Note: split on the first '=' only, since JWT values contain '=' padding characters.
        const cookieHeader = request.headers.get('Cookie');
        const cookies: Record<string, string> = {};
        cookieHeader?.split('; ').forEach((c) => {
            const idx = c.indexOf('=');
            if (idx > -1) cookies[c.slice(0, idx)] = c.slice(idx + 1);
        });
        token = cookies['sb-access-token'] ?? null;
    }

    if (!token) {
        return {
            userId: null,
            token: null,
            error: json401('Missing or invalid Authorization header'),
        };
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
        return {
            userId: null,
            token: null,
            error: json401('Invalid or expired token'),
        };
    }

    return { userId: data.user.id, token, error: null };
}

// ─── Response helpers ─────────────────────────────────────────────────────────

/** Build a JSON 401 response */
export function json401(message: string): Response {
    return jsonResponse({ error: message }, 401);
}

/**
 * Build a JSON response with the given status.
 *
 * @param body    - Any JSON-serialisable value.
 * @param status  - HTTP status code (default 200).
 * @param headers - Optional extra headers (e.g. CORS headers for cross-origin callers).
 */
export function jsonResponse(
    body: unknown,
    status = 200,
    headers: Record<string, string> = {}
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
    });
}

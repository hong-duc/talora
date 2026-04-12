import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getProfileByUserId } from '../../../lib/auth';
import { checkRateLimit, sanitizeString, createApiResponse, createApiHandler } from '../../../lib/api-utils';
import { errors } from '../../../lib/error';

export const prerender = false;

const signInHandler = async ({ request }: Parameters<APIRoute>[0]) => {
    try {
        const body = await request.json();
        const email = typeof body?.email === 'string' ? sanitizeString(body.email).trim() : '';
        const password = typeof body?.password === 'string' ? sanitizeString(body.password).trim() : '';

        if (!email || !password) {
            return createApiResponse(false, errors.validation('Email and password are required.'));
        }

        // Check rate limit for this email (prevent brute force)
        const rateLimitKey = `signin:${email.toLowerCase()}`;
        const rateLimit = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000); // 5 attempts per 15 minutes

        if (!rateLimit.allowed) {
            return createApiResponse(false, errors.tooManyRequests(
                'Too many sign-in attempts. Please try again later.',
                { resetTime: rateLimit.resetTime.toString() }
            ));
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return createApiResponse(false, errors.validation('Invalid email format.'));
        }

        // Validate password length
        if (password.length < 6) {
            return createApiResponse(false, errors.validation('Password must be at least 6 characters.'));
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error || !data?.user) {
            return createApiResponse(false, errors.unauthorized(
                error?.message || 'Invalid credentials.'
            ));
        }

        const { data: profile, error: profileError } = await getProfileByUserId(data.user.id);

        if (profileError) {
            return createApiResponse(false, errors.database(
                'Failed to load user profile.',
                profileError
            ));
        }

        return createApiResponse(true, { profile, session: data.session });
    } catch (error) {
        return createApiResponse(false, errors.unknown('Failed to sign in.', error as Error));
    }
};

export const POST = createApiHandler(signInHandler);

/**
 * API utilities for consistent response handling and validation
 */

import type { APIRoute } from 'astro';
import { errors, formatErrorForResponse, errorToStatusCode, type AppError } from './error';
import { validateSchema, type ValidationResult } from './validation';

// Standard API response types
export type ApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
    type?: string;
    details?: Record<string, string>;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
};

// Standard API error response
export type ApiErrorResponse = {
    success: false;
    error: string;
    type: string;
    details?: Record<string, string>;
};

// Standard API success response
export type ApiSuccessResponse<T = any> = {
    success: true;
    data: T;
    pagination?: ApiResponse['pagination'];
};

// Helper to create standardized API responses
export function createApiResponse<T = any>(
    success: true,
    data: T,
    pagination?: ApiResponse['pagination']
): ApiSuccessResponse<T>;

export function createApiResponse(
    success: false,
    error: AppError
): ApiErrorResponse;

export function createApiResponse<T = any>(
    success: boolean,
    dataOrError: T | AppError,
    pagination?: ApiResponse['pagination']
): ApiResponse<T> {
    if (!success) {
        const error = dataOrError as AppError;
        const formatted = formatErrorForResponse(error);
        return {
            success: false,
            error: formatted.error,
            type: formatted.type,
            details: formatted.details,
        };
    }

    return {
        success: true,
        data: dataOrError as T,
        pagination,
    };
}

// Helper to send standardized HTTP responses
export function sendResponse<T = any>(
    response: ApiResponse<T>,
    init?: ResponseInit
): Response {
    const status = response.success
        ? (init?.status || 200)
        : errorToStatusCode({
            type: response.type as AppError['type'],
            message: response.error || 'Unknown error',
            ...(response.details && { details: response.details }),
        } as AppError);

    return new Response(JSON.stringify(response), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
}

// Helper to wrap API route handlers with standardized error handling
export function createApiHandler<T = any>(
    handler: (context: Parameters<APIRoute>[0]) => Promise<ApiResponse<T>>
): APIRoute {
    return async (context) => {
        try {
            const response = await handler(context);
            return sendResponse(response);
        } catch (error) {
            // Handle unexpected errors
            const appError = error instanceof Error
                ? errors.unknown('An unexpected error occurred', error)
                : errors.unknown('An unknown error occurred');

            return sendResponse(createApiResponse(false, appError));
        }
    };
}

// Helper to validate request body with schema
export async function validateRequestBody<T extends Record<string, any>>(
    request: Request,
    schema: Parameters<typeof validateSchema<T>>[0]
): Promise<ValidationResult<T>> {
    try {
        const body = await request.json();
        return validateSchema<T>(schema, body);
    } catch (error) {
        return {
            valid: false,
            error: errors.validation('Invalid JSON request body'),
        };
    }
}

// Helper to validate request query parameters
export function validateQueryParams<T extends Record<string, any>>(
    url: URL,
    schema: Parameters<typeof validateSchema<T>>[0]
): ValidationResult<T> {
    const params: Record<string, unknown> = {};
    url.searchParams.forEach((value, key) => {
        params[key] = value;
    });

    return validateSchema<T>(schema, params);
}

// Pagination utilities
export type PaginationOptions = {
    page?: number;
    limit?: number;
    maxLimit?: number;
};

export function parsePagination(
    url: URL,
    options: PaginationOptions = {}
): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1') || 1);
    const maxLimit = options.maxLimit || 100;
    const defaultLimit = options.limit || 20;

    let limit = parseInt(url.searchParams.get('limit') || defaultLimit.toString()) || defaultLimit;
    limit = Math.min(Math.max(1, limit), maxLimit);

    const offset = (page - 1) * limit;

    return { page, limit, offset };
}

export function createPaginationMeta(
    page: number,
    limit: number,
    total: number
): ApiResponse['pagination'] {
    const totalPages = Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}

// Rate limiting helper (basic in-memory implementation for development)
// In production, use a proper rate limiting solution like Redis
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
    key: string,
    limit: number = 100,
    windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime < now) {
        // New window
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + windowMs,
        });
        return {
            allowed: true,
            remaining: limit - 1,
            resetTime: now + windowMs,
        };
    }

    if (entry.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.resetTime,
        };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: limit - entry.count,
        resetTime: entry.resetTime,
    };
}

// Input sanitization helpers
export function sanitizeString(input: string): string {
    return input
        .trim()
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/data:/gi, ''); // Remove data: protocol
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const sanitized = { ...obj };

    for (const key in sanitized) {
        if (typeof sanitized[key] === 'string') {
            sanitized[key] = sanitizeString(sanitized[key]) as any;
        } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
            sanitized[key] = sanitizeObject(sanitized[key]);
        }
    }

    return sanitized;
}

// CORS helper for API responses
export function withCors(response: Response, origin: string = '*'): Response {
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
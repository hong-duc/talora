/**
 * Error handling utilities for consistent error patterns across the application
 */

import type { AuthError } from '@supabase/supabase-js';

// Base application error types
export type AppError =
    | { type: 'VALIDATION_ERROR'; message: string; details?: Record<string, string> }
    | { type: 'AUTH_ERROR'; message: string; originalError?: AuthError }
    | { type: 'DATABASE_ERROR'; message: string; originalError?: Error }
    | { type: 'STORAGE_ERROR'; message: string; originalError?: Error }
    | { type: 'NETWORK_ERROR'; message: string; originalError?: Error }
    | { type: 'NOT_FOUND'; message: string; resource: string }
    | { type: 'UNAUTHORIZED'; message: string }
    | { type: 'TOO_MANY_REQUESTS'; message: string; details?: Record<string, string> }
    | { type: 'UNKNOWN_ERROR'; message: string; originalError?: Error };

// Success/error discriminated union for consistent API responses
export type Result<T, E = AppError> =
    | { success: true; data: T; error: null }
    | { success: false; data: null; error: E };

// Helper to create success result
export function success<T>(data: T): Result<T> {
    return { success: true, data, error: null };
}

// Helper to create error result
export function failure<E extends AppError>(error: E): Result<never, E> {
    return { success: false, data: null, error };
}

// Error creators for specific error types
export const errors = {
    validation: (message: string, details?: Record<string, string>): AppError => ({
        type: 'VALIDATION_ERROR',
        message,
        details,
    }),
    auth: (message: string, originalError?: AuthError): AppError => ({
        type: 'AUTH_ERROR',
        message,
        originalError,
    }),
    database: (message: string, originalError?: Error): AppError => ({
        type: 'DATABASE_ERROR',
        message,
        originalError,
    }),
    storage: (message: string, originalError?: Error): AppError => ({
        type: 'STORAGE_ERROR',
        message,
        originalError,
    }),
    network: (message: string, originalError?: Error): AppError => ({
        type: 'NETWORK_ERROR',
        message,
        originalError,
    }),
    notFound: (message: string, resource: string): AppError => ({
        type: 'NOT_FOUND',
        message,
        resource,
    }),
    unauthorized: (message: string): AppError => ({
        type: 'UNAUTHORIZED',
        message,
    }),
    tooManyRequests: (message: string, details?: Record<string, string>): AppError => ({
        type: 'TOO_MANY_REQUESTS',
        message,
        details,
    }),
    unknown: (message: string, originalError?: Error): AppError => ({
        type: 'UNKNOWN_ERROR',
        message,
        originalError,
    }),
};

// Type guard to check if an error is an AppError
export function isAppError(error: unknown): error is AppError {
    return typeof error === 'object' && error !== null && 'type' in error && 'message' in error;
}

// Convert unknown error to AppError
export function toAppError(error: unknown): AppError {
    if (isAppError(error)) {
        return error;
    }

    if (error instanceof Error) {
        // Check for common error patterns
        if (error.message.includes('network') || error.message.includes('fetch')) {
            return errors.network('Network error occurred', error);
        }

        if (error.message.includes('auth') || error.message.includes('permission')) {
            return errors.auth('Authentication error', error as AuthError);
        }

        return errors.unknown('An unexpected error occurred', error);
    }

    return errors.unknown('An unknown error occurred');
}

// Convert AppError to HTTP status code
export function errorToStatusCode(error: AppError): number {
    switch (error.type) {
        case 'VALIDATION_ERROR':
            return 400;
        case 'AUTH_ERROR':
        case 'UNAUTHORIZED':
            return 401;
        case 'TOO_MANY_REQUESTS':
            return 429;
        case 'NOT_FOUND':
            return 404;
        case 'NETWORK_ERROR':
            return 502;
        case 'DATABASE_ERROR':
        case 'STORAGE_ERROR':
            return 500;
        case 'UNKNOWN_ERROR':
        default:
            return 500;
    }
}

// Format error for API response
export function formatErrorForResponse(error: AppError): {
    error: string;
    type: string;
    details?: Record<string, string>;
} {
    const base = {
        error: error.message,
        type: error.type,
    };

    if (error.type === 'VALIDATION_ERROR' && error.details) {
        return { ...base, details: error.details };
    }

    if (error.type === 'NOT_FOUND') {
        return { ...base, details: { resource: error.resource } };
    }

    if (error.type === 'TOO_MANY_REQUESTS' && error.details) {
        return { ...base, details: error.details };
    }

    return base;
}

// Safe try-catch wrapper for async operations
export async function safeAsync<T>(
    operation: () => Promise<T>,
    errorHandler?: (error: unknown) => AppError
): Promise<Result<T>> {
    try {
        const result = await operation();
        return success(result);
    } catch (error) {
        const appError = errorHandler ? errorHandler(error) : toAppError(error);
        return failure(appError);
    }
}
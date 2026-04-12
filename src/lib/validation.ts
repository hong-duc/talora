/**
 * Validation utilities for consistent input validation across the application
 */

import { errors } from './error';
import type { AppError } from './error';

// Common validation patterns
export const patterns = {
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    username: /^[a-zA-Z0-9_-]{3,50}$/,
    storyTitle: /^[\w\s\-\'\"\.\!\?]{1,255}$/,
    url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
};

// Validation result type
export type ValidationResult<T> =
    | { valid: true; value: T }
    | { valid: false; error: AppError };

// Validator interface
export interface Validator<T> {
    (value: unknown): ValidationResult<T>;
}

// Validator builders
export const validators = {
    required: <T>(fieldName: string): Validator<T> => (value: unknown) => {
        if (value === null || value === undefined || value === '') {
            return {
                valid: false,
                error: errors.validation(`${fieldName} is required`, { field: fieldName }),
            };
        }
        return { valid: true, value: value as T };
    },

    string: (fieldName: string, options?: { minLength?: number; maxLength?: number; pattern?: RegExp }): Validator<string> =>
        (value: unknown) => {
            if (typeof value !== 'string') {
                return {
                    valid: false,
                    error: errors.validation(`${fieldName} must be a string`, { field: fieldName }),
                };
            }

            const trimmed = value.trim();

            if (options?.minLength !== undefined && trimmed.length < options.minLength) {
                return {
                    valid: false,
                    error: errors.validation(
                        `${fieldName} must be at least ${options.minLength} characters`,
                        { field: fieldName, minLength: options.minLength.toString() }
                    ),
                };
            }

            if (options?.maxLength !== undefined && trimmed.length > options.maxLength) {
                return {
                    valid: false,
                    error: errors.validation(
                        `${fieldName} must not exceed ${options.maxLength} characters`,
                        { field: fieldName, maxLength: options.maxLength.toString() }
                    ),
                };
            }

            if (options?.pattern && !options.pattern.test(trimmed)) {
                return {
                    valid: false,
                    error: errors.validation(
                        `${fieldName} has invalid format`,
                        { field: fieldName }
                    ),
                };
            }

            return { valid: true, value: trimmed };
        },

    uuid: (fieldName: string): Validator<string> => (value: unknown) => {
        const stringResult = validators.string(fieldName)(value);
        if (!stringResult.valid) return stringResult;

        if (!patterns.uuid.test(stringResult.value)) {
            return {
                valid: false,
                error: errors.validation(
                    `${fieldName} must be a valid UUID`,
                    { field: fieldName }
                ),
            };
        }

        return { valid: true, value: stringResult.value };
    },

    email: (fieldName: string): Validator<string> => (value: unknown) => {
        const stringResult = validators.string(fieldName)(value);
        if (!stringResult.valid) return stringResult;

        if (!patterns.email.test(stringResult.value)) {
            return {
                valid: false,
                error: errors.validation(
                    `${fieldName} must be a valid email address`,
                    { field: fieldName }
                ),
            };
        }

        return { valid: true, value: stringResult.value };
    },

    number: (fieldName: string, options?: { min?: number; max?: number }): Validator<number> =>
        (value: unknown) => {
            if (typeof value !== 'number' && (typeof value !== 'string' || isNaN(Number(value)))) {
                return {
                    valid: false,
                    error: errors.validation(`${fieldName} must be a number`, { field: fieldName }),
                };
            }

            const num = typeof value === 'string' ? Number(value) : value as number;

            if (options?.min !== undefined && num < options.min) {
                return {
                    valid: false,
                    error: errors.validation(
                        `${fieldName} must be at least ${options.min}`,
                        { field: fieldName, min: options.min.toString() }
                    ),
                };
            }

            if (options?.max !== undefined && num > options.max) {
                return {
                    valid: false,
                    error: errors.validation(
                        `${fieldName} must not exceed ${options.max}`,
                        { field: fieldName, max: options.max.toString() }
                    ),
                };
            }

            return { valid: true, value: num };
        },

    array: <T>(fieldName: string, itemValidator?: Validator<T>): Validator<T[]> =>
        (value: unknown) => {
            if (!Array.isArray(value)) {
                return {
                    valid: false,
                    error: errors.validation(`${fieldName} must be an array`, { field: fieldName }),
                };
            }

            if (itemValidator) {
                const validatedItems: T[] = [];
                for (let i = 0; i < value.length; i++) {
                    const itemResult = itemValidator(value[i]);
                    if (!itemResult.valid) {
                        return {
                            valid: false,
                            error: errors.validation(
                                `${fieldName}[${i}] is invalid: ${itemResult.error.message}`,
                                { field: `${fieldName}[${i}]` }
                            ),
                        };
                    }
                    validatedItems.push(itemResult.value);
                }
                return { valid: true, value: validatedItems };
            }

            return { valid: true, value: value as T[] };
        },

    file: (fieldName: string, options?: {
        maxSize?: number;
        allowedTypes?: string[];
    }): Validator<File> => (value: unknown) => {
        if (!(value instanceof File)) {
            return {
                valid: false,
                error: errors.validation(`${fieldName} must be a file`, { field: fieldName }),
            };
        }

        if (options?.maxSize && value.size > options.maxSize) {
            return {
                valid: false,
                error: errors.validation(
                    `${fieldName} exceeds maximum size of ${options.maxSize / 1024 / 1024}MB`,
                    { field: fieldName, maxSize: options.maxSize.toString() }
                ),
            };
        }

        if (options?.allowedTypes && !options.allowedTypes.includes(value.type)) {
            return {
                valid: false,
                error: errors.validation(
                    `${fieldName} must be one of: ${options.allowedTypes.join(', ')}`,
                    { field: fieldName, allowedTypes: options.allowedTypes.join(',') }
                ),
            };
        }

        return { valid: true, value };
    },
};

// Schema validation
export type Schema<T> = {
    [K in keyof T]: Validator<T[K]>;
};

export function validateSchema<T extends Record<string, any>>(
    schema: Schema<T>,
    data: unknown
): ValidationResult<T> {
    if (typeof data !== 'object' || data === null) {
        return {
            valid: false,
            error: errors.validation('Invalid input data', { reason: 'data must be an object' }),
        };
    }

    const validatedData: Partial<T> = {};
    const errorsMap: Record<string, string> = {};

    for (const [key, validator] of Object.entries(schema)) {
        const value = (data as any)[key];
        const result = validator(value);

        if (!result.valid) {
            errorsMap[key] = result.error.message;
        } else {
            validatedData[key as keyof T] = result.value;
        }
    }

    if (Object.keys(errorsMap).length > 0) {
        return {
            valid: false,
            error: errors.validation('Validation failed', errorsMap),
        };
    }

    return { valid: true, value: validatedData as T };
}

// Common schemas
export const storySchema = {
    author_id: validators.uuid('author_id'),
    title: validators.string('title', { minLength: 1, maxLength: 255 }),
    description: validators.string('description', { maxLength: 2000 }),
    world_prompt: validators.string('world_prompt', { minLength: 1, maxLength: 5000 }),
    cover_image_url: (value: unknown) => {
        if (value === null || value === undefined || value === '') {
            return { valid: true, value: undefined as unknown as string };
        }
        return validators.string('cover_image_url', { maxLength: 2000 })(value);
    },
} as Schema<{
    author_id: string;
    title: string;
    description?: string;
    world_prompt: string;
    cover_image_url?: string;
}>;

// Helper to validate and transform
export function validate<T>(validator: Validator<T>, value: unknown): T {
    const result = validator(value);
    if (!result.valid) {
        throw new Error(result.error.message);
    }
    return result.value;
}

// Batch validation helper
export function validateAll<T extends Record<string, Validator<any>>>(
    validators: T,
    data: Record<string, unknown>
): { [K in keyof T]: ReturnType<T[K]> extends ValidationResult<infer U> ? U : never } {
    const result: any = {};
    const errors: string[] = [];

    for (const [key, validator] of Object.entries(validators)) {
        const validationResult = validator(data[key]);
        if (validationResult.valid) {
            result[key] = validationResult.value;
        } else {
            errors.push(`${key}: ${validationResult.error.message}`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`Validation failed:\n${errors.join('\n')}`);
    }

    return result;
}
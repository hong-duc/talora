/**
 * General utility functions for the application
 */

/**
 * Debounce function to limit how often a function can be called
 * @param func - The function to debounce
 * @param wait - Wait time in milliseconds
 * @param immediate - Whether to call immediately on first invocation
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate = false
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function (...args: Parameters<T>) {
        const shouldCallImmediately = immediate && !timeout;

        const later = () => {
            timeout = null;
            if (!immediate) {
                func(...args);
            }
        };

        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(later, wait);

        if (shouldCallImmediately) {
            func(...args);
        }
    };
}

/**
 * Throttle function to limit how often a function can be called
 * @param func - The function to throttle
 * @param limit - Time limit in milliseconds between calls
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    let lastFunc: NodeJS.Timeout;
    let lastRan: number;

    return function (...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            lastRan = Date.now();
            inThrottle = true;
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(
                () => {
                    if (Date.now() - lastRan >= limit) {
                        func(...args);
                        lastRan = Date.now();
                    }
                },
                limit - (Date.now() - lastRan)
            );
        }
    };
}

/**
 * Safely parse JSON with error handling
 * @param text - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
    try {
        return JSON.parse(text) as T;
    } catch {
        return fallback;
    }
}

/**
 * Generate a unique ID (simple implementation)
 * @returns Unique ID string
 */
export function generateId(): string {
    return Math.random().toString(36).substring(2, 9);
}

/**
 * Convert hex color to RGBA
 * @param hex - Hex color string (e.g., '#d4af37')
 * @param alpha - Alpha value (0-1)
 * @returns RGBA string
 */
export function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const value =
        clean.length === 3
            ? clean
                .split('')
                .map((c) => c + c)
                .join('')
            : clean;
    const bigint = parseInt(value, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Normalize string for comparison (trim, lowercase)
 * @param str - String to normalize
 * @returns Normalized string
 */
export function normalizeString(str: string): string {
    return str.trim().toLowerCase();
}

/**
 * Check if two values are deeply equal (simple implementation for objects/arrays)
 * @param a - First value
 * @param b - Second value
 * @returns Whether values are deeply equal
 */
export function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
            return false;
        }
    }

    return true;
}

/**
 * Create a promise that rejects after a timeout
 * @param promise - Promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message for timeout
 * @returns Promise that rejects on timeout
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage = 'Operation timed out'
): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        ),
    ]);
}

/**
 * Retry an async function with exponential backoff
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries
 * @param initialDelay - Initial delay in milliseconds
 * @returns Result of the async function
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
): Promise<T> {
    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, i);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError!;
}

/**
 * Extract error message from unknown error
 * @param error - Unknown error value
 * @param defaultMessage - Default message if error cannot be extracted
 * @returns Error message string
 */
export function getErrorMessage(error: unknown, defaultMessage = 'An error occurred'): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return defaultMessage;
}
/**
 * Application constants and configuration values
 */

// Colors
export const COLORS = {
    FALLBACK: '#6b7280',
    ACCENT_GOLD: '#d4af37',
    PRIMARY: '#201528',
    SLATE: {
        100: '#f1f5f9',
        200: '#e2e8f0',
        300: '#cbd5e1',
        400: '#94a3b8',
        500: '#64748b',
        600: '#475569',
    },
    RED: {
        300: '#fca5a5',
    },
} as const;

// Tag input constants
export const TAG_INPUT = {
    DEFAULT_LABEL: 'Story Essences',
    DEFAULT_PLACEHOLDER: 'Infuse essence (e.g. Grimdark, Romance)...',
    DEFAULT_NAME: 'story_essences',
    CUSTOM_CATEGORY_ID: 'custom',
    CUSTOM_CATEGORY_NAME: 'Custom',
    DEBOUNCE_MS: 150,
    BLUR_DELAY_MS: 120,
    MIN_QUERY_LENGTH: 1,
} as const;

// API constants
export const API = {
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    TIMEOUT_MS: 10000,
    HEADERS: {
        ACCEPT: 'application/json',
        'CONTENT_TYPE': 'application/json',
    },
} as const;

// Validation constants
export const VALIDATION = {
    MIN_PASSWORD_LENGTH: 6,
    MAX_PASSWORD_LENGTH: 128,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 50,
    MIN_STORY_TITLE_LENGTH: 1,
    MAX_STORY_TITLE_LENGTH: 255,
    MIN_STORY_DESCRIPTION_LENGTH: 0,
    MAX_STORY_DESCRIPTION_LENGTH: 2000,
    MIN_WORLD_PROMPT_LENGTH: 1,
    MAX_WORLD_PROMPT_LENGTH: 5000,
} as const;

// File upload constants
export const FILE_UPLOAD = {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as const,
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'] as const,
} as const;

// Pagination constants
export const PAGINATION = {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1,
} as const;

// Rate limiting constants
export const RATE_LIMIT = {
    SIGNIN_ATTEMPTS: 5,
    SIGNIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    API_REQUESTS: 100,
    API_WINDOW_MS: 60 * 1000, // 1 minute
} as const;

// Cache constants
export const CACHE = {
    STORIES_TTL: 5 * 60 * 1000, // 5 minutes
    TAGS_TTL: 10 * 60 * 1000, // 10 minutes
    USER_TTL: 15 * 60 * 1000, // 15 minutes
} as const;

// Component constants
export const COMPONENT = {
    LOADING_DELAY_MS: 300, // Delay before showing loading indicator
    ERROR_RETRY_DELAY_MS: 2000,
} as const;

// Material icons (used throughout the app)
export const ICONS = {
    TAG: 'local_offer',
    CLOSE: 'close',
    ADD: 'add',
    LOADING: 'refresh',
    ERROR: 'error',
} as const;
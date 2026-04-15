/**
 * API-specific TypeScript types for consistent typing across endpoints
 */

import type { Tag, TagCategoryGroup, Story as BaseStory } from './types';

// Story response type with author and tags
export interface StoryResponse extends Omit<BaseStory, 'author_id'> {
    author_id: string;
    /** Short one-liner for archive card previews */
    tagline?: string;
    author: {
        id: string;
        username: string | null;
        avatar_url: string | null;
    } | null;
    tags: Tag[];
}

// Paginated story response
export interface PaginatedStoryResponse {
    stories: StoryResponse[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// Tag API response
export interface TagApiResponse {
    categories: TagCategoryGroup[];
}

// Create story request
export interface CreateStoryRequest {
    id?: string;
    story_id?: string;
    author_id: string;
    title: string;
    description?: string;
    cover_image_url?: string;
    tags?: Array<{
        id: string | null;
        name: string;
    }>;
}

// Update story request
export interface UpdateStoryRequest {
    title?: string;
    description?: string;
    cover_image_url?: string;
    is_public?: boolean;
}

// Auth responses
export interface AuthProfile {
    id: string;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string | null;
}

export interface AuthResponse {
    profile: AuthProfile;
}

export interface AuthErrorResponse {
    error: string;
}

// Upload image response
export interface UploadImageResponse {
    success: boolean;
    url?: string;
    error?: string;
}

// Generic API response wrapper
export interface ApiResponseWrapper<T = any> {
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
}

// Helper to extract Supabase story data type
export type SupabaseStoryData = {
    id: string;
    title: string;
    description: string | null;
    cover_image_url: string | null;
    created_at: string;
    world_prompt: string;
    rating: number | null;
    author_id: string;
    author: Array<{
        id: string;
        username: string | null;
        avatar_url: string | null;
    }> | null;
    story_tags: Array<{
        tags: {
            id: string;
            name: string;
        } | null;
    }> | null;
};

import type { SupabaseClient } from '@supabase/supabase-js';

export interface Style {
    descriptiveness: number;
    dialogueRatio: number;
    pacing: "slow" | "medium" | "fast";
    emotionalIntensity: number;
    autoStyle: boolean;
}

// Story model from schema.sql (updated with new fields)
export interface Story {
    id?: string;
    author_id: string;
    title: string;
    tagline?: string;         // Short one-liner displayed below the title
    description?: string;
    cover_image_url?: string;
    status?: 'draft' | 'public' | 'private' | 'deleted';
    rating?: number;
    created_at?: string;
    updated_at?: string;
    // New fields from schema update
    setting?: string; // Chronotope
    tone?: string[]; // Story tone array
    world_rules?: string; // Arcane Laws
    descriptiveness?: number; // 1-5
    dialogue_ratio?: number; // 1-5
    pacing?: 'slow' | 'medium' | 'fast';
    emotional_intensity?: number; // 1-5
    auto_style?: boolean;
    characters?: StoryCharacterJson[]; // Character Registry as JSONB
    lore?: string; // Lore Registry
}

// Character JSON structure for characters JSONB field
export interface StoryCharacterJson {
    name: string;
    description?: string;
    personality?: string;
    avatar_url?: string;
}

// Tag category model from schema.sql
export interface TagCategory {
    id: string;
    name: string;
    color: string | null;
}

// Tag model from schema.sql (UI-friendly shape)
export interface Tag {
    id: string | null;
    name: string;
}

// Grouped tags for UI
export interface TagCategoryGroup {
    id: string;
    name: string;
    color: string;
    tags: Tag[];
}

// Character model from schema.sql
export interface Character {
    id?: string;
    creator_id?: string;
    name: string;
    description?: string;
    personality?: string;
    avatar_url?: string;
    created_at?: string;
}

// Story Character (relationship) model
export interface StoryCharacter {
    id?: string;
    story_id: string;
    character_id: string;
    role?: string;
}

// Story Instance model (legacy — kept for backwards compat)
export interface StoryInstance {
    id?: string;
    story_id: string;
    user_id: string;
    created_at?: string;
    last_message_at?: string;
}

// ─── Chat / Session models (matches schema.sql) ──────────────────────────────

// A user's interactive play-through of a story
export interface StorySession {
    id?: string;
    story_id: string;
    user_id?: string;
    title?: string;           // optional display name for the session
    start_id?: string;        // which story_start was chosen
    created_at?: string;
    updated_at?: string;
}

// One of the pre-authored opening messages for a story
export interface StoryStart {
    id?: string;
    story_id: string;
    title: string;            // short label shown in the UI
    first_message: string;    // the AI's opening line for this scenario
    sort_order?: number;
    created_at?: string;
}

// AI-tracked scene context — updated after each exchange
export interface SceneState {
    session_id: string;
    summary?: string;
    current_location?: string;
    current_situation?: string;
    last_mode?: 'character' | 'narrator' | 'hybrid';
    last_intensity?: number;  // 1-5
    updated_at?: string;
}

// A single chat message in a session
export interface Message {
    id?: string;
    session_id: string;        // FK → story_sessions.id
    role: 'user' | 'assistant';
    content: string;
    created_at?: string;
}

// ─── AI Configuration models ──────────────────────────────────────────────────

/** Optional generation-parameter overrides stored per ai_config row (JSONB) */
export interface AiGenerationParams {
    max_tokens?: number;    // max reply length
    temperature?: number;   // 0–2, higher = more creative
    top_p?: number;         // nucleus-sampling probability
    top_k?: number;         // top-k sampling
}

// A user's saved AI backend config (stored in ai_configs table)
export interface AiConfig {
    id?: string;
    user_id: string;
    name: string;          // user-given label, shown in the dropdown
    provider: AiProvider;
    model: string;         // free-text — user types whatever the API accepts
    // api_key is NEVER returned from the server; the client only sees api_key_masked
    api_key_masked?: string;   // "••••••••" sent to client to confirm a key is saved
    base_url?: string;     // required for 'custom', optional override for others
    is_default: boolean;
    generation_params?: AiGenerationParams;   // per-config AI overrides
    created_at?: string;
    updated_at?: string;
}

// Supported AI provider identifiers
export type AiProvider = 'deepseek' | 'openrouter' | 'langdb' | 'custom';

// Comment model
export interface Comment {
    id?: string;
    story_id: string;
    user_id: string;
    parent_id?: string;
    content: string;
    created_at?: string;
}

// User model
export interface User {
    id?: string;
    username: string;
    follower_count?: number;
    following_count?: number;
    created_at?: string;
}

// User Followers (many-to-many relationship)
export interface UserFollower {
    follower_id: string;
    following_id: string;
    created_at?: string;
}

// Database schema type
export interface Database {
    public: {
        Tables: {
            stories: {
                Row: Story;
            };
            characters: {
                Row: Character;
            };
            story_characters: {
                Row: StoryCharacter;
            };
            story_instances: {
                Row: StoryInstance;
            };
            messages: {
                Row: Message;
            };
            comments: {
                Row: Comment;
            };
            users: {
                Row: User;
            };
            user_followers: {
                Row: UserFollower;
            };
        };
    };
}

// Type helper for Supabase client
export type AppSupabaseClient = SupabaseClient<Database>;

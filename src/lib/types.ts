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

// Story Instance model
export interface StoryInstance {
    id?: string;
    story_id: string;
    user_id: string;
    created_at?: string;
    last_message_at?: string;
}

// Message model
export interface Message {
    id?: string;
    story_instance_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at?: string;
}

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
        };
    };
}

// Type helper for Supabase client
export type AppSupabaseClient = SupabaseClient<Database>;

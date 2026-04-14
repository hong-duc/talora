import { configureStore, createSlice, type PayloadAction, type Middleware } from '@reduxjs/toolkit';
import type { Tag, StoryCharacterJson } from './types';

export type Profile = {
    id: string;
    username: string | null;
    avatar_url: string | null;
    bio: string | null;
    created_at: string | null;
};

type AuthState = {
    profile: Profile | null;
};

type StoryState = {
    storyId: string | null;
};

type Style = {
    descriptiveness: number;
    dialogueRatio: number;
    pacing: 'slow' | 'medium' | 'fast';
    emotionalIntensity: number;
    autoStyle: boolean;
}

// Story Form Data Interface
export interface StoryFormData {
    // Core fields
    title: string;
    tagline: string;          // short one-liner shown below the title
    description: string;
    coverImageUrl: string;
    authorId: string;
    isEditMode: boolean;

    // Component data
    tags: Tag[];
    characters: StoryCharacterJson[];
    tone: string[];
    firstMessages: Array<{ title: string, content: string, sort_order: number }>;

    // Style parameters
    style: Style

    // Additional fields
    setting: string;
    worldRules: string;
    lore: string;

    // Metadata
    dirty: boolean;
    lastSaved?: string;
}

type StoryFormState = {
    form: StoryFormData | null;
};

const initialState: AuthState = {
    profile: null,
};

const storyInitialState: StoryState = {
    storyId: null,
};

const storyFormInitialState: StoryFormState = {
    form: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setProfile: (state, action: PayloadAction<Profile | null>) => ({
            ...state,
            profile: action.payload,
        }),
        clearProfile: (state) => ({
            ...state,
            profile: null,
        }),
    },
});

const storySlice = createSlice({
    name: 'story',
    initialState: storyInitialState,
    reducers: {
        setStoryId: (state, action: PayloadAction<string | null>) => ({
            ...state,
            storyId: action.payload,
        }),
        clearStoryId: (state) => ({
            ...state,
            storyId: null,
        }),
    },
});

const storyFormSlice = createSlice({
    name: 'storyForm',
    initialState: storyFormInitialState,
    reducers: {
        initializeForm: (state, action: PayloadAction<Partial<StoryFormData>>) => ({
            form: {
                // Default values
                title: '',
                tagline: '',
                description: '',
                coverImageUrl: '',
                authorId: '',
                isEditMode: false,
                tags: [],
                characters: [],
                tone: [],
                firstMessages: [],
                style: {
                    descriptiveness: 3,
                    dialogueRatio: 3,
                    pacing: 'medium',
                    emotionalIntensity: 3,
                    autoStyle: true,
                },
                setting: '',
                worldRules: '',
                lore: '',
                dirty: false,
                // Override with provided values
                ...action.payload,
            }
        }),

        updateTitle: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.title = action.payload;
                state.form.dirty = true;
            }
        },

        updateTagline: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.tagline = action.payload;
                state.form.dirty = true;
            }
        },

        updateDescription: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.description = action.payload;
                state.form.dirty = true;
            }
        },

        updateCoverImageUrl: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.coverImageUrl = action.payload;
                state.form.dirty = true;
            }
        },

        updateAuthorId: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.authorId = action.payload;
                state.form.dirty = true;
            }
        },

        updateTags: (state, action: PayloadAction<Tag[]>) => {
            if (state.form) {
                state.form.tags = action.payload;
                state.form.dirty = true;
            }
        },

        updateCharacters: (state, action: PayloadAction<StoryCharacterJson[]>) => {
            if (state.form) {
                state.form.characters = action.payload;
                state.form.dirty = true;
            }
        },

        updateTone: (state, action: PayloadAction<string[]>) => {
            if (state.form) {
                state.form.tone = action.payload;
                state.form.dirty = true;
            }
        },

        updateFirstMessages: (state, action: PayloadAction<Array<{ title: string, content: string, sort_order: number }>>) => {
            if (state.form) {
                state.form.firstMessages = action.payload;
                state.form.dirty = true;
            }
        },

        updateStyle: (state, action: PayloadAction<Style>) => {
            if (state.form) {
                state.form.style = action.payload
                state.form.dirty = true
            }


        },

        updateSetting: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.setting = action.payload;
                state.form.dirty = true;
            }
        },

        updateWorldRules: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.worldRules = action.payload;
                state.form.dirty = true;
            }
        },

        updateLore: (state, action: PayloadAction<string>) => {
            if (state.form) {
                state.form.lore = action.payload;
                state.form.dirty = true;
            }
        },

        updateIsEditMode: (state, action: PayloadAction<boolean>) => {
            if (state.form) {
                state.form.isEditMode = action.payload;
                state.form.dirty = true;
            }
        },

        markAsClean: (state) => {
            if (state.form) {
                state.form.dirty = false;
            }
        },

        resetForm: (state) => {
            state.form = null;
        },
    },
});

export const { setProfile, clearProfile } = authSlice.actions;
export const { setStoryId, clearStoryId } = storySlice.actions;
export const {
    initializeForm,
    updateTitle,
    updateTagline,
    updateDescription,
    updateCoverImageUrl,
    updateAuthorId,
    updateTags,
    updateCharacters,
    updateTone,
    updateFirstMessages,
    updateStyle,
    updateSetting,
    updateWorldRules,
    updateLore,
    updateIsEditMode,
    markAsClean,
    resetForm,
} = storyFormSlice.actions;

// Selectors
export const selectFormData = (state: RootState) => state.storyForm.form;
export const selectFormDirty = (state: RootState) => state.storyForm.form?.dirty || false;

// localStorage middleware — persists storyForm changes to localStorage
const localStorageMiddleware: Middleware = (storeAPI) => (next) => (action) => {
    const result = next(action);

    // Only save for storyForm mutations (skip initializeForm to avoid a write-on-load cycle)
    const actionType = typeof action === 'object' && action !== null ? (action as { type: string }).type : '';
    if (actionType.startsWith('storyForm/') && actionType !== 'storyForm/initializeForm') {
        const formState = storeAPI.getState().storyForm.form;
        if (formState) {
            try {
                localStorage.setItem('storyFormDraft', JSON.stringify(formState));
            } catch (error) {
                console.warn('Failed to save form draft to localStorage:', error);
            }
        }
    }

    return result;
};

export const store = configureStore({
    reducer: {
        auth: authSlice.reducer,
        story: storySlice.reducer,
        storyForm: storyFormSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(localStorageMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;

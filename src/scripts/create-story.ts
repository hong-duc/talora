/**
 * Client script for the create/edit story form.
 * 
 * How it works:
 * - On DOMContentLoaded, reads data attributes from the form element.
 * - If data-edit-id is present → edit mode: initializes store with existing data.
 * - If not → create mode: initializes a blank form.
 * - On submit, branches to submitCreate() or submitUpdate() based on mode.
 * - Svelte components handle their own initial data via props (passed from Astro).
 * - This script handles: native inputs (title, setting, world_rules, lore),
 *   store subscriptions from Svelte custom events, and form submission.
 */

import {
    store,
    setStoryId,
    updateDescription,
    initializeForm,
    updateTitle,
    updateCharacters,
    updateStyle,
    type StoryFormData,
    updateFirstMessages,
    updateWorldRules,
    updateLore,
    updateTone,
    updateTags,
    updateAuthorId,
    updateSetting,
    updateIsEditMode,
} from '../lib/store';

// ============================================================================
// TYPES
// ============================================================================

/** File selected for cover image upload */
let fileUpload: File | undefined;

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================

interface FormElements {
    form: HTMLFormElement | null;
    titleInput: HTMLInputElement | null;
    descriptionInput: HTMLInputElement | null;
    coverImageUrlInput: HTMLElement | null;
    submitButton: HTMLButtonElement | null;
    tagInput: HTMLElement | null;
    settingInput: HTMLTextAreaElement | null;
    toneInput: HTMLElement | null;
    worldRulesInput: HTMLTextAreaElement | null;
    loreInput: HTMLTextAreaElement | null;
    charactersInput: HTMLElement | null;
    editorArea: HTMLElement | null;
    styleInput: HTMLElement | null;
    firstMessageInput: HTMLElement | null;
}

/** Collect all form element references once */
function getFormElements(): FormElements {
    return {
        form: document.getElementById("create-story-form") as HTMLFormElement | null,
        titleInput: document.getElementById("title") as HTMLInputElement | null,
        descriptionInput: document.getElementById("description-editor-data") as HTMLInputElement | null,
        coverImageUrlInput: document.getElementById("cover-image-url"),
        submitButton: document.getElementById("submit-button") as HTMLButtonElement | null,
        tagInput: document.getElementById("tag-input"),
        settingInput: document.getElementById("setting") as HTMLTextAreaElement | null,
        toneInput: document.getElementById("tone-selection"),
        worldRulesInput: document.getElementById("world-rules") as HTMLTextAreaElement | null,
        loreInput: document.getElementById("lore") as HTMLTextAreaElement | null,
        charactersInput: document.getElementById("characters-input"),
        editorArea: document.getElementById("Editor content area"),
        styleInput: document.getElementById("style input"),
        firstMessageInput: document.getElementById("first message input"),
    };
}

// ============================================================================
// EDIT MODE HELPERS
// ============================================================================

/**
 * Parse edit data from the form's data-edit-json attribute.
 * Returns null if not in edit mode or data is invalid.
 */
function parseEditData(form: HTMLFormElement): { editId: string; data: any } | null {
    const editId = form.dataset.editId;
    const editJson = form.dataset.editJson;

    if (!editId || !editJson) return null;

    try {
        return { editId, data: JSON.parse(editJson) };
    } catch {
        console.warn("Failed to parse edit data JSON");
        return null;
    }
}

/**
 * Initialize the Redux store with existing story data for edit mode.
 * Svelte components get their data via props; this seeds the store
 * so submit reads the correct initial values.
 */
function initializeEditMode(editId: string, data: any): void {
    store.dispatch(setStoryId(editId));
    store.dispatch(initializeForm({
        title: data.title || "",
        description: data.description || "",
        coverImageUrl: data.cover_image_url || "",
        authorId: data.author_id || "",
        isEditMode: true,
        tags: data.tags || [],
        characters: data.characters || [],
        tone: data.tone || [],
        firstMessages: data.story_starts || [],
        style: data.style || {
            descriptiveness: 3,
            dialogueRatio: 3,
            pacing: "medium",
            emotionalIntensity: 3,
            autoStyle: true,
        },
        setting: data.setting || "",
        worldRules: data.world_rules || "",
        lore: data.lore || "",
        dirty: false,
    }));
    store.dispatch(updateIsEditMode(true));
}

/**
 * Initialize a blank store for create mode.
 */
function initializeCreateMode(): void {
    store.dispatch(initializeForm({}));
    const storyId = crypto.randomUUID?.() ||
        `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    store.dispatch(setStoryId(storyId));
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

/**
 * Submit a NEW story via POST /api/create-story (FormData with cover image).
 * Cover image is only sent alongside the story data — the API creates the
 * story first, then uploads the image only if creation succeeded.
 */
async function submitCreate(data: StoryFormData): Promise<{ storyId: string }> {
    const authorId = store.getState().auth.profile?.id as string;
    store.dispatch(updateAuthorId(authorId));

    const payload = store.getState().storyForm.form as StoryFormData;

    const formdata = new FormData();
    formdata.append("storyData", JSON.stringify(payload));
    if (fileUpload) {
        formdata.append("coverimage", fileUpload);
    }

    const response = await fetch("/api/create-story", {
        method: "POST",
        body: formdata,
    });

    const result = await parseResponse(response);

    if (!response.ok) {
        throw new Error(result.error || "Failed to create story");
    }

    return { storyId: result.story?.id };
}

/**
 * Submit an UPDATE via PUT /api/stories/{id} (JSON body).
 * If a new cover image was selected, upload it separately after the update.
 */
async function submitUpdate(editId: string, data: StoryFormData): Promise<{ storyId: string }> {
    const authorId = store.getState().auth.profile?.id as string;
    store.dispatch(updateAuthorId(authorId));

    const payload = store.getState().storyForm.form as StoryFormData;

    // Build the update body — maps store field names to API field names
    const body = {
        title: payload.title,
        description: payload.description,
        cover_image_url: payload.coverImageUrl || undefined,
        author_id: authorId,
        tags: payload.tags,
        story_starts: payload.firstMessages,
        setting: payload.setting,
        tone: payload.tone,
        world_rules: payload.worldRules,
        descriptiveness: payload.style.descriptiveness,
        dialogue_ratio: payload.style.dialogueRatio,
        pacing: payload.style.pacing,
        emotional_intensity: payload.style.emotionalIntensity,
        auto_style: payload.style.autoStyle,
        characters: payload.characters,
        lore: payload.lore,
    };

    const response = await fetch(`/api/stories/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const result = await parseResponse(response);

    if (!response.ok) {
        throw new Error(result.error || "Failed to update story");
    }

    // If a new cover image was selected, upload it after successful update
    if (fileUpload) {
        const imgFormData = new FormData();
        imgFormData.append("file", fileUpload);
        imgFormData.append("storyId", editId);
        imgFormData.append("title", payload.title);

        try {
            await fetch("/api/upload-image", {
                method: "POST",
                body: imgFormData,
            });
        } catch (err) {
            console.warn("Cover image upload failed during edit:", err);
        }
    }

    return { storyId: editId };
}

/** Safely parse a fetch response as JSON */
async function parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return {};
    }
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

/**
 * Wire up all Svelte component custom events and native input listeners
 * to keep the Redux store in sync.
 */
function setupEventListeners(elements: FormElements): void {
    // Rich text editor emits "change" with HTML content
    elements.editorArea?.addEventListener("change", (e) => {
        store.dispatch(updateDescription((e as CustomEvent).detail));
    });

    // Title input
    elements.titleInput?.addEventListener("input", (e) => {
        store.dispatch(updateTitle((e.currentTarget as HTMLInputElement).value));
    });

    // Cover image file selection
    elements.coverImageUrlInput?.addEventListener("change", (e) => {
        if (e instanceof CustomEvent) {
            fileUpload = e.detail;
        }
    });

    // Characters component
    elements.charactersInput?.addEventListener("change", (e) => {
        if (e instanceof CustomEvent) {
            store.dispatch(updateCharacters(e.detail));
        }
    });

    // Style parameters component
    elements.styleInput?.addEventListener("change", (e) => {
        if (e instanceof CustomEvent) {
            store.dispatch(updateStyle(e.detail));
        }
    });

    // First messages component
    elements.firstMessageInput?.addEventListener("change", (e) => {
        if (e instanceof CustomEvent) {
            store.dispatch(updateFirstMessages(e.detail));
        }
    });

    // World rules textarea
    elements.worldRulesInput?.addEventListener("input", (e) => {
        store.dispatch(updateWorldRules((e.target as HTMLTextAreaElement).value));
    });

    // Tone selection component
    elements.toneInput?.addEventListener("change", (e) => {
        if (e instanceof CustomEvent) {
            store.dispatch(updateTone(e.detail));
        }
    });

    // Lore textarea
    elements.loreInput?.addEventListener("input", (e) => {
        store.dispatch(updateLore((e.target as HTMLTextAreaElement).value));
    });

    // Tags component
    elements.tagInput?.addEventListener("change", (e) => {
        if (e instanceof CustomEvent) {
            store.dispatch(updateTags(e.detail));
        }
    });

    // Setting textarea
    elements.settingInput?.addEventListener("input", (e) => {
        store.dispatch(updateSetting((e.target as HTMLTextAreaElement).value));
    });
}

// ============================================================================
// FORM SUBMISSION HANDLER
// ============================================================================

/**
 * Set up the form submit handler.
 * Branches between create and update based on edit mode.
 */
function setupFormSubmission(elements: FormElements, editId: string | null): void {
    if (!elements.form) return;

    elements.form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const data = store.getState().storyForm.form as StoryFormData;
        const isEdit = !!editId;
        const actionText = isEdit ? "Updating..." : "Scribing...";

        // Disable submit and show loading
        if (elements.submitButton) {
            elements.submitButton.disabled = true;
            elements.submitButton.innerHTML = `
                <span class="material-symbols-outlined text-accent-gold animate-spin">progress_activity</span>
                <span class="text-xl tracking-tight">${actionText}</span>
            `;
        }

        try {
            const result = isEdit
                ? await submitUpdate(editId!, data)
                : await submitCreate(data);

            // Redirect to review page after short delay
            setTimeout(() => {
                window.location.href = `/review/${result.storyId}`;
            }, 1500);
        } catch (error) {
            console.error("Submit error:", error);
            const message = error instanceof Error ? error.message : "Failed to save story.";
            // Could show a toast here — for now log it
            alert(message);
        } finally {
            // Re-enable submit button
            if (elements.submitButton) {
                elements.submitButton.disabled = false;
                const submitText = elements.form?.dataset.submitText || "Submit";
                elements.submitButton.innerHTML = `
                    <span class="material-symbols-outlined text-accent-gold">book_4</span>
                    <span class="text-xl tracking-tight">${submitText}</span>
                    <div class="absolute -inset-1 rounded-full border border-accent-gold/30 scale-105 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                `;
            }
        }
    });
}

// ============================================================================
// MAIN INITIALIZATION
// ============================================================================

function initializeCreateStoryForm(): void {
    const elements = getFormElements();
    if (!elements.form) return;

    // Detect edit mode from data attributes set by Astro
    const editInfo = parseEditData(elements.form);

    if (editInfo) {
        // Edit mode: seed store with existing story data
        initializeEditMode(editInfo.editId, editInfo.data);
    } else {
        // Create mode: blank form
        initializeCreateMode();
    }

    // Wire up all event listeners
    setupEventListeners(elements);

    // Set up form submission (pass editId if editing)
    setupFormSubmission(elements, editInfo?.editId || null);
}

// ============================================================================
// DOM CONTENT LOADED
// ============================================================================

document.addEventListener("DOMContentLoaded", initializeCreateStoryForm);

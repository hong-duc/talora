<script lang="ts">
    import { onMount } from "svelte";
    import EdraEditor from "./edra/headless/editor.svelte";
    import type { Content, Editor } from "@tiptap/core";
    import type { EdraEditorProps } from "./edra/types";
    import { uploadEditorImage } from "../editor-images";

    const {
        storyId,
        content = "",
        onUpdate = () => {},
        editable = true,
        autofocus = false,
        className = "",
    } = $props<{
        storyId: string;
        content?: Content;
        onUpdate?: () => void;
        editable?: boolean;
        autofocus?: boolean;
        className?: string;
        editor?: Editor;
    }>();

    // Editor reference
    let editor = $state<Editor>();

    // Upload state
    let uploadInProgress = $state(false);
    let uploadError = $state<string | null>(null);
    let lastUploadedUrl = $state<string | null>(null);

    // Handle image upload from drag-drop or paste
    async function handleImageUpload(file: File): Promise<string> {
        uploadInProgress = true;
        uploadError = null;

        try {
            const { url, error } = await uploadEditorImage(file, storyId);

            if (error) {
                throw new Error(error.message || "Failed to upload image");
            }

            if (!url) {
                throw new Error("No URL returned from upload");
            }

            lastUploadedUrl = url;
            return url;
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Unknown upload error";
            uploadError = errorMessage;
            console.error("Image upload error:", err);

            // Re-throw so EdraEditor knows upload failed
            throw new Error(`Image upload failed: ${errorMessage}`);
        } finally {
            uploadInProgress = false;
        }
    }

    // Handle file selection via file picker
    async function handleFileSelect(filePath: string): Promise<string> {
        // For file picker, we need to convert file path to File object
        // This is a simplified implementation - in real usage, you'd want to
        // use a proper file picker that returns File objects
        console.warn(
            "File picker upload not fully implemented. Use drag-drop or paste instead.",
        );

        // For now, we'll create a mock implementation
        // In a real app, you'd want to implement proper file selection
        return Promise.resolve(filePath);
    }

    // Clear upload error after showing it for a while
    function clearUploadError() {
        uploadError = null;
    }

    // Auto-clear error after 5 seconds
    $effect(() => {
        if (uploadError) {
            const timer = setTimeout(() => {
                clearUploadError();
            }, 5000);
            return () => clearTimeout(timer);
        }
    });
</script>

<div class="edra-editor-with-upload relative">
    <!-- Upload status indicators -->
    {#if uploadInProgress}
        <div
            class="absolute top-2 right-2 z-50 flex items-center gap-2 bg-slate-800/90 text-slate-300 px-3 py-1.5 rounded-lg text-sm shadow-lg border border-slate-700"
        >
            <svg
                class="animate-spin h-4 w-4 text-accent-gold"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
            >
                <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                ></circle>
                <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
            <span>Uploading image...</span>
        </div>
    {/if}

    {#if uploadError}
        <div
            class="absolute top-2 right-2 z-50 flex items-center gap-2 bg-red-900/90 text-red-100 px-3 py-1.5 rounded-lg text-sm shadow-lg border border-red-700 max-w-xs"
        >
            <svg
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                />
            </svg>
            <span class="flex-1">{uploadError}</span>
            <button
                on:click={clearUploadError}
                class="text-red-300 hover:text-white ml-2"
                type="button"
            >
                <svg
                    class="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                    />
                </svg>
            </button>
        </div>
    {/if}

    {#if lastUploadedUrl && !uploadInProgress}
        <div
            class="absolute top-2 right-2 z-50 flex items-center gap-2 bg-green-900/90 text-green-100 px-3 py-1.5 rounded-lg text-sm shadow-lg border border-green-700"
        >
            <svg
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                />
            </svg>
            <span>Image uploaded successfully!</span>
        </div>
    {/if}

    <!-- Main editor component -->
    <EdraEditor
        bind:editor
        {content}
        {onUpdate}
        {editable}
        {autofocus}
        class={className}
        onDropOrPaste={handleImageUpload}
        onFileSelect={handleFileSelect}
    />

    <!-- Instructions for users -->
    <div class="text-xs text-slate-500 mt-2 italic">
        Tip: Drag & drop images or paste from clipboard to upload directly to
        Supabase. Images will be stored at: <code class="text-slate-400"
            >images/editor-images/{storyId}/</code
        >
    </div>
</div>

<style>
    .edra-editor-with-upload {
        position: relative;
    }

    /* Ensure status indicators appear above editor content */
    .edra-editor-with-upload > div:first-child {
        pointer-events: none;
    }

    .edra-editor-with-upload > div:first-child button {
        pointer-events: auto;
    }
</style>

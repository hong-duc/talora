<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import type { Content, Editor } from "@tiptap/core";
    import { EdraEditor, EdraToolBar } from "../lib/components/edra/headless";
    import { uploadEditorImage } from "../lib/editor-images";
    import type { EdraToolBarCommands } from "../lib/components/edra/commands/types";
    import { Image } from "@lucide/svelte";
    import { openFilePicker } from "../utils";
    import { store } from "../lib/store";

    // Props
    const {
        value = "",
        storyId = "",
        onUpdate: propOnUpdate = () => {},
        showToolbar = true,
    } = $props<{
        value?: Content;
        onUpdate?: (content: string) => void;
        showToolbar?: boolean;
    }>();

    
 let rootelement: HTMLElement | undefined = $state()
    // editor states
    let content = $state<Content>("");
    let editor = $state<Editor>();
    const dispatch = createEventDispatcher<{ change: string }>();

    // Upload state
    let uploadInProgress = $state(false);
    let uploadError = $state<string | null>(null);
    let lastUploadedUrl = $state<string | null>(null);

    // Redux store subscription for storyId
    let reduxStoryId = $state<string | null>(null);

    onMount(() => {
        // Initial get from store
        reduxStoryId = store.getState().story.storyId;

        // Subscribe to store changes
        const unsubscribe = store.subscribe(() => {
            const newStoryId = store.getState().story.storyId;
            if (newStoryId !== reduxStoryId) {
                reduxStoryId = newStoryId;
                console.log(
                    "RichTextEditor received storyId from Redux store:",
                    newStoryId,
                );
            }
        });

        // Clean up on destroy
        return () => {
            unsubscribe();
        };
    });

    // Handle image upload from drag-drop or paste
    async function handleImageUpload(
        file: File,
        storyId: string,
    ): Promise<string> {
        console.log("run here: handleImageUpload ");
        // Use reduxStoryId if no storyId parameter provided
        const targetStoryId = storyId || reduxStoryId;
        if (!targetStoryId) {
            throw new Error(
                "Story ID is required for image upload. Please wait for story ID to be generated in Redux store.",
            );
        }

        uploadInProgress = true;
        uploadError = null;

        try {
            const { url, error } = await uploadEditorImage(file, targetStoryId);

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


    // Clear upload error
    function clearUploadError() {
        uploadError = null;
    }


    // Update content when editor changes
    function onEditorUpdate() {
        const html = editor?.getHTML() as string;
        content = html;

        if (rootelement){
            rootelement.dispatchEvent(new CustomEvent("change",{
            bubbles: true,
            composed: true,
            detail: html
        }))
        }

        
        
        
    }

    // Watch for value prop changes
    $effect(() => {
        if (value !== content) {
            content = value;
        }
    });

    const customCommands: EdraToolBarCommands[] = [
        {
            name: "upload-image",
            icon: Image,
            tooltip: "upload-image",
            onClick: async (editor: Editor) => {
                try {
                    // Open file picker for images
                    const files = await openFilePicker("image/*", false);
                    const file = files[0];

                    // Use reduxStoryId for upload
                    if (!reduxStoryId) {
                        console.log("reduxStoryId", reduxStoryId);
                        throw new Error(
                            "Story ID is required for image upload. Please wait for story ID to be generated in Redux store.",
                        );
                    }

                    const url = await handleImageUpload(file, reduxStoryId);

                    // Insert image node with the URL
                    editor
                        .chain()
                        .focus()
                        .insertContent({
                            type: "image",
                            attrs: { src: url },
                        })
                        .run();
                } catch (error) {
                    // Silently fail - user cancelled file selection
                    if (
                        !(
                            error instanceof Error &&
                            error.message.includes("cancelled")
                        )
                    ) {
                        console.error("Image upload failed:", error);
                    }
                }
            },
        },
    ];
</script>

<div class="flex flex-col relative" bind:this={rootelement} >
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
            <!-- svelte-ignore a11y_consider_explicit_label -->
            <button
                onclick={clearUploadError}
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

    <!-- Toolbar -->
    {#if showToolbar && editor && !editor.isDestroyed}
        <EdraToolBar class="sticky top-0" {editor} {customCommands} />
    {/if}

    <!-- Main editor -->
    <div class="min-h-0 overflow-y-auto">
        <EdraEditor bind:editor {content} class="" onUpdate={onEditorUpdate} />
    </div>
</div>

<style>
    /* Ensure status indicators appear above editor content */
    .absolute {
        pointer-events: none;
    }

    .absolute button {
        pointer-events: auto;
    }
</style>

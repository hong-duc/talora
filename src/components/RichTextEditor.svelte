<script lang="ts">
    /**
     * RichTextEditor — pure TipTap editor with custom Arcane Ink toolbar.
     *
     * Replaces the previous Edra-based editor.
     *
     * Features:
     *  - Bold, Italic, Strikethrough, Inline Code
     *  - Heading 1 / 2 / 3
     *  - Bullet list, Ordered list, Blockquote
     *  - Align left / center / right
     *  - Custom image insert (file picker → upload to Supabase Storage)
     *
     * Emits a "change" CustomEvent on the root element with the HTML string
     * as the detail, so the parent page can capture it via addEventListener.
     */

    import { onMount, onDestroy } from "svelte";
    import { Editor } from "@tiptap/core";
    import StarterKit from "@tiptap/starter-kit";
    import TiptapImage from "@tiptap/extension-image";
    import TextAlign from "@tiptap/extension-text-align";
    import { uploadEditorImage } from "../lib/editor-images";
    import { openFilePicker } from "../utils";
    import { store } from "../lib/store";

    // ─── Props ────────────────────────────────────────────────────────────────
    const {
        value = "",
        showToolbar = true,
        enableImageUpload = true,
    } = $props<{
        value?: string;
        showToolbar?: boolean;
        enableImageUpload?: boolean;
    }>();

    // ─── DOM refs ─────────────────────────────────────────────────────────────
    let rootElement = $state<HTMLElement>();
    let editorElement = $state<HTMLElement>();

    // ─── TipTap editor instance ───────────────────────────────────────────────
    let editor = $state<Editor>();

    // ─── Toolbar active-state snapshot (re-computed on every transaction) ────
    let fmt = $state({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        h1: false,
        h2: false,
        h3: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        alignLeft: false,
        alignCenter: false,
        alignRight: false,
    });

    // ─── Upload state ─────────────────────────────────────────────────────────
    let uploadInProgress = $state(false);
    let uploadError = $state<string | null>(null);
    let uploadDone = $state(false);

    // ─── Redux storyId (used for image upload path) ───────────────────────────
    let storyId = $state<string | null>(null);

    // ─── Sync prop → editor when value changes externally ────────────────────
    $effect(() => {
        if (editor && !editor.isDestroyed) {
            const current = editor.getHTML();
            if (value !== current) {
                editor.commands.setContent(value || "");
            }
        }
    });

    // ─── Mount ───────────────────────────────────────────────────────────────
    onMount(() => {
        // Subscribe to Redux store to get the storyId for uploads
        storyId = store.getState().story.storyId;
        const unsubscribe = store.subscribe(() => {
            storyId = store.getState().story.storyId;
        });

        // Initialise TipTap
        editor = new Editor({
            element: editorElement,
            extensions: [
                StarterKit.configure({
                    // Keep headings 1-3; disable built-in code block (use inline code only)
                    heading: { levels: [1, 2, 3] },
                    codeBlock: false,
                }),
                TiptapImage.configure({
                    inline: false,
                    allowBase64: false,
                    HTMLAttributes: { class: "arcane-editor-img" },
                }),
                TextAlign.configure({ types: ["heading", "paragraph"] }),
            ],
            content: value || "",
            editorProps: {
                attributes: {
                    class: "arcane-prose focus:outline-none",
                    spellcheck: "true",
                },
            },
            // Refresh toolbar state on every transaction
            onTransaction: () => {
                if (!editor || editor.isDestroyed) return;
                fmt = {
                    bold: editor.isActive("bold"),
                    italic: editor.isActive("italic"),
                    strike: editor.isActive("strike"),
                    code: editor.isActive("code"),
                    h1: editor.isActive("heading", { level: 1 }),
                    h2: editor.isActive("heading", { level: 2 }),
                    h3: editor.isActive("heading", { level: 3 }),
                    bulletList: editor.isActive("bulletList"),
                    orderedList: editor.isActive("orderedList"),
                    blockquote: editor.isActive("blockquote"),
                    alignLeft: editor.isActive({ textAlign: "left" }),
                    alignCenter: editor.isActive({ textAlign: "center" }),
                    alignRight: editor.isActive({ textAlign: "right" }),
                };
            },
            // Emit HTML content up to the parent via a custom DOM event
            onUpdate: ({ editor: e }) => {
                if (rootElement) {
                    rootElement.dispatchEvent(
                        new CustomEvent("change", {
                            bubbles: true,
                            composed: true,
                            detail: e.getHTML(),
                        }),
                    );
                }
            },
        });

        return () => {
            unsubscribe();
        };
    });

    onDestroy(() => {
        editor?.destroy();
    });

    // ─── Image upload handler ─────────────────────────────────────────────────
    async function insertImage() {
        const targetStoryId = storyId;
        if (!targetStoryId) {
            uploadError =
                "Save the story first so images have a destination folder.";
            setTimeout(() => {
                uploadError = null;
            }, 4000);
            return;
        }

        try {
            const files = await openFilePicker("image/*", false);
            const file = files[0];
            if (!file) return;

            uploadInProgress = true;
            uploadError = null;
            uploadDone = false;

            const { url, error } = await uploadEditorImage(file, targetStoryId);
            if (error) throw new Error(error.message);
            if (!url) throw new Error("No URL returned from upload");

            editor
                ?.chain()
                .focus()
                .insertContent({
                    type: "image",
                    attrs: { src: url, alt: file.name },
                })
                .run();

            uploadDone = true;
            setTimeout(() => {
                uploadDone = false;
            }, 3000);
        } catch (err) {
            // Ignore user-cancelled file picker
            if (err instanceof Error && err.message.includes("cancelled"))
                return;
            uploadError =
                err instanceof Error ? err.message : "Image upload failed";
            setTimeout(() => {
                uploadError = null;
            }, 5000);
        } finally {
            uploadInProgress = false;
        }
    }
</script>

<!-- Root element — the parent listens for "change" events here -->
<div class="flex flex-col relative" bind:this={rootElement}>
    <!-- ── Upload status overlays ─────────────────────────────────────────── -->
    {#if uploadInProgress}
        <div
            class="absolute top-2 right-2 z-50 flex items-center gap-2 bg-slate-800/90 text-slate-300 px-3 py-1.5 rounded-lg text-sm shadow-lg border border-slate-700"
        >
            <span
                class="material-symbols-outlined text-primary animate-spin text-base"
                >progress_activity</span
            >
            <span>Uploading image…</span>
        </div>
    {/if}

    {#if uploadError}
        <div
            class="absolute top-2 right-2 z-50 flex items-center gap-2 bg-red-900/90 text-red-100 px-3 py-1.5 rounded-lg text-sm shadow-lg border border-red-700 max-w-xs"
        >
            <span class="material-symbols-outlined text-base">error</span>
            <span class="flex-1">{uploadError}</span>
            <button
                type="button"
                class="text-red-300 hover:text-white ml-2"
                onclick={() => {
                    uploadError = null;
                }}
            >
                <span class="material-symbols-outlined text-base">close</span>
            </button>
        </div>
    {/if}

    {#if uploadDone}
        <div
            class="absolute top-2 right-2 z-50 flex items-center gap-2 bg-green-900/90 text-green-100 px-3 py-1.5 rounded-lg text-sm shadow-lg border border-green-700"
        >
            <span class="material-symbols-outlined text-base">check_circle</span
            >
            <span>Image inserted!</span>
        </div>
    {/if}

    <!-- ── Custom Toolbar ─────────────────────────────────────────────────── -->
    {#if showToolbar && editor && !editor.isDestroyed}
        <div
            class="arcane-toolbar sticky top-0 z-10 flex flex-wrap items-center gap-0.5 p-1.5"
            role="toolbar"
            aria-label="Text formatting"
        >
            <!-- Format group: Bold / Italic / Strike / Code -->
            <div class="toolbar-group">
                <button
                    type="button"
                    class="tb-btn {fmt.bold ? 'tb-active' : ''}"
                    onclick={() => editor?.chain().focus().toggleBold().run()}
                    title="Bold (Ctrl+B)"
                    aria-pressed={fmt.bold}
                >
                    <span class="material-symbols-outlined">format_bold</span>
                </button>
                <button
                    type="button"
                    class="tb-btn {fmt.italic ? 'tb-active' : ''}"
                    onclick={() => editor?.chain().focus().toggleItalic().run()}
                    title="Italic (Ctrl+I)"
                    aria-pressed={fmt.italic}
                >
                    <span class="material-symbols-outlined">format_italic</span>
                </button>
                <button
                    type="button"
                    class="tb-btn {fmt.strike ? 'tb-active' : ''}"
                    onclick={() => editor?.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                    aria-pressed={fmt.strike}
                >
                    <span class="material-symbols-outlined"
                        >strikethrough_s</span
                    >
                </button>
                <button
                    type="button"
                    class="tb-btn {fmt.code ? 'tb-active' : ''}"
                    onclick={() => editor?.chain().focus().toggleCode().run()}
                    title="Inline code"
                    aria-pressed={fmt.code}
                >
                    <span class="material-symbols-outlined">code</span>
                </button>
            </div>

            <!-- Heading group: H1 / H2 / H3 -->
            <div class="toolbar-group">
                <button
                    type="button"
                    class="tb-btn tb-label {fmt.h1 ? 'tb-active' : ''}"
                    onclick={() =>
                        editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 1 })
                            .run()}
                    title="Heading 1"
                    aria-pressed={fmt.h1}
                >
                    H1
                </button>
                <button
                    type="button"
                    class="tb-btn tb-label {fmt.h2 ? 'tb-active' : ''}"
                    onclick={() =>
                        editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run()}
                    title="Heading 2"
                    aria-pressed={fmt.h2}
                >
                    H2
                </button>
                <button
                    type="button"
                    class="tb-btn tb-label {fmt.h3 ? 'tb-active' : ''}"
                    onclick={() =>
                        editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 3 })
                            .run()}
                    title="Heading 3"
                    aria-pressed={fmt.h3}
                >
                    H3
                </button>
            </div>

            <!-- List & Quote group -->
            <div class="toolbar-group">
                <button
                    type="button"
                    class="tb-btn {fmt.bulletList ? 'tb-active' : ''}"
                    onclick={() =>
                        editor?.chain().focus().toggleBulletList().run()}
                    title="Bullet list"
                    aria-pressed={fmt.bulletList}
                >
                    <span class="material-symbols-outlined"
                        >format_list_bulleted</span
                    >
                </button>
                <button
                    type="button"
                    class="tb-btn {fmt.orderedList ? 'tb-active' : ''}"
                    onclick={() =>
                        editor?.chain().focus().toggleOrderedList().run()}
                    title="Ordered list"
                    aria-pressed={fmt.orderedList}
                >
                    <span class="material-symbols-outlined"
                        >format_list_numbered</span
                    >
                </button>
                <button
                    type="button"
                    class="tb-btn {fmt.blockquote ? 'tb-active' : ''}"
                    onclick={() =>
                        editor?.chain().focus().toggleBlockquote().run()}
                    title="Blockquote"
                    aria-pressed={fmt.blockquote}
                >
                    <span class="material-symbols-outlined">format_quote</span>
                </button>
            </div>

            <!-- Alignment group -->
            <div class="toolbar-group">
                <button
                    type="button"
                    class="tb-btn {fmt.alignLeft ? 'tb-active' : ''}"
                    onclick={() =>
                        editor?.chain().focus().setTextAlign("left").run()}
                    title="Align left"
                    aria-pressed={fmt.alignLeft}
                >
                    <span class="material-symbols-outlined"
                        >format_align_left</span
                    >
                </button>
                <button
                    type="button"
                    class="tb-btn {fmt.alignCenter ? 'tb-active' : ''}"
                    onclick={() =>
                        editor?.chain().focus().setTextAlign("center").run()}
                    title="Align centre"
                    aria-pressed={fmt.alignCenter}
                >
                    <span class="material-symbols-outlined"
                        >format_align_center</span
                    >
                </button>
                <button
                    type="button"
                    class="tb-btn {fmt.alignRight ? 'tb-active' : ''}"
                    onclick={() =>
                        editor?.chain().focus().setTextAlign("right").run()}
                    title="Align right"
                    aria-pressed={fmt.alignRight}
                >
                    <span class="material-symbols-outlined"
                        >format_align_right</span
                    >
                </button>
            </div>

            <!-- Image insert -->
            {#if enableImageUpload}
                <div class="toolbar-group border-r-0">
                    <button
                        type="button"
                        class="tb-btn"
                        onclick={insertImage}
                        title="Insert image"
                        disabled={uploadInProgress}
                    >
                        <span class="material-symbols-outlined"
                            >add_photo_alternate</span
                        >
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <!-- ── Editor content area (TipTap mounts here) ───────────────────────── -->
    <div
        bind:this={editorElement}
        class="arcane-editor-root min-h-[180px]"
    ></div>
</div>

<style>
    /* ── Toolbar container ──────────────────────────────────────────────────── */
    .arcane-toolbar {
        background-color: rgb(38 27 49 / 0.85);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid rgb(149 143 152 / 0.2);
        border-radius: 0.125rem 0.125rem 0 0;
    }

    .toolbar-group {
        display: flex;
        align-items: center;
        gap: 0.125rem;
        padding-right: 0.5rem;
        margin-right: 0.25rem;
        border-right: 1px solid rgb(149 143 152 / 0.2);
    }

    .toolbar-group:last-child {
        border-right: none;
        padding-right: 0;
        margin-right: 0;
    }

    /* ── Toolbar buttons ──────────────────────────────────────────────────── */
    .tb-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border-radius: 0.25rem;
        border: 1px solid rgb(233 195 73 / 0);
        background: transparent;
        color: rgb(203 196 206 / 0.75);
        cursor: pointer;
        transition:
            color 0.15s,
            background-color 0.15s,
            border-color 0.15s;
    }

    .tb-btn:hover {
        color: #e9c349;
        background-color: rgb(49 37 60 / 0.8);
        border-color: rgb(233 195 73 / 0.3);
    }

    .tb-btn:active {
        transform: scale(0.9);
    }

    .tb-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    /* active = format is currently applied */
    .tb-active {
        color: #e9c349;
        background-color: rgb(49 37 60 / 0.8);
        border-color: rgb(233 195 73 / 0.5);
    }

    /* Icon size */
    .tb-btn :global(.material-symbols-outlined) {
        font-size: 1.1rem;
        line-height: 1;
        font-variation-settings:
            "FILL" 0,
            "wght" 400,
            "GRAD" 0,
            "opsz" 20;
    }

    .tb-active :global(.material-symbols-outlined) {
        font-variation-settings:
            "FILL" 1,
            "wght" 500,
            "GRAD" 0,
            "opsz" 20;
    }

    /* Heading labels use a smaller bold font */
    .tb-label {
        font-size: 0.7rem;
        font-weight: 700;
        font-family: "Inter", sans-serif;
        letter-spacing: 0.03em;
    }

    /* ── ProseMirror content styles ─────────────────────────────────────────── */
    :global(.arcane-editor-root .ProseMirror) {
        min-height: 180px;
        padding: 1rem 0.5rem;
        color: #cbc4ce;
        font-family: "Newsreader", serif;
        font-size: 1.1rem;
        line-height: 1.75;
        outline: none;
    }

    :global(.arcane-editor-root .ProseMirror p) {
        margin-bottom: 0.9em;
    }

    :global(.arcane-editor-root .ProseMirror h1) {
        font-size: 1.75rem;
        font-weight: 700;
        color: #efdcfb;
        margin: 0.8em 0 0.4em;
        letter-spacing: -0.02em;
    }

    :global(.arcane-editor-root .ProseMirror h2) {
        font-size: 1.35rem;
        font-weight: 700;
        color: #efdcfb;
        margin: 0.7em 0 0.35em;
    }

    :global(.arcane-editor-root .ProseMirror h3) {
        font-size: 1.15rem;
        font-weight: 600;
        color: #efdcfb;
        margin: 0.6em 0 0.3em;
    }

    :global(.arcane-editor-root .ProseMirror strong) {
        font-weight: 700;
        color: #efdcfb;
    }

    :global(.arcane-editor-root .ProseMirror em) {
        font-style: italic;
        color: #d6baff;
    }

    :global(.arcane-editor-root .ProseMirror s) {
        text-decoration: line-through;
        opacity: 0.65;
    }

    :global(.arcane-editor-root .ProseMirror code) {
        background: rgb(60 48 72 / 0.8);
        border: 1px solid rgb(149 143 152 / 0.3);
        border-radius: 0.2rem;
        padding: 0.1em 0.38em;
        font-family: "Courier New", monospace;
        font-size: 0.88em;
        color: #e9c349;
    }

    :global(.arcane-editor-root .ProseMirror blockquote) {
        border-left: 3px solid #e9c349;
        margin: 1em 0;
        padding-left: 1em;
        color: #958f98;
        font-style: italic;
    }

    :global(.arcane-editor-root .ProseMirror ul) {
        list-style-type: disc;
        padding-left: 1.5em;
        margin-bottom: 0.9em;
    }

    :global(.arcane-editor-root .ProseMirror ol) {
        list-style-type: decimal;
        padding-left: 1.5em;
        margin-bottom: 0.9em;
    }

    :global(.arcane-editor-root .ProseMirror li) {
        margin-bottom: 0.2em;
    }

    :global(.arcane-editor-root .ProseMirror img.arcane-editor-img) {
        display: block;
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
        margin: 1em 0;
        border: 1px solid rgb(233 195 73 / 0.2);
    }

    /* Placeholder text for empty editor */
    :global(
            .arcane-editor-root
                .ProseMirror
                p.is-editor-empty:first-child::before
        ) {
        content: attr(data-placeholder);
        float: left;
        color: rgb(203 196 206 / 0.35);
        pointer-events: none;
        height: 0;
    }
</style>

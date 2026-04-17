<script lang="ts">
    /**
     * UserBioEditor — Personal Legend (bio) block for the user profile page.
     *
     * - In view mode: renders bio HTML content inside a styled quote container.
     * - In edit mode (owner only): shows the RichTextEditor so the owner can
     *   update their bio with rich formatting.
     *
     * Auth: uses the Supabase JS client (via supabaseUrl + supabaseAnonKey) to
     * retrieve the JWT access token, then sends it as `Authorization: Bearer`
     * when calling PATCH /api/user/update-profile.  The anon key is only used
     * to initialise the client so it can read the session cookie — it is never
     * sent to the profile update endpoint.
     */

    import { onMount } from "svelte";
    import { createClient } from "@supabase/supabase-js";
    import RichTextEditor from "./RichTextEditor.svelte";

    // ─── Props ────────────────────────────────────────────────────────────────
    const {
        initialBio = "",
        profileUserId = "",
        supabaseUrl = "",
        supabaseAnonKey = "",
    } = $props<{
        initialBio?: string;
        profileUserId?: string;
        supabaseUrl?: string;
        supabaseAnonKey?: string;
    }>();

    // ─── State ────────────────────────────────────────────────────────────────
    let isOwner = $state(false);
    let isEditing = $state(false);
    let isSaving = $state(false);
    let saveError = $state<string | null>(null);

    /** Current bio HTML — starts from server-rendered value, updated after save */
    let currentBio = $state(initialBio);
    /** Draft tracked from the RichTextEditor while in edit mode */
    let draftBio = $state(initialBio);

    /** JWT access token — populated once session is confirmed */
    let accessToken = $state<string | null>(null);

    // ─── Mount: check session and determine ownership ─────────────────────────
    onMount(async () => {
        if (!profileUserId || !supabaseUrl || !supabaseAnonKey) return;

        try {
            const sb = createClient(supabaseUrl, supabaseAnonKey);
            const {
                data: { session },
            } = await sb.auth.getSession();

            if (session && session.user.id === profileUserId) {
                isOwner = true;
                accessToken = session.access_token;
            }
        } catch {
            // Session unavailable — stay in view-only mode
        }
    });

    // ─── Handlers ─────────────────────────────────────────────────────────────
    function startEdit() {
        draftBio = currentBio;
        saveError = null;
        isEditing = true;
    }

    function cancelEdit() {
        isEditing = false;
        saveError = null;
    }

    function onEditorChange(e: Event) {
        draftBio = (e as CustomEvent<string>).detail;
    }

    async function saveBio() {
        if (!accessToken) return;
        isSaving = true;
        saveError = null;

        try {
            const res = await fetch("/api/user/update-profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ bio: draftBio }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.error || "Save failed");
            }

            const updatedBio = json.profile?.bio?.trim() ?? "";
            currentBio = updatedBio;

            // Sync to localStorage profile cache if present
            try {
                const stored = localStorage.getItem("talora.profile");
                if (stored) {
                    const p = JSON.parse(stored);
                    p.bio = updatedBio;
                    localStorage.setItem("talora.profile", JSON.stringify(p));
                }
            } catch {
                // ignore
            }

            isEditing = false;
        } catch (err) {
            saveError =
                err instanceof Error ? err.message : "Could not save bio.";
        } finally {
            isSaving = false;
        }
    }
</script>

<!-- ── Personal Legend section ──────────────────────────────────────────────── -->
<section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">ink_pen</span>
            <h3 class="text-2xl font-bold tracking-tight">Personal Legend</h3>
        </div>

        <!-- Edit button — visible only to the profile owner, only in view mode -->
        {#if isOwner && !isEditing}
            <button
                type="button"
                class="flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-xs text-primary transition hover:border-primary/60 hover:bg-primary/10"
                aria-label="Edit bio"
                onclick={startEdit}
            >
                <span class="material-symbols-outlined text-xs">edit</span>
                Edit
            </button>
        {/if}
    </div>

    <!-- ── View mode ─────────────────────────────────────────────────────── -->
    {#if !isEditing}
        <div
            class="relative rounded-xl border border-primary/10 bg-primary/5 p-8 text-lg italic leading-relaxed"
        >
            <span
                class="absolute left-4 top-4 font-serif text-6xl text-primary/10"
                >"</span
            >

            {#if currentBio}
                <!-- Render rich HTML bio content -->
                <div class="bio-html-content prose-invert">
                    {@html currentBio}
                </div>
            {:else}
                <p class="text-slate-400">No legend written yet…</p>
            {/if}

            <span
                class="absolute bottom-4 right-4 font-serif text-6xl text-primary/10"
                >"</span
            >
        </div>
    {/if}

    <!-- ── Edit mode ─────────────────────────────────────────────────────── -->
    {#if isEditing}
        <div class="space-y-3">
            <!-- RichTextEditor — image upload disabled for bio context -->
            <div
                class="rounded-xl border border-primary/30 bg-primary/5 overflow-hidden"
                onchange={onEditorChange}
            >
                <RichTextEditor value={currentBio} enableImageUpload={false} />
            </div>

            <!-- Action buttons -->
            <div class="flex gap-2">
                <button
                    type="button"
                    class="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white transition hover:bg-primary/80 disabled:opacity-50"
                    disabled={isSaving}
                    onclick={saveBio}
                >
                    {isSaving ? "Saving…" : "Save"}
                </button>
                <button
                    type="button"
                    class="rounded-full border border-slate-700 px-5 py-2 text-sm transition hover:border-slate-500"
                    disabled={isSaving}
                    onclick={cancelEdit}
                >
                    Cancel
                </button>
            </div>

            <!-- Inline error -->
            {#if saveError}
                <p class="text-sm text-red-400">{saveError}</p>
            {/if}
        </div>
    {/if}
</section>

<style>
    /* ── Rich HTML bio content styles ─────────────────────────────────────── */
    .bio-html-content :global(p) {
        margin-bottom: 0.75em;
    }
    .bio-html-content :global(p:last-child) {
        margin-bottom: 0;
    }
    .bio-html-content :global(h1),
    .bio-html-content :global(h2),
    .bio-html-content :global(h3) {
        font-weight: 700;
        color: #efdcfb;
        margin: 0.6em 0 0.3em;
        font-style: normal;
    }
    .bio-html-content :global(h1) {
        font-size: 1.5rem;
    }
    .bio-html-content :global(h2) {
        font-size: 1.2rem;
    }
    .bio-html-content :global(h3) {
        font-size: 1rem;
    }
    .bio-html-content :global(strong) {
        font-weight: 700;
        color: #efdcfb;
    }
    .bio-html-content :global(em) {
        font-style: italic;
        color: #d6baff;
    }
    .bio-html-content :global(s) {
        text-decoration: line-through;
        opacity: 0.65;
    }
    .bio-html-content :global(code) {
        background: rgb(60 48 72 / 0.8);
        border: 1px solid rgb(149 143 152 / 0.3);
        border-radius: 0.2rem;
        padding: 0.1em 0.38em;
        font-family: "Courier New", monospace;
        font-size: 0.88em;
        color: #e9c349;
        font-style: normal;
    }
    .bio-html-content :global(blockquote) {
        border-left: 3px solid #e9c349;
        margin: 0.8em 0;
        padding-left: 1em;
        color: #958f98;
    }
    .bio-html-content :global(ul) {
        list-style-type: disc;
        padding-left: 1.5em;
        margin-bottom: 0.75em;
        font-style: normal;
    }
    .bio-html-content :global(ol) {
        list-style-type: decimal;
        padding-left: 1.5em;
        margin-bottom: 0.75em;
        font-style: normal;
    }
    .bio-html-content :global(li) {
        margin-bottom: 0.2em;
    }
</style>

<script lang="ts">
    /**
     * ReadNowButton — "Read Now" button with Starting Point picker modal.
     *
     * How it works:
     *  1. User clicks "Read Now"
     *  2. If the story has starting points → show the picker modal
     *     If not → create a session immediately (no starting point)
     *  3. User picks a starting point (or skips)
     *  4. POST /api/sessions { story_id, start_id? }
     *     → creates a story_sessions row + inserts the first_message (persisted)
     *  5. Redirect to /chat?session=<id>
     *
     * Why a self-contained component:
     *  Auth (Supabase token) lives in the browser, so this must be client:load.
     *  Keeping the button + modal together avoids cross-component event wiring.
     */

    import { supabase } from "../lib/supabase";

    // ─── Props ────────────────────────────────────────────────────────────────

    interface StoryStart {
        id?: string;
        title: string;
        content: string; // first_message from DB, aliased as "content" by the API
        sort_order: number;
    }

    interface Props {
        storyId: string;
        storyStarts: StoryStart[];
    }

    let { storyId, storyStarts }: Props = $props();

    // ─── State ────────────────────────────────────────────────────────────────

    let isModalOpen = $state(false);
    let isLoading = $state(false);

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Show an error using the page's existing ArcaneToast */
    function showErrorToast(message: string) {
        window.dispatchEvent(
            new CustomEvent("arcane-toast:show", {
                detail: {
                    id: "story-toast",
                    eyebrow: "Story Error",
                    title: "Could Not Start Story",
                    description: message,
                    icon: "error",
                    duration: 6000,
                },
            }),
        );
    }

    /**
     * Open modal if there are starting points to choose from,
     * otherwise jump straight into session creation.
     */
    function handleReadNow() {
        if (storyStarts.length > 0) {
            isModalOpen = true;
        } else {
            void createSession(null);
        }
    }

    /** Called when the user picks a starting point card in the modal */
    function handleStartSelect(startId: string | null) {
        isModalOpen = false;
        void createSession(startId);
    }

    /**
     * Create a story session and navigate to the chat page.
     *
     * Flow:
     *  1. Get Supabase access token — redirect to sign-in if unauthenticated
     *  2. POST /api/sessions { story_id, start_id? }
     *  3. Redirect to /chat?session=<id>
     */
    async function createSession(startId: string | null) {
        isLoading = true;

        try {
            // 1. Get auth token
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                // Not signed in — send to sign-in with a redirect back here
                window.location.href = `/signin?redirect=/review/${storyId}`;
                return;
            }

            // 2. Create the session record (and insert opening message if start chosen)
            const body: Record<string, string> = { story_id: storyId };
            if (startId) body.start_id = startId;

            const res = await fetch("/api/sessions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error ?? "Failed to create session");
            }

            // 3. Navigate to the chat page with the new session
            window.location.href = `/chat?session=${json.session.id}`;
        } catch (err) {
            isLoading = false;
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : "Something went wrong. Please try again.",
            );
        }
    }
</script>

<!-- ─── Read Now button ──────────────────────────────────────────────────── -->
<button
    type="button"
    onclick={handleReadNow}
    disabled={isLoading}
    class="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/80 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
>
    {#if isLoading}
        <span class="material-symbols-outlined animate-spin text-base"
            >autorenew</span
        >
        Opening…
    {:else}
        <span class="material-symbols-outlined text-base">menu_book</span>
        Read Now
    {/if}
</button>

<!-- ─── Starting Point picker modal ──────────────────────────────────────── -->
{#if isModalOpen}
    <!-- Backdrop -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Choose your opening"
    >
        <!-- Modal card (matches ArcaneModal parchment style) -->
        <div
            class="relative w-full max-w-lg overflow-hidden rounded-xl border-2 border-primary/30 shadow-[0_0_50px_rgba(115,17,212,0.3)]"
            style="background-color:#191022; background-image:radial-gradient(circle at 2px 2px, rgba(115,17,212,0.05) 1px, transparent 0); background-size:24px 24px;"
        >
            <!-- Decorative corner marks -->
            <div
                class="absolute left-0 top-0 m-2 h-8 w-8 border-l-2 border-t-2 border-primary/50"
            ></div>
            <div
                class="absolute right-0 top-0 m-2 h-8 w-8 border-r-2 border-t-2 border-primary/50"
            ></div>
            <div
                class="absolute bottom-0 left-0 m-2 h-8 w-8 border-b-2 border-l-2 border-primary/50"
            ></div>
            <div
                class="absolute bottom-0 right-0 m-2 h-8 w-8 border-b-2 border-r-2 border-primary/50"
            ></div>

            <div class="relative p-8">
                <!-- Header -->
                <div class="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <p
                            class="mb-1 text-xs font-bold uppercase tracking-widest text-primary"
                        >
                            Choose Your Path
                        </p>
                        <h2 class="text-2xl font-bold text-slate-100">
                            The Starting Point
                        </h2>
                        <p class="mt-1 text-sm text-slate-400">
                            Select an opening to begin your journey.
                        </p>
                    </div>
                    <button
                        type="button"
                        onclick={() => (isModalOpen = false)}
                        aria-label="Close"
                        class="rounded-lg p-1 text-slate-500 transition-colors hover:bg-primary/10 hover:text-slate-300"
                    >
                        <span class="material-symbols-outlined text-xl"
                            >close</span
                        >
                    </button>
                </div>

                <!-- Start cards -->
                <div class="flex flex-col gap-3">
                    {#each storyStarts as start (start.id)}
                        <button
                            type="button"
                            onclick={() => handleStartSelect(start.id ?? null)}
                            class="group flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-5 text-left transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98]"
                        >
                            <div class="flex items-center gap-2">
                                <span
                                    class="material-symbols-outlined text-sm text-primary transition-transform group-hover:translate-x-0.5"
                                >
                                    play_arrow
                                </span>
                                <p class="font-bold text-slate-100">
                                    {start.title}
                                </p>
                            </div>
                            {#if start.content}
                                <p
                                    class="line-clamp-3 pl-5 text-sm italic leading-relaxed text-slate-400"
                                >
                                    "{start.content.slice(0, 150)}{start.content
                                        .length > 150
                                        ? "…"
                                        : ""}"
                                </p>
                            {/if}
                        </button>
                    {/each}
                </div>

                <!-- Cancel link -->
                <div class="mt-5 text-center">
                    <button
                        type="button"
                        onclick={() => (isModalOpen = false)}
                        class="text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- ─── Full-screen loading overlay (during session creation) ─────────────── -->
{#if isLoading}
    <div
        class="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background-dark/80 backdrop-blur-sm"
    >
        <span
            class="material-symbols-outlined animate-spin text-5xl text-primary"
            >autorenew</span
        >
        <p class="text-lg font-medium text-slate-300">Opening the story…</p>
    </div>
{/if}

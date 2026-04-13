<script lang="ts">
    /**
     * ChatPage — client-side wrapper for the full chat UI.
     *
     * Why: The access token lives in the browser (Supabase localStorage).
     * We need it before rendering ChatWindow, so this component handles
     * auth bootstrapping and sidebar session loading, then delegates to
     * ChatWindow once the token is ready.
     *
     * Props come from chat.astro (parsed from URL on the server).
     */
    import { onMount } from "svelte";
    import { supabase } from "../lib/supabase";
    import ChatWindow from "./ChatWindow.svelte";

    // ─── Props ────────────────────────────────────────────────────────────────

    interface Props {
        /** Session ID from URL ?session=<id> — null = show empty state */
        sessionId: string | null;
    }

    let { sessionId }: Props = $props();

    // ─── State ────────────────────────────────────────────────────────────────

    /** Access token from Supabase — resolved on mount */
    let accessToken = $state<string | null>(null);

    /** List of the user's sessions for the sidebar */
    let sessions = $state<
        Array<{
            id: string;
            title: string | null;
            updated_at: string;
            stories: { title: string; cover_image_url: string | null } | null;
        }>
    >([]);

    let isAuthReady = $state(false);
    let isNotSignedIn = $state(false);

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    onMount(async () => {
        await bootstrapAuth();
    });

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Get the Supabase access token and load the sidebar sessions */
    async function bootstrapAuth() {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
            isNotSignedIn = true;
            isAuthReady = true;
            return;
        }

        accessToken = session.access_token;
        isAuthReady = true;

        // Kick off session sidebar load in background
        void loadSessions();
    }

    /** Load the user's active story sessions for the sidebar */
    async function loadSessions() {
        if (!accessToken) return;
        try {
            const res = await fetch("/api/sessions", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) return;
            const json = await res.json();
            sessions = json.sessions ?? [];
        } catch {
            // Sidebar is non-critical — silently ignore errors
        }
    }

    /** Navigate to a different session without a full page reload */
    function selectSession(id: string) {
        const url = new URL(window.location.href);
        url.searchParams.set("session", id);
        window.location.href = url.toString();
    }

    /** Format relative time for sidebar items (e.g. "2 hours ago") */
    function relativeTime(iso: string): string {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60_000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }
</script>

{#if !isAuthReady}
    <!-- Loading auth state -->
    <div class="flex flex-1 items-center justify-center">
        <span
            class="material-symbols-outlined animate-spin text-4xl text-primary/40"
            >autorenew</span
        >
    </div>
{:else if isNotSignedIn}
    <!-- Not authenticated -->
    <div
        class="flex flex-1 flex-col items-center justify-center gap-4 text-center"
    >
        <span class="material-symbols-outlined text-5xl text-primary/40"
            >lock</span
        >
        <p class="text-lg font-medium text-slate-300">
            Sign in to begin your story journey
        </p>
        <a
            href="/signin"
            class="rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/80"
        >
            Sign In
        </a>
    </div>
{:else if !sessionId}
    <!-- No session selected — prompt to pick a story -->
    <div
        class="flex flex-1 flex-col items-center justify-center gap-6 text-center"
    >
        <span class="material-symbols-outlined text-6xl text-primary/30"
            >auto_stories</span
        >
        <div>
            <p class="text-2xl font-bold text-slate-200">No story selected</p>
            <p class="mt-2 text-slate-400">
                Browse the library and jump into a story to begin.
            </p>
        </div>
        <a
            href="/"
            class="rounded-xl bg-primary px-6 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/80"
        >
            Browse Stories
        </a>
    </div>
{:else}
    <!-- Main chat layout: sidebar + window -->
    <aside
        id="chat-sidebar"
        class="absolute inset-y-0 left-0 z-20 flex w-80 min-h-0 flex-col border-r border-primary/10 bg-background-dark transition-transform duration-300 ease-in-out"
    >
        <div class="flex min-h-0 flex-1 flex-col p-6">
            <div class="mb-6 flex items-center justify-between">
                <h3 class="flex items-center gap-2 text-lg font-bold">
                    <span class="material-symbols-outlined text-primary"
                        >forum</span
                    >
                    Active Echoes
                </h3>
                {#if sessions.length > 0}
                    <span
                        class="rounded-full bg-primary/20 px-2 py-1 text-xs text-primary"
                    >
                        {sessions.length}
                    </span>
                {/if}
            </div>

            <div class="custom-scrollbar flex-1 space-y-3 overflow-y-auto">
                {#each sessions as s (s.id)}
                    <button
                        class={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all ${s.id === sessionId ? "mystical-glow border-primary/30 bg-primary/10 text-primary" : "border-transparent text-slate-400 hover:bg-white/5"}`}
                        onclick={() => selectSession(s.id)}
                        type="button"
                    >
                        <div
                            class="size-10 shrink-0 overflow-hidden rounded-full border border-slate-700"
                        >
                            {#if s.stories?.cover_image_url}
                                <img
                                    src={s.stories.cover_image_url}
                                    alt=""
                                    class="h-full w-full object-cover"
                                    loading="lazy"
                                />
                            {:else}
                                <div
                                    class="flex h-full w-full items-center justify-center bg-primary/20"
                                >
                                    <span
                                        class="material-symbols-outlined text-sm text-primary"
                                        >auto_stories</span
                                    >
                                </div>
                            {/if}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-bold">
                                {s.stories?.title ??
                                    s.title ??
                                    "Untitled Story"}
                            </p>
                            <p class="text-[10px] font-medium">
                                {relativeTime(s.updated_at)}
                            </p>
                        </div>
                    </button>
                {/each}

                {#if sessions.length === 0}
                    <p class="px-2 text-xs text-slate-600">
                        No active sessions yet. Jump into a story to start one.
                    </p>
                {/if}

                <div class="border-t border-primary/10 pt-4">
                    <a
                        href="/"
                        class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 py-3 text-sm font-medium text-primary/70 transition-all hover:border-primary hover:bg-primary/5 hover:text-primary"
                    >
                        <span class="material-symbols-outlined text-sm"
                            >add_circle</span
                        >
                        Jump into a new story
                    </a>
                </div>
            </div>
        </div>
    </aside>

    <!-- Sidebar toggle button -->
    <button
        aria-expanded="true"
        aria-label="Toggle session sidebar"
        id="sidebar-toggle"
        class="absolute left-80 top-1/2 z-30 -translate-y-1/2 rounded-r-xl border border-primary/30 bg-background-dark/90 p-2 text-primary shadow-lg transition-all duration-300 hover:bg-primary/10"
        type="button"
    >
        <span class="material-symbols-outlined" id="sidebar-toggle-icon"
            >chevron_left</span
        >
    </button>

    <!-- Chat window area -->
    <div
        class="flex min-h-0 flex-1 bg-[#1a1625] pl-80 transition-[padding] duration-300"
        id="chat-content-wrap"
    >
        <ChatWindow
            {sessionId}
            storyTitle={sessions.find((s) => s.id === sessionId)?.stories
                ?.title ?? "The Story"}
            accessToken={accessToken!}
        />
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgb(115 17 212 / 20%);
        border-radius: 10px;
    }
    .mystical-glow {
        box-shadow: 0 0 15px rgb(115 17 212 / 30%);
    }
</style>

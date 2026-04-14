<script lang="ts">
    /**
     * ChatPage — client-side wrapper for the full chat UI.
     *
     * Props come from chat.astro (parsed from URL on the server).
     *
     * Modes:
     *  • sessionId set   → sidebar + ChatWindow (normal chat)
     *  • sessionId null  → session picker (choose a story to continue)
     */
    import { onMount } from "svelte";
    import { supabase } from "../lib/supabase";
    import ChatWindow from "./ChatWindow.svelte";

    // ─── Props ────────────────────────────────────────────────────────────────

    interface Props {
        /** Session ID from URL ?session=<id> — null = show session picker */
        sessionId: string | null;
    }

    let { sessionId }: Props = $props();

    // ─── Types ────────────────────────────────────────────────────────────────

    type SessionItem = {
        id: string;
        title: string | null;
        updated_at: string;
        story_id: string;
        stories: { title: string; cover_image_url: string | null } | null;
    };

    // ─── State ────────────────────────────────────────────────────────────────

    let accessToken = $state<string | null>(null);
    let sessions = $state<SessionItem[]>([]);
    let isAuthReady = $state(false);
    let isNotSignedIn = $state(false);
    let isLoadingSessions = $state(true);
    let sidebarCollapsed = $state(false);

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    onMount(async () => {
        await bootstrapAuth();
    });

    // ─── Helpers ──────────────────────────────────────────────────────────────

    async function bootstrapAuth() {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
            isNotSignedIn = true;
            isAuthReady = true;
            isLoadingSessions = false;
            return;
        }

        accessToken = session.access_token;
        isAuthReady = true;

        // Load sessions (needed for both sidebar and picker)
        await loadSessions();
    }

    async function loadSessions() {
        if (!accessToken) return;
        isLoadingSessions = true;
        try {
            const res = await fetch("/api/sessions", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) return;
            const json = await res.json();
            sessions = json.sessions ?? [];
        } catch {
            // Non-critical — silently ignore
        } finally {
            isLoadingSessions = false;
        }
    }

    function selectSession(id: string) {
        const url = new URL(window.location.href);
        url.searchParams.set("session", id);
        window.location.href = url.toString();
    }

    async function deleteSession(id: string, e: MouseEvent) {
        e.stopPropagation(); // Don't navigate into the session
        if (!accessToken) return;
        if (
            !confirm(
                "Delete this session and all its messages? This cannot be undone.",
            )
        )
            return;

        try {
            const res = await fetch(`/api/sessions/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) return;

            // Remove from local list
            sessions = sessions.filter((s) => s.id !== id);

            // If we just deleted the active session, navigate to picker
            if (id === sessionId) {
                const url = new URL(window.location.href);
                url.searchParams.delete("session");
                window.location.href = url.toString();
            }
        } catch {
            // Silently ignore network errors
        }
    }

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
    <!-- ─── Session picker ────────────────────────────────────────────── -->
    <div class="flex flex-1 flex-col overflow-y-auto">
        <div class="mx-auto w-full max-w-4xl px-6 py-12">
            <!-- Header -->
            <div class="mb-10 text-center">
                <span class="material-symbols-outlined text-5xl text-primary/40"
                    >auto_stories</span
                >
                <h2 class="mt-4 text-3xl font-black text-slate-100">
                    Your Stories
                </h2>
                <p class="mt-2 text-slate-400">
                    Pick up where you left off, or start a new adventure.
                </p>
            </div>

            {#if isLoadingSessions}
                <!-- Loading sessions -->
                <div class="flex justify-center py-16">
                    <span
                        class="material-symbols-outlined animate-spin text-3xl text-primary/40"
                        >autorenew</span
                    >
                </div>
            {:else if sessions.length > 0}
                <!-- Session grid -->
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {#each sessions as s (s.id)}
                        <div class="group/card relative">
                            <button
                                type="button"
                                onclick={() => selectSession(s.id)}
                                class="session-card group flex w-full flex-col overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 text-left transition-all hover:border-primary hover:bg-primary/10 hover:shadow-xl hover:shadow-primary/10 active:scale-[0.98]"
                            >
                                <!-- Cover image -->
                                <div
                                    class="aspect-video w-full overflow-hidden bg-slate-800"
                                >
                                    {#if s.stories?.cover_image_url}
                                        <img
                                            src={s.stories.cover_image_url}
                                            alt=""
                                            class="h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                                            loading="lazy"
                                        />
                                    {:else}
                                        <div
                                            class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-transparent"
                                        >
                                            <span
                                                class="material-symbols-outlined text-5xl text-primary/30"
                                                >book_2</span
                                            >
                                        </div>
                                    {/if}
                                </div>

                                <!-- Info -->
                                <div class="flex flex-1 flex-col gap-1 p-4">
                                    <p
                                        class="truncate font-bold text-slate-100 group-hover:text-primary"
                                    >
                                        {s.stories?.title ??
                                            s.title ??
                                            "Untitled Story"}
                                    </p>
                                    {#if s.title && s.title !== s.stories?.title}
                                        <p
                                            class="truncate text-xs text-slate-400"
                                        >
                                            {s.title}
                                        </p>
                                    {/if}
                                    <p
                                        class="mt-auto pt-2 text-[11px] text-primary/50"
                                    >
                                        <span
                                            class="material-symbols-outlined align-middle text-[13px]"
                                            >schedule</span
                                        >
                                        {relativeTime(s.updated_at)}
                                    </p>
                                </div>
                            </button>
                            <!-- Delete session button (top-right corner on hover) -->
                            <button
                                class="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-slate-400 opacity-0 transition-all hover:bg-red-500/80 hover:text-white group-hover/card:opacity-100"
                                type="button"
                                title="Delete this session"
                                onclick={(e) => deleteSession(s.id, e)}
                            >
                                <span
                                    class="material-symbols-outlined text-sm leading-none"
                                    >delete</span
                                >
                            </button>
                        </div>
                    {/each}
                </div>
            {:else}
                <!-- No sessions yet -->
                <div class="flex flex-col items-center gap-4 py-16 text-center">
                    <span
                        class="material-symbols-outlined text-6xl text-primary/20"
                        >ink_pen</span
                    >
                    <p class="text-lg font-medium text-slate-300">
                        No active stories yet
                    </p>
                    <p class="text-sm text-slate-500">
                        Browse the library and start your first interactive
                        story.
                    </p>
                </div>
            {/if}

            <!-- CTA -->
            <div class="mt-10 flex justify-center">
                <a
                    href="/"
                    class="flex items-center gap-2 rounded-xl bg-primary px-7 py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/80"
                >
                    <span class="material-symbols-outlined text-base"
                        >add_circle</span
                    >
                    Browse Stories
                </a>
            </div>
        </div>
    </div>
{:else}
    <!-- ─── Normal chat layout: sidebar + window ─────────────────────── -->
    <aside
        id="chat-sidebar"
        class={`absolute inset-y-0 left-0 z-20 flex w-80 min-h-0 flex-col border-r border-primary/10 bg-background-dark transition-transform duration-300 ease-in-out ${sidebarCollapsed ? "-translate-x-full" : "translate-x-0"}`}
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
                {#if isLoadingSessions}
                    <div class="flex justify-center py-6">
                        <span
                            class="material-symbols-outlined animate-spin text-xl text-primary/30"
                            >autorenew</span
                        >
                    </div>
                {:else}
                    {#each sessions as s (s.id)}
                        <div class="group/item relative flex items-center">
                            <button
                                class={`flex flex-1 cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all ${s.id === sessionId ? "mystical-glow border-primary/30 bg-primary/10 text-primary" : "border-transparent text-slate-400 hover:bg-white/5"}`}
                                onclick={() => selectSession(s.id)}
                                type="button"
                            >
                                <div
                                    class="size-10 shrink-0 overflow-hidden rounded-full border border-slate-700"
                                >
                                    {#if s.stories?.cover_image_url}
                                        <img
                                            src={`https://wsrv.nl/?url=${encodeURIComponent(s.stories.cover_image_url)}&w=40&h=40&fit=cover&output=webp`}
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
                            <!-- Delete session button (visible on hover) -->
                            <button
                                class="absolute right-1 rounded p-1 text-slate-600 opacity-0 transition-all hover:text-red-400 group-hover/item:opacity-100"
                                type="button"
                                title="Delete session"
                                onclick={(e) => deleteSession(s.id, e)}
                            >
                                <span
                                    class="material-symbols-outlined text-base leading-none"
                                    >delete</span
                                >
                            </button>
                        </div>
                    {/each}

                    {#if sessions.length === 0}
                        <p class="px-2 text-xs text-slate-600">
                            No active sessions yet. Jump into a story to start
                            one.
                        </p>
                    {/if}
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
        aria-expanded={!sidebarCollapsed}
        aria-label="Toggle session sidebar"
        id="sidebar-toggle"
        class={`absolute top-1/2 z-30 -translate-y-1/2 rounded-r-xl border border-primary/30 bg-background-dark/90 p-2 text-primary shadow-lg transition-all duration-300 hover:bg-primary/10 ${sidebarCollapsed ? "left-0" : "left-80"}`}
        type="button"
        onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
    >
        <span class="material-symbols-outlined">
            {sidebarCollapsed ? "chevron_right" : "chevron_left"}
        </span>
    </button>

    <!-- Chat window area -->
    <div
        class={`flex min-h-0 flex-1 bg-[#1a1625] transition-[padding] duration-300 ${sidebarCollapsed ? "pl-0" : "pl-80"}`}
        id="chat-content-wrap"
    >
        <ChatWindow
            {sessionId}
            storyTitle={sessions.find((s) => s.id === sessionId)?.stories
                ?.title ?? "The Story"}
            storyCoverImageUrl={sessions.find((s) => s.id === sessionId)
                ?.stories?.cover_image_url ?? null}
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

    .session-card {
        box-shadow: 0 0 0 1px rgb(115 17 212 / 10%);
    }
    .session-card:hover {
        box-shadow:
            0 0 20px rgb(115 17 212 / 15%),
            0 4px 24px rgb(0 0 0 / 40%);
    }
</style>

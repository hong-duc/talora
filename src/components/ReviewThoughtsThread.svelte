<script lang="ts">
	/**
	 * ReviewThoughtsThread — real comment thread for story review pages.
	 * Fetches comments from /api/stories/[storyId]/comments with cursor-based
	 * pagination. Authenticated users can post new comments.
	 */
	import { tick, untrack } from "svelte";

	type Profile = {
		username: string | null;
		avatar_url: string | null;
	};

	type Comment = {
		id: string;
		content: string;
		created_at: string;
		user_id: string;
		parent_id: string | null;
		profiles: Profile | Profile[] | null;
	};

	// ── Props ──────────────────────────────────────────────────────────────────
	let {
		storyId,
		initialComments = [],
		initialTotal = 0,
	}: {
		storyId: string;
		initialComments?: Comment[];
		initialTotal?: number;
	} = $props();

	// ── State ──────────────────────────────────────────────────────────────────
	// untrack() tells Svelte 5 that reading these props once (for initialization)
	// is intentional — suppresses the "only captures initial value" warning.
	let comments = $state<Comment[]>(untrack(() => initialComments));
	let totalReflections = $state(untrack(() => initialTotal));
	let draft = $state("");
	let threadEl = $state<HTMLElement | undefined>(undefined);

	// Pagination
	let nextCursor = $state<string | null>(
		untrack(() =>
			initialComments.length > 0
				? initialComments[initialComments.length - 1].created_at
				: null,
		),
	);
	let hasMore = $state(untrack(() => initialComments.length === 10)); // assume more if first page is full

	// Loading / error states
	let isSubmitting = $state(false);
	let isLoadingMore = $state(false);
	let submitError = $state<string | null>(null);
	let loadMoreError = $state<string | null>(null);

	// ── Helpers ────────────────────────────────────────────────────────────────

	/** Normalise the nested profiles field (Supabase may return an array) */
	function getProfile(comment: Comment): Profile {
		if (!comment.profiles) return { username: null, avatar_url: null };
		if (Array.isArray(comment.profiles)) {
			return comment.profiles[0] ?? { username: null, avatar_url: null };
		}
		return comment.profiles;
	}

	/** Format a timestamp to a human-readable relative time */
	function relativeTime(isoString: string): string {
		const diff = Date.now() - new Date(isoString).getTime();
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) return "Just now";
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60)
			return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
		const days = Math.floor(hours / 24);
		if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
		const months = Math.floor(days / 30);
		if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
		const years = Math.floor(months / 12);
		return `${years} year${years === 1 ? "" : "s"} ago`;
	}

	/** Get the Supabase access token from the browser client */
	async function getAccessToken(): Promise<string | null> {
		try {
			const supabaseUrl = (window as any).__supabaseUrl;
			const supabaseKey = (window as any).__supabaseKey;
			if (!supabaseUrl || !supabaseKey) return null;
			const { createClient } = await import("@supabase/supabase-js");
			const client = createClient(supabaseUrl, supabaseKey);
			const {
				data: { session },
			} = await client.auth.getSession();
			return session?.access_token ?? null;
		} catch {
			return null;
		}
	}

	// ── Submit a new reflection ────────────────────────────────────────────────
	async function submitReflection() {
		const text = draft.trim();
		if (!text || isSubmitting) return;

		submitError = null;
		isSubmitting = true;

		const token = await getAccessToken();
		if (!token) {
			window.location.href = `/signin?redirect=/review/${storyId}`;
			return;
		}

		try {
			const res = await fetch(`/api/stories/${storyId}/comments`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content: text }),
			});

			const json = await res.json();

			if (!res.ok) {
				submitError = json.error ?? "Failed to post your reflection.";
				return;
			}

			// Prepend new comment (newest first) and update count
			comments = [json.comment, ...comments];
			totalReflections += 1;
			draft = "";

			// Scroll to top of thread to show the new comment
			await tick();
			threadEl?.scrollTo({ top: 0, behavior: "smooth" });
		} catch {
			submitError = "Network error. Please try again.";
		} finally {
			isSubmitting = false;
		}
	}

	// ── Load more ─────────────────────────────────────────────────────────────
	async function loadMore() {
		if (!nextCursor || isLoadingMore) return;

		loadMoreError = null;
		isLoadingMore = true;

		try {
			const url = `/api/stories/${storyId}/comments?limit=10&cursor=${encodeURIComponent(nextCursor)}`;
			const res = await fetch(url);
			const json = await res.json();

			if (!res.ok) {
				loadMoreError = json.error ?? "Failed to load more.";
				return;
			}

			comments = [...comments, ...(json.comments ?? [])];
			nextCursor = json.nextCursor ?? null;
			hasMore = !!json.nextCursor;
		} catch {
			loadMoreError = "Network error. Please try again.";
		} finally {
			isLoadingMore = false;
		}
	}

	// Handle Enter key (without Shift) to submit
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void submitReflection();
		}
	}
</script>

<div class="mb-8 flex items-center justify-between">
	<h3 class="flex items-center gap-3 text-2xl font-bold text-slate-100">
		<span class="material-symbols-outlined text-primary">edit_note</span>
		Scroll of Thoughts
	</h3>
	<span class="text-sm font-bold uppercase tracking-wider text-primary"
		>{totalReflections} Reflection{totalReflections === 1 ? "" : "s"}</span
	>
</div>

<!-- Comment thread -->
<div
	bind:this={threadEl}
	class="custom-scrollbar max-h-90 space-y-6 overflow-y-auto pr-1"
>
	{#if comments.length === 0}
		<div
			class="flex flex-col items-center gap-3 rounded-xl border border-primary/10 bg-slate-900/40 p-10 text-center"
		>
			<span class="material-symbols-outlined text-4xl text-primary/30"
				>chat_bubble_outline</span
			>
			<p class="text-sm italic text-slate-500">
				No reflections yet. Be the first to leave your thoughts.
			</p>
		</div>
	{:else}
		{#each comments as comment (comment.id)}
			{@const profile = getProfile(comment)}
			<div
				class="flex items-start gap-4 rounded-xl border border-primary/10 bg-slate-900/40 p-6"
			>
				<!-- Avatar -->
				<div
					class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/20"
				>
					{#if profile.avatar_url}
						<img
							src={profile.avatar_url}
							alt={profile.username ?? "Seeker"}
							class="size-full object-cover"
						/>
					{:else}
						<span class="material-symbols-outlined text-primary"
							>person</span
						>
					{/if}
				</div>

				<!-- Content -->
				<div class="flex-1 min-w-0">
					<div class="mb-2 flex items-center justify-between gap-2">
						<h4 class="font-bold text-slate-200 truncate">
							{profile.username ?? "Anonymous Seeker"}
						</h4>
						<span
							class="shrink-0 text-xs font-medium text-slate-500"
							>{relativeTime(comment.created_at)}</span
						>
					</div>
					<p
						class="italic leading-relaxed text-slate-400 wrap-break-word"
					>
						"{comment.content}"
					</p>
				</div>
			</div>
		{/each}

		<!-- Load more -->
		{#if hasMore}
			<div class="pt-2 text-center">
				{#if loadMoreError}
					<p class="mb-2 text-xs text-red-400">{loadMoreError}</p>
				{/if}
				<button
					type="button"
					onclick={loadMore}
					disabled={isLoadingMore}
					class="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isLoadingMore}
						<span
							class="material-symbols-outlined animate-spin text-base"
							>autorenew</span
						>
						Loading…
					{:else}
						<span class="material-symbols-outlined text-base"
							>expand_more</span
						>
						Load more reflections
					{/if}
				</button>
			</div>
		{/if}
	{/if}
</div>

<!-- New reflection input -->
<div class="mt-8">
	{#if submitError}
		<p
			class="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400"
		>
			{submitError}
		</p>
	{/if}
	<textarea
		bind:value={draft}
		onkeydown={handleKeydown}
		class="w-full rounded-xl border border-primary/20 bg-primary/5 p-4 italic text-slate-100 placeholder:text-slate-600 focus:border-primary focus:ring-primary"
		placeholder="Add your whisper to the scroll…"
		rows="3"
		disabled={isSubmitting}
	></textarea>
	<div class="mt-3 flex items-center justify-between gap-3">
		<span class="text-xs text-slate-600"
			>Press Enter to submit · Shift+Enter for newline</span
		>
		<button
			class="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/20 px-6 py-2 font-bold text-primary transition-all hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
			onclick={submitReflection}
			type="button"
			disabled={isSubmitting || !draft.trim()}
		>
			{#if isSubmitting}
				<span class="material-symbols-outlined animate-spin text-base"
					>autorenew</span
				>
				Submitting…
			{:else}
				Submit Reflection
			{/if}
		</button>
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}

	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgb(115 17 212 / 30%);
		border-radius: 999px;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgb(115 17 212 / 50%);
	}
</style>

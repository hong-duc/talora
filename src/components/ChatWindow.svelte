<script lang="ts">
	/**
	 * ChatWindow — interactive story chat UI.
	 *
	 * Wired to the real API:
	 *  - On mount: loads existing messages from GET /api/sessions/[sessionId]
	 *    The response includes `storyStart` — if messages is empty the opening
	 *    line is rendered as a virtual AI message so the story always begins.
	 *  - sendMessage: POST to /api/sessions/[sessionId]/messages
	 *    → server builds the system prompt, calls the user's AI backend,
	 *      saves the reply, and returns it.
	 *
	 * Errors → shown as dismissible floating toast (title + full message).
	 * The ⚙️ button opens ChatSettings for AI backend configuration.
	 *
	 * Debug: set localStorage.debug = 'chat' or window.chatDebug = true to
	 * enable verbose client-side logging.
	 */
	import { onDestroy, onMount } from "svelte";
	import { store } from "../lib/store";
	import ChatSettings from "./ChatSettings.svelte";

	// ─── Types ─────────────────────────────────────────────────────────────────

	type ChatMessage = {
		id: string;
		session_id: string;
		sender: "assistant" | "user";
		text: string;
		meta?: string;
	};

	type Toast = {
		id: string;
		title: string;
		description: string;
	};

	// ─── Props ─────────────────────────────────────────────────────────────────

	interface Props {
		/** The story session ID — drives all API calls */
		sessionId: string;
		/** Story title shown in the header */
		storyTitle?: string;
		/** Bearer token for authenticated API calls */
		accessToken: string;
	}

	let { sessionId, storyTitle = "The Story", accessToken }: Props = $props();

	// ─── Constants ─────────────────────────────────────────────────────────────

	const assistantAvatar =
		"https://lh3.googleusercontent.com/aida-public/AB6AXuAeU2KXL0RQMXMMR_MtNDh0qSh5Ebj1ENtUaFWUlRxOhFYbikmEQEHmkBUKA9l_PXvUp-Wv2cletbmBsnJUwCd_oAR3YD9s9GuOa1xfV2N5JZx2lY7GysL-EXep9j5dtu7AbM9dl1afLy6NVZ2f66L5Gslu8pdYx-JOu8gZ3rmLDaTzViwpicx4_FRnZKLaTFY6YtEN0tNoxiErlbiH85Esj-VpIKiHsDsunvt8Dgeq5BBWhLQ_UO9Beo6PQB5NVxLRUre_aHhxX8A";

	const userAvatarFallback = "/default_user_profile.png";

	/** Pick the user avatar, falling back to the default if URL is empty */
	const toAvatarUrl = (url?: string | null) =>
		url?.trim() ? url.trim() : userAvatarFallback;

	// ─── State ─────────────────────────────────────────────────────────────────

	let messages = $state<ChatMessage[]>([]);
	let draft = $state("");
	let isReplying = $state(false);
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let showSettings = $state(false);

	/** Active floating error toasts */
	let toasts = $state<Toast[]>([]);
	/** Per-toast auto-dismiss timer IDs */
	let toastTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	let userAvatar = $state(
		toAvatarUrl(store.getState().auth.profile?.avatar_url),
	);

	/** The DOM element for the scrollable message list */
	let messagesEl = $state<HTMLElement | null>(null);

	// ─── Store sync ────────────────────────────────────────────────────────────

	const unsubscribe = store.subscribe(() => {
		userAvatar = toAvatarUrl(store.getState().auth.profile?.avatar_url);
	});
	onDestroy(unsubscribe);
	onDestroy(() => {
		// Clear any pending toast timers on unmount
		for (const id of Object.keys(toastTimers)) {
			clearTimeout(toastTimers[id]);
		}
	});

	// ─── Lifecycle ─────────────────────────────────────────────────────────────

	onMount(async () => {
		debug("ChatWindow mounted", { sessionId });
		await loadSession();
		scrollToBottom("auto");
	});

	// ─── API helpers ───────────────────────────────────────────────────────────

	/**
	 * Load the session's existing messages from the API.
	 *
	 * The server now returns `storyStart` alongside messages.
	 * If the DB has no messages yet but the session was started with a story_start
	 * entry, we render the opening line as the first virtual AI message so the
	 * story always begins with narrative context.
	 */
	async function loadSession() {
		isLoading = true;
		loadError = null;
		try {
			debug("loadSession →", `/api/sessions/${sessionId}`);
			const res = await fetch(`/api/sessions/${sessionId}`, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});

			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				throw new Error(json.error ?? `HTTP ${res.status}`);
			}

			const { messages: dbMessages, storyStart } = await res.json();
			const mapped: ChatMessage[] = (dbMessages ?? []).map(dbToChat);

			debug("loadSession ←", {
				messageCount: mapped.length,
				hasStoryStart: !!storyStart?.first_message,
			});

			if (mapped.length === 0 && storyStart?.first_message) {
				// No DB messages yet — show the story-start opening line as a virtual
				// AI message so the chat always starts with narrative flavour.
				debug(
					"loadSession: using virtual opening message from storyStart",
				);
				messages = [
					{
						id: "story-start-virtual",
						session_id: sessionId,
						sender: "assistant",
						text: storyStart.first_message,
						meta: "The story begins…",
					},
				];
			} else {
				messages = mapped;
			}
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Failed to load messages";
			loadError = msg;
			console.error("[ChatWindow] loadSession error:", msg);
		} finally {
			isLoading = false;
		}
	}

	// ─── Actions ───────────────────────────────────────────────────────────────

	/**
	 * Send the user's draft message:
	 *  1. Optimistically add it to the local list
	 *  2. POST to /api/sessions/[id]/messages
	 *     Server builds the full system prompt, calls the user's AI backend,
	 *     saves both messages, and returns the assistant reply.
	 *  3. Append the assistant reply
	 *  4. On any error → show a dismissible floating toast with the full message
	 */
	async function sendMessage() {
		const text = draft.trim();
		if (!text || isReplying) return;

		debug("sendMessage →", { charLen: text.length });

		// Optimistic UI — show the user's message immediately
		const optimisticId = crypto.randomUUID();
		messages = [
			...messages,
			{
				id: optimisticId,
				session_id: sessionId,
				sender: "user",
				text,
				meta: "Delivered via spirit-link",
			},
		];
		draft = "";
		await tick();
		scrollToBottom();

		isReplying = true;

		try {
			const res = await fetch(`/api/sessions/${sessionId}/messages`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content: text }),
			});

			const json = await res.json().catch(() => ({}));

			if (!res.ok) {
				const errMsg =
					json.error ?? `Server error (HTTP ${res.status})`;

				debug("sendMessage ✗ API error", {
					status: res.status,
					error: errMsg,
				});
				console.error("[ChatWindow] sendMessage API error:", errMsg, {
					status: res.status,
					sessionId,
				});

				// 422 = AI config issue (missing config or decryption failure)
				// Show the server's exact error message — it contains actionable guidance
				if (res.status === 422) {
					showToast("AI Configuration Error", errMsg, 10_000);
				} else {
					showToast("Story Interrupted", errMsg, 9_000);
				}
				return;
			}

			// Append the real assistant reply from the server
			if (json.message) {
				debug("sendMessage ← assistant reply", {
					msgId: json.message.id,
					replyLen: json.message.content?.length,
				});
				messages = [...messages, dbToChat(json.message)];
			}
		} catch (err) {
			const errMsg =
				err instanceof Error ? err.message : "Unknown network error";
			debug("sendMessage ✗ network error", errMsg);
			console.error("[ChatWindow] sendMessage network error:", errMsg);
			showToast(
				"Connection Lost",
				`Network error — please check your connection and try again. (${errMsg})`,
				9_000,
			);
		} finally {
			isReplying = false;
			await tick();
			scrollToBottom();
		}
	}

	// ─── Toast helpers ─────────────────────────────────────────────────────────

	/**
	 * Show a dismissible floating error toast with full error details.
	 * Auto-dismisses after `duration` ms (default 8 s).
	 */
	function showToast(
		title: string,
		description: string,
		duration = 8_000,
	): void {
		const id = crypto.randomUUID();
		toasts = [...toasts, { id, title, description }];
		debug("toast shown", { title, description });

		// Auto-dismiss
		toastTimers[id] = setTimeout(() => dismissToast(id), duration);
	}

	/** Remove a toast from the list and cancel its timer. */
	function dismissToast(id: string): void {
		toasts = toasts.filter((t) => t.id !== id);
		clearTimeout(toastTimers[id]);
		delete toastTimers[id];
	}

	// ─── Helpers ───────────────────────────────────────────────────────────────

	/** Map a DB message row to the internal ChatMessage shape */
	function dbToChat(msg: {
		id: string;
		session_id: string;
		role: string;
		content: string;
		created_at?: string;
	}): ChatMessage {
		return {
			id: msg.id,
			session_id: msg.session_id,
			sender: msg.role === "user" ? "user" : "assistant",
			text: msg.content,
			meta:
				msg.role === "user"
					? "Delivered via spirit-link"
					: formatTime(msg.created_at),
		};
	}

	/** Format an ISO timestamp as "The Librarian materialized at HH:MM" */
	function formatTime(iso?: string): string | undefined {
		if (!iso) return undefined;
		const d = new Date(iso);
		return `The Librarian materialized at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	}

	/** Scroll message list to the bottom */
	function scrollToBottom(behavior: ScrollBehavior = "smooth") {
		if (!messagesEl) return;
		messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior });
	}

	/** Wait for Svelte to flush DOM updates */
	function tick(): Promise<void> {
		return new Promise((r) => setTimeout(r, 0));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void sendMessage();
		}
	}

	function handleInput(event: Event) {
		draft = (event.currentTarget as HTMLTextAreaElement).value;
	}

	// ─── Debug ─────────────────────────────────────────────────────────────────

	/** Client-side debug logger — enabled when localStorage.debug === 'chat' */
	function debug(label: string, ...args: unknown[]): void {
		try {
			const enabled =
				typeof window !== "undefined" &&
				(localStorage.getItem("debug") === "chat" ||
					(window as unknown as Record<string, unknown>)[
						"chatDebug"
					] === true);
			if (enabled) {
				console.debug(`[ChatWindow] ${label}`, ...args);
			}
		} catch {
			// localStorage may not be available in some contexts
		}
	}
</script>

<!-- ─── Floating error toasts ─────────────────────────────────────────────── -->
{#if toasts.length > 0}
	<div
		class="pointer-events-none fixed left-1/2 top-6 z-[100] flex w-[min(92vw,32rem)] -translate-x-1/2 flex-col gap-3"
		aria-live="assertive"
		aria-atomic="false"
	>
		{#each toasts as toast (toast.id)}
			<div
				class="pointer-events-auto flex items-start gap-4 rounded-xl border border-red-500/40 bg-[#3b0d1e]/95 px-5 py-4 shadow-2xl backdrop-blur-md transition-all duration-300"
				role="alert"
			>
				<!-- Icon -->
				<span
					class="material-symbols-outlined mt-0.5 shrink-0 text-2xl text-red-400"
					style="font-variation-settings:'FILL' 1"
				>
					error
				</span>

				<!-- Content -->
				<div class="flex min-w-0 flex-1 flex-col gap-1">
					<p class="text-sm font-bold text-red-300">{toast.title}</p>
					<p
						class="break-words text-sm leading-relaxed text-red-200/80"
					>
						{toast.description}
					</p>
				</div>

				<!-- Dismiss button -->
				<button
					class="shrink-0 text-red-400/60 transition-colors hover:text-red-300"
					onclick={() => dismissToast(toast.id)}
					type="button"
					aria-label="Dismiss notification"
				>
					<span class="material-symbols-outlined text-base"
						>close</span
					>
				</button>
			</div>
		{/each}
	</div>
{/if}

<!-- ─── Settings panel (conditionally rendered) ──────────────────────────── -->
{#if showSettings}
	<ChatSettings {accessToken} onClose={() => (showSettings = false)} />
{/if}

<!-- ─── Main chat section ─────────────────────────────────────────────────── -->
<section
	class="parchment-bg relative flex min-h-0 flex-1 flex-col overflow-hidden"
>
	<!-- Chat header -->
	<div
		class="glass-panel flex items-center justify-between border-b border-primary/10 p-4"
	>
		<div class="flex items-center gap-4">
			<div
				class="size-10 overflow-hidden rounded-full border border-primary"
			>
				<img
					alt="Story character portrait"
					class="h-full w-full object-cover"
					src={assistantAvatar}
				/>
			</div>
			<div>
				<h4 class="font-bold text-slate-100">{storyTitle}</h4>
				<p class="flex items-center gap-1 text-xs text-primary">
					<span
						class="material-symbols-outlined animate-pulse text-[10px]"
						>magic_button</span
					>
					Interactive Story
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<button
				class="p-2 text-slate-400 transition-colors hover:text-primary"
				type="button"
				aria-label="Session history"
			>
				<span class="material-symbols-outlined">history_edu</span>
			</button>
			<!-- Settings button → opens ChatSettings panel -->
			<button
				class="p-2 text-slate-400 transition-colors hover:text-primary"
				type="button"
				aria-label="AI Settings"
				onclick={() => (showSettings = true)}
			>
				<span class="material-symbols-outlined">settings</span>
			</button>
		</div>
	</div>

	<!-- Message list -->
	<div
		bind:this={messagesEl}
		class="custom-scrollbar min-h-0 flex-1 space-y-8 overflow-y-auto scroll-smooth p-8"
	>
		<!-- Loading state -->
		{#if isLoading}
			<div class="flex justify-center py-12">
				<span
					class="material-symbols-outlined animate-spin text-3xl text-primary/40"
					>autorenew</span
				>
			</div>

			<!-- Error state (load failure — not per-send errors, those use toasts) -->
		{:else if loadError}
			<div
				class="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400"
			>
				<span
					class="material-symbols-outlined mb-2 text-3xl"
					style="font-variation-settings:'FILL' 1"
				>
					error
				</span>
				<p class="font-bold">Failed to load the story session</p>
				<p class="mt-1 text-sm opacity-70">{loadError}</p>
				<button
					class="mt-4 rounded-lg border border-red-500/30 px-4 py-2 text-sm transition-colors hover:bg-red-500/10"
					type="button"
					onclick={loadSession}
				>
					Try again
				</button>
			</div>
		{:else}
			{#each messages as message (message.id)}
				{#if message.sender === "assistant"}
					<!-- ── Assistant message (left-aligned) ── -->
					<div class="flex max-w-2xl gap-4">
						<div
							class="mt-2 size-8 shrink-0 overflow-hidden rounded-full border border-primary"
						>
							<img
								alt="Story assistant avatar"
								class="h-full w-full object-cover"
								src={assistantAvatar}
								loading="lazy"
							/>
						</div>
						<div class="flex flex-col gap-2">
							<div
								class="glass-panel relative rounded-bl-xl rounded-br-xl rounded-tr-xl border-l-4 border-l-primary p-5"
							>
								<div
									class="absolute -left-2 top-3 h-0 w-0 border-b-8 border-r-8 border-t-8 border-b-transparent border-r-primary/40 border-t-transparent"
								></div>
								<p class="leading-relaxed text-slate-200">
									{message.text}
								</p>
							</div>
							{#if message.meta}
								<span
									class="px-1 text-[10px] italic text-slate-500"
									>{message.meta}</span
								>
							{/if}
						</div>
					</div>
				{:else}
					<!-- ── User message (right-aligned) ── -->
					<div class="ml-auto flex max-w-2xl flex-row-reverse gap-4">
						<div
							class="mt-2 size-8 shrink-0 overflow-hidden rounded-full border border-slate-700"
						>
							<img
								alt="Your avatar"
								class="h-full w-full object-cover"
								src={userAvatar}
								loading="lazy"
							/>
						</div>
						<div class="flex flex-col items-end gap-2">
							<div
								class="relative rounded-bl-xl rounded-br-xl rounded-tl-xl bg-primary p-5 text-white shadow-lg"
							>
								<div
									class="absolute -right-2 top-3 h-0 w-0 border-b-8 border-l-8 border-t-8 border-b-transparent border-l-primary border-t-transparent"
								></div>
								<p class="leading-relaxed">{message.text}</p>
							</div>
							{#if message.meta}
								<span
									class="px-1 text-[10px] italic text-slate-500"
									>{message.meta}</span
								>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		{/if}

		<!-- Typing indicator (shown while waiting for the AI reply) -->
		{#if isReplying}
			<div class="flex max-w-2xl gap-4">
				<div
					class="mt-2 size-8 shrink-0 overflow-hidden rounded-full border border-primary"
				>
					<img
						alt="Story assistant avatar"
						class="h-full w-full object-cover"
						src={assistantAvatar}
						loading="lazy"
					/>
				</div>
				<div
					class="glass-panel rounded-bl-xl rounded-br-xl rounded-tr-xl border-l-4 border-l-primary px-4 py-3 text-sm text-primary/80"
				>
					The story unfolds…
				</div>
			</div>
		{/if}
	</div>

	<!-- Input bar -->
	<div class="glass-panel relative border-t border-primary/10 p-6">
		<div
			class="mystical-glow group mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-primary/30 bg-background-dark/80 p-2 transition-all focus-within:border-primary"
		>
			<button
				class="p-3 text-slate-500 transition-colors hover:text-primary"
				type="button"
			>
				<span class="material-symbols-outlined">ink_pen</span>
			</button>
			<textarea
				class="scrollbar-hide flex-1 resize-none border-none bg-transparent py-3 font-display italic text-slate-100 placeholder:text-slate-600 focus:ring-0"
				oninput={handleInput}
				onkeydown={handleKeydown}
				placeholder="Whisper your response into the inkwell..."
				rows="1"
				value={draft}
				disabled={isReplying || isLoading}
			></textarea>
			<div class="flex gap-1 pb-1">
				<button
					class="p-2 text-slate-500 transition-colors hover:text-primary"
					type="button"
				>
					<span class="material-symbols-outlined"
						>auto_fix_normal</span
					>
				</button>
				<button
					class="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg transition-all hover:bg-primary/80 active:scale-95 disabled:opacity-40"
					onclick={sendMessage}
					type="button"
					disabled={isReplying || isLoading || !draft.trim()}
					aria-label="Send message"
				>
					<span class="material-symbols-outlined">send</span>
				</button>
			</div>
		</div>
		<div class="pointer-events-none absolute -top-4 right-10 opacity-20">
			<span
				class="material-symbols-outlined animate-pulse text-6xl text-primary"
				>ink_highlighter</span
			>
		</div>
	</div>
</section>

<style>
	/* Parchment dot-grid background */
	.parchment-bg {
		background-color: #1a1625;
		background-image: radial-gradient(
			circle at 2px 2px,
			rgb(115 17 212 / 5%) 1px,
			transparent 0
		);
		background-size: 24px 24px;
	}

	/* Subtle purple glow around the input area */
	.mystical-glow {
		box-shadow: 0 0 15px rgb(115 17 212 / 30%);
	}

	/* Frosted glass panel used for header and input bar */
	.glass-panel {
		background: rgb(48 40 57 / 40%);
		backdrop-filter: blur(8px);
		border: 1px solid rgb(115 17 212 / 20%);
	}

	/* Custom scrollbar for message list */
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

	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgb(115 17 212 / 50%);
	}

	/* Hide textarea scrollbar */
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>

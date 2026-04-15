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

	/** One slot of variants for an AI reply position. */
	type VariantSlot = {
		/** All generated variants for this position (oldest first). */
		variants: ChatMessage[];
		/** Index of the currently displayed variant. */
		idx: number;
	};

	// ─── Props ─────────────────────────────────────────────────────────────────

	interface Props {
		/** The story session ID — drives all API calls */
		sessionId: string;
		/** Story title shown in the header */
		storyTitle?: string;
		/** Bearer token for authenticated API calls */
		accessToken: string;
		/**
		 * Cover image URL of the story — used as the assistant avatar via wsrv.nl
		 * for on-the-fly resizing. Falls back to the default anonymous image.
		 */
		storyCoverImageUrl?: string | null;
	}

	let {
		sessionId,
		storyTitle = "The Story",
		accessToken,
		storyCoverImageUrl = null,
	}: Props = $props();

	// ─── Constants ─────────────────────────────────────────────────────────────

	/** Anonymous fallback avatar (used when story has no cover image) */
	const ANONYMOUS_AVATAR = "/default_user_profile.png";

	/**
	 * Build the assistant avatar URL using wsrv.nl — a free image CDN/proxy that
	 * resizes images on the fly. Falls back to the generic anonymous avatar when
	 * the story has no cover image.
	 */
	function buildAssistantAvatar(coverUrl: string | null | undefined): string {
		if (!coverUrl?.trim()) return ANONYMOUS_AVATAR;
		return `https://wsrv.nl/?url=${encodeURIComponent(coverUrl.trim())}&w=64&h=64&fit=cover&a=attention&output=webp&q=85`;
	}

	const userAvatarFallback = "/default_user_profile.png";

	/** Pick the user avatar, resizing on-the-fly via wsrv.nl (same approach as the
	 *  assistant avatar), falling back to the default if URL is empty. */
	const toAvatarUrl = (url?: string | null): string => {
		if (!url?.trim()) return userAvatarFallback;
		return `https://wsrv.nl/?url=${encodeURIComponent(url.trim())}&w=64&h=64&fit=cover&a=attention&output=webp&q=85`;
	};

	// ─── Derived ───────────────────────────────────────────────────────────────

	/** Assistant avatar — computed from the story's cover image via wsrv.nl */
	let assistantAvatar = $derived(buildAssistantAvatar(storyCoverImageUrl));

	// ─── State ─────────────────────────────────────────────────────────────────

	let messages = $state<ChatMessage[]>([]);
	let draft = $state("");
	let isReplying = $state(false);
	let isRerolling = $state(false);
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let showSettings = $state(false);
	let showFontPanel = $state(false);

	/** Chat reading font — persisted in localStorage */
	const FONT_FAMILIES: Record<string, string> = {
		inherit: "Default",
		// ── Free Google fonts — great for long reading ──────────────────────
		"'Lora', serif": "Lora",
		"'Merriweather', serif": "Merriweather",
		"'Literata', serif": "Literata",
		"'Atkinson Hyperlegible', sans-serif": "Atkinson",
		"'Newsreader', serif": "Newsreader",
		// ── System / classic fonts ──────────────────────────────────────────
		"Georgia, serif": "Georgia",
		"'Times New Roman', serif": "Times New Roman",
		"system-ui, sans-serif": "System Sans",
		"'Courier New', monospace": "Monospace",
	};
	const FONT_SIZES: Record<string, string> = {
		"13px": "XS",
		"15px": "Small",
		"17px": "Medium",
		"19px": "Large",
		"22px": "XL",
	};

	let fontFamily = $state(
		typeof localStorage !== "undefined"
			? (localStorage.getItem("chat-font-family") ?? "inherit")
			: "inherit",
	);
	let fontSize = $state(
		typeof localStorage !== "undefined"
			? (localStorage.getItem("chat-font-size") ?? "17px")
			: "17px",
	);

	function setFontFamily(val: string) {
		fontFamily = val;
		if (typeof localStorage !== "undefined")
			localStorage.setItem("chat-font-family", val);
	}
	function setFontSize(val: string) {
		fontSize = val;
		if (typeof localStorage !== "undefined")
			localStorage.setItem("chat-font-size", val);
	}

	/** Set to true when the last send failed (shows inline retry button) */
	let lastSendFailed = $state(false);

	/** ID of the message currently being edited (null = no edit in progress) */
	let editingMsgId = $state<string | null>(null);
	/** Draft text for the in-place edit */
	let editDraft = $state("");

	/** Active floating error toasts */
	let toasts = $state<Toast[]>([]);
	/** Per-toast auto-dismiss timer IDs */
	let toastTimers: Record<string, ReturnType<typeof setTimeout>> = {};

	let userAvatar = $state(
		toAvatarUrl(store.getState().auth.profile?.avatar_url),
	);

	/** The DOM element for the scrollable message list */
	let messagesEl = $state<HTMLElement | null>(null);

	// ─── Derived state ─────────────────────────────────────────────────────────

	/** ID of the last message — used to show action buttons (reroll etc.) */
	let lastMessageId = $derived(messages.at(-1)?.id ?? null);
	let lastMessageRole = $derived(messages.at(-1)?.sender ?? null);

	/**
	 * True once the user has sent at least one message in this session.
	 * Reroll requires a preceding user message in the DB — it must not be
	 * offered before first user input (e.g. on a fresh session with only the
	 * story opening message).
	 */
	let hasUserMessage = $derived(messages.some((m) => m.sender === "user"));

	/**
	 * Variant slots — keyed by the ID of the user message that immediately
	 * precedes the AI reply (or "story-start" for the very first message).
	 * Each slot holds all generated versions so the user can navigate them.
	 * Pure client-side; the DB always stores only the latest rerolled version.
	 */
	let variantSlots = $state<Record<string, VariantSlot>>({});

	/**
	 * The slot key for the last AI reply in the conversation.
	 * Used to look up + render the variant navigator below the last message.
	 */
	let lastReplySlotKey = $derived.by(() => getLastReplySlotKey());

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
				lastSendFailed = true;
				return;
			}

			// Append the real assistant reply from the server
			if (json.message) {
				debug("sendMessage ← assistant reply", {
					msgId: json.message.id,
					replyLen: json.message.content?.length,
				});
				messages = [...messages, dbToChat(json.message)];
				lastSendFailed = false;
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
			lastSendFailed = true;
		} finally {
			isReplying = false;
			await tick();
			scrollToBottom();
		}
	}

	/**
	 * Returns the slot key for the current last AI reply.
	 * Key = ID of the user message immediately preceding the last assistant
	 * message, or "story-start" when the AI reply is the first message.
	 */
	function getLastReplySlotKey(): string {
		const lastAiIdx = messages.findLastIndex(
			(m) => m.sender === "assistant",
		);
		if (lastAiIdx <= 0) return "story-start";
		for (let i = lastAiIdx - 1; i >= 0; i--) {
			if (messages[i].sender === "user") return messages[i].id;
		}
		return "story-start";
	}

	/**
	 * Reroll / Retry — call POST /api/sessions/[id]/reroll.
	 *
	 * Each reroll appends a new variant to the slot and updates messages to
	 * show it. The user can then navigate ← → to compare all versions.
	 */
	async function rerollLastMessage() {
		if (isRerolling || isReplying) return;
		isRerolling = true;
		lastSendFailed = false;

		// Capture context before the async gap
		const slotKey = getLastReplySlotKey();
		const prevLastAi =
			messages.findLast((m) => m.sender === "assistant") ?? null;

		try {
			const res = await fetch(`/api/sessions/${sessionId}/reroll`, {
				method: "POST",
				headers: { Authorization: `Bearer ${accessToken}` },
			});
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				showToast(
					"Reroll Failed",
					json.error ?? `HTTP ${res.status}`,
					8_000,
				);
				return;
			}

			if (json.message) {
				const newVariant = dbToChat(json.message);

				// ── Update variant slot ─────────────────────────────────────
				const existing = variantSlots[slotKey];
				if (!existing) {
					// First reroll for this slot: seed with previous reply + new one
					variantSlots = {
						...variantSlots,
						[slotKey]: {
							variants: prevLastAi
								? [prevLastAi, newVariant]
								: [newVariant],
							idx: prevLastAi ? 1 : 0,
						},
					};
				} else {
					const updated = [...existing.variants, newVariant];
					variantSlots = {
						...variantSlots,
						[slotKey]: {
							variants: updated,
							idx: updated.length - 1,
						},
					};
				}

				// ── Update messages list ────────────────────────────────────
				if (messages.at(-1)?.sender === "assistant") {
					messages = [...messages.slice(0, -1), newVariant];
				} else {
					messages = [...messages, newVariant];
				}
			}
			await tick();
			scrollToBottom();
		} catch (err) {
			showToast(
				"Reroll Failed",
				err instanceof Error ? err.message : "Network error",
			);
		} finally {
			isRerolling = false;
		}
	}

	/**
	 * Navigate to a different variant (dir = -1 or +1).
	 * Switches the last assistant message in the conversation to the chosen
	 * variant — purely client-side; the DB still holds the latest reroll.
	 */
	function navigateVariant(slotKey: string, dir: -1 | 1) {
		const slot = variantSlots[slotKey];
		if (!slot) return;
		const newIdx = slot.idx + dir;
		if (newIdx < 0 || newIdx >= slot.variants.length) return;

		const chosen = slot.variants[newIdx];
		variantSlots = {
			...variantSlots,
			[slotKey]: { ...slot, idx: newIdx },
		};

		// Replace the last assistant message with the chosen variant
		const lastAiIdx = messages.findLastIndex(
			(m) => m.sender === "assistant",
		);
		if (lastAiIdx !== -1) {
			messages = messages.map((m, i) => (i === lastAiIdx ? chosen : m));
		}
	}

	/** Start inline editing a message */
	function startEdit(msg: ChatMessage) {
		editingMsgId = msg.id;
		editDraft = msg.text;
	}

	/** Cancel in-place edit */
	function cancelEdit() {
		editingMsgId = null;
		editDraft = "";
	}

	/** Save the edited message content via PATCH */
	async function saveEdit(msgId: string) {
		if (!editDraft.trim()) return;
		try {
			const res = await fetch(
				`/api/sessions/${sessionId}/messages/${msgId}`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${accessToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ content: editDraft.trim() }),
				},
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				showToast("Edit Failed", json.error ?? "Could not save edit");
				return;
			}
			// Update local state
			messages = messages.map((m) =>
				m.id === msgId ? { ...m, text: editDraft.trim() } : m,
			);
			cancelEdit();
		} catch (err) {
			showToast(
				"Edit Failed",
				err instanceof Error ? err.message : "Network error",
			);
		}
	}

	/**
	 * Delete a message and all messages that came after it via DELETE.
	 * Asks for confirmation first.
	 */
	async function deleteFromMessage(msgId: string) {
		if (!confirm("Delete this message and all messages below it?")) return;
		try {
			const res = await fetch(
				`/api/sessions/${sessionId}/messages/${msgId}`,
				{
					method: "DELETE",
					headers: { Authorization: `Bearer ${accessToken}` },
				},
			);
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				showToast(
					"Delete Failed",
					json.error ?? "Could not delete messages",
				);
				return;
			}
			// Remove the deleted message and everything after it
			const idx = messages.findIndex((m) => m.id === msgId);
			if (idx !== -1) messages = messages.slice(0, idx);
			lastSendFailed = false;
		} catch (err) {
			showToast(
				"Delete Failed",
				err instanceof Error ? err.message : "Network error",
			);
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

	// ─── Markdown renderer ────────────────────────────────────────────────────

	/**
	 * Minimal but safe inline markdown → HTML converter.
	 * Handles: headings, bold, italic, inline-code, images, links, blockquotes,
	 * horizontal rules, and paragraph/line-break formatting.
	 * Uses {@html} — only call with content from a trusted source (our DB).
	 */
	function md(raw: string): string {
		let t = raw
			// Escape angle brackets first to prevent raw HTML injection
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");

		// Images: ![alt](url) – rendered before links to avoid mis-matching
		t = t.replace(
			/!\[([^\]]*)\]\(([^)]+)\)/g,
			'<img alt="$1" src="$2" class="md-img" loading="lazy" />',
		);

		// Links: [text](url)
		t = t.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" class="md-link" target="_blank" rel="noopener noreferrer">$1</a>',
		);

		// Headings (must run before bold/italic to avoid collision with ##)
		t = t.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
		t = t.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
		t = t.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

		// Horizontal rule: --- or ***
		t = t.replace(/^[-*]{3,}$/gm, '<hr class="md-hr" />');

		// Blockquote: > …
		t = t.replace(
			/^&gt; (.+)$/gm,
			'<blockquote class="md-blockquote">$1</blockquote>',
		);

		// Bold: **text** or __text__
		t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
		t = t.replace(/__(.+?)__/g, "<strong>$1</strong>");

		// Italic: *text* or _text_
		t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
		t = t.replace(/_(.+?)_/g, "<em>$1</em>");

		// Inline code: `code`
		t = t.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

		// Paragraphs: double newline → new paragraph
		t = t
			.split(/\n{2,}/)
			.map((para) => {
				const trimmed = para.trim();
				if (!trimmed) return "";
				// Don't wrap block-level elements in <p>
				if (/^<(h[1-3]|blockquote|hr|img)/.test(trimmed))
					return trimmed;
				return `<p class="md-p">${trimmed.replace(/\n/g, "<br/>")}</p>`;
			})
			.filter(Boolean)
			.join("\n");

		return t;
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
			<!-- Font settings toggle -->
			<button
				class={`p-2 transition-colors hover:text-primary ${showFontPanel ? "text-primary" : "text-slate-400"}`}
				type="button"
				aria-label="Font settings"
				title="Reading font & size"
				onclick={() => (showFontPanel = !showFontPanel)}
			>
				<span class="material-symbols-outlined">text_fields</span>
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

	<!-- Font settings panel (slides in below header) -->
	{#if showFontPanel}
		<div
			class="glass-panel flex flex-wrap items-start gap-6 border-b border-primary/10 px-6 py-4"
		>
			<!-- Font family -->
			<div class="flex flex-col gap-1.5">
				<p
					class="text-[10px] font-bold uppercase tracking-widest text-slate-500"
				>
					Font Family
				</p>
				<div class="flex flex-wrap gap-1.5">
					{#each Object.entries(FONT_FAMILIES) as [val, label]}
						<button
							type="button"
							class={`rounded-lg border px-3 py-1.5 text-xs transition-all ${fontFamily === val ? "border-primary bg-primary/20 font-bold text-primary" : "border-slate-700 text-slate-400 hover:border-primary/50 hover:text-slate-200"}`}
							style={`font-family: ${val === "inherit" ? "inherit" : val}`}
							onclick={() => setFontFamily(val)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Font size -->
			<div class="flex flex-col gap-1.5">
				<p
					class="text-[10px] font-bold uppercase tracking-widest text-slate-500"
				>
					Font Size
				</p>
				<div class="flex gap-1.5">
					{#each Object.entries(FONT_SIZES) as [val, label]}
						<button
							type="button"
							class={`rounded-lg border px-3 py-1.5 transition-all ${fontSize === val ? "border-primary bg-primary/20 font-bold text-primary" : "border-slate-700 text-slate-400 hover:border-primary/50 hover:text-slate-200"}`}
							style={`font-size: ${val}`}
							onclick={() => setFontSize(val)}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	<!-- Message list -->
	<div
		bind:this={messagesEl}
		class="custom-scrollbar min-h-0 flex-1 space-y-8 overflow-y-auto scroll-smooth p-8"
		style={`font-family: ${fontFamily}; font-size: ${fontSize};`}
	>
		<!-- Loading state — skeleton message bubbles instead of a plain spinner -->
		{#if isLoading}
			<div
				class="flex flex-col gap-8"
				aria-label="Loading messages…"
				role="status"
			>
				<!-- skeleton: AI message -->
				<div class="flex max-w-xl gap-4">
					<div
						class="skeleton mt-2 size-8 shrink-0 rounded-full"
					></div>
					<div class="flex flex-col gap-2 flex-1">
						<div class="skeleton h-4 w-3/4 rounded-lg"></div>
						<div class="skeleton h-4 w-full rounded-lg"></div>
						<div class="skeleton h-4 w-5/6 rounded-lg"></div>
					</div>
				</div>
				<!-- skeleton: user message (right-aligned) -->
				<div class="ml-auto flex max-w-xs flex-row-reverse gap-4">
					<div
						class="skeleton mt-2 size-8 shrink-0 rounded-full"
					></div>
					<div class="flex flex-col items-end gap-2 flex-1">
						<div class="skeleton h-4 w-3/4 rounded-lg"></div>
						<div class="skeleton h-4 w-full rounded-lg"></div>
					</div>
				</div>
				<!-- skeleton: AI message -->
				<div class="flex max-w-2xl gap-4">
					<div
						class="skeleton mt-2 size-8 shrink-0 rounded-full"
					></div>
					<div class="flex flex-col gap-2 flex-1">
						<div class="skeleton h-4 w-full rounded-lg"></div>
						<div class="skeleton h-4 w-4/5 rounded-lg"></div>
						<div class="skeleton h-4 w-full rounded-lg"></div>
						<div class="skeleton h-4 w-2/3 rounded-lg"></div>
					</div>
				</div>
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
					<div class="group/msg flex max-w-2xl gap-4">
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
							{#if editingMsgId === message.id}
								<!-- Inline editor for AI message -->
								<div class="flex flex-col gap-2">
									<textarea
										class="w-full rounded-xl border border-primary/40 bg-primary/10 p-3 text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
										rows="4"
										bind:value={editDraft}
									></textarea>
									<div class="flex gap-2">
										<button
											class="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/80"
											type="button"
											onclick={() => saveEdit(message.id)}
										>
											Save
										</button>
										<button
											class="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-400"
											type="button"
											onclick={cancelEdit}
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<div
									class="glass-panel relative rounded-bl-xl rounded-br-xl rounded-tr-xl border-l-4 border-l-primary p-5"
								>
									<div
										class="absolute -left-2 top-3 h-0 w-0 border-b-8 border-r-8 border-t-8 border-b-transparent border-r-primary/40 border-t-transparent"
									></div>
									<div
										class="md-body leading-relaxed text-slate-200"
									>
										{@html md(message.text)}
									</div>
								</div>
								<!-- Action row under assistant message (visible on hover) -->
								<div
									class="flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100"
								>
									{#if message.meta}
										<span
											class="flex-1 px-1 text-[10px] italic text-slate-500"
											>{message.meta}</span
										>
									{/if}
									<button
										class="rounded p-1 text-slate-500 transition-colors hover:text-primary"
										type="button"
										title="Edit reply"
										onclick={() => startEdit(message)}
									>
										<span
											class="material-symbols-outlined text-base leading-none"
											>edit</span
										>
									</button>
									<button
										class="rounded p-1 text-slate-500 transition-colors hover:text-red-400"
										type="button"
										title="Delete from here"
										onclick={() =>
											deleteFromMessage(message.id)}
									>
										<span
											class="material-symbols-outlined text-base leading-none"
											>delete</span
										>
									</button>
									{#if message.id === lastMessageId && hasUserMessage}
										{@const slot =
											variantSlots[lastReplySlotKey]}
										{#if slot && slot.variants.length > 1}
											<!-- Variant navigator: ← 1/N → -->
											<div
												class="flex items-center rounded-lg border border-primary/20 bg-primary/5"
											>
												<button
													type="button"
													class="px-1 py-1 text-slate-400 transition-colors hover:text-primary disabled:opacity-30"
													disabled={slot.idx === 0}
													title="Previous version"
													onclick={() =>
														navigateVariant(
															lastReplySlotKey,
															-1,
														)}
												>
													<span
														class="material-symbols-outlined text-sm leading-none"
														>chevron_left</span
													>
												</button>
												<span
													class="min-w-[2.5rem] text-center text-[10px] text-slate-400"
												>
													{slot.idx + 1}/{slot
														.variants.length}
												</span>
												<button
													type="button"
													class="px-1 py-1 text-slate-400 transition-colors hover:text-primary disabled:opacity-30"
													disabled={slot.idx ===
														slot.variants.length -
															1}
													title="Next version"
													onclick={() =>
														navigateVariant(
															lastReplySlotKey,
															1,
														)}
												>
													<span
														class="material-symbols-outlined text-sm leading-none"
														>chevron_right</span
													>
												</button>
											</div>
										{/if}
										<button
											class="flex items-center gap-1 rounded-lg border border-primary/30 px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
											type="button"
											title="Reroll this reply"
											disabled={isRerolling || isReplying}
											onclick={rerollLastMessage}
										>
											<span
												class="material-symbols-outlined text-sm leading-none"
												class:animate-spin={isRerolling}
												>casino</span
											>
											{isRerolling
												? "Rolling…"
												: "Reroll"}
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<!-- ── User message (right-aligned) ── -->
					<div
						class="group/msg ml-auto flex max-w-2xl flex-row-reverse gap-4"
					>
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
							{#if editingMsgId === message.id}
								<!-- Inline editor for user message -->
								<div class="flex w-full flex-col gap-2">
									<textarea
										class="w-full rounded-xl border border-primary/40 bg-primary/10 p-3 text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
										rows="3"
										bind:value={editDraft}
									></textarea>
									<div class="flex justify-end gap-2">
										<button
											class="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/80"
											type="button"
											onclick={() => saveEdit(message.id)}
										>
											Save
										</button>
										<button
											class="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-400"
											type="button"
											onclick={cancelEdit}
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<div
									class="relative rounded-bl-xl rounded-br-xl rounded-tl-xl bg-primary p-5 text-white shadow-lg"
								>
									<div
										class="absolute -right-2 top-3 h-0 w-0 border-b-8 border-l-8 border-t-8 border-b-transparent border-l-primary border-t-transparent"
									></div>
									<div class="md-body leading-relaxed">
										{@html md(message.text)}
									</div>
								</div>
								<!-- Action row under user message (visible on hover) -->
								<div
									class="flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100"
								>
									{#if message.meta}
										<span
											class="px-1 text-[10px] italic text-slate-500"
											>{message.meta}</span
										>
									{/if}
									{#if message.id === lastMessageId && lastSendFailed}
										<button
											class="flex items-center gap-1 rounded-lg border border-amber-500/40 px-2 py-1 text-xs text-amber-400 transition-colors hover:bg-amber-500/10 disabled:opacity-40"
											type="button"
											title="Retry — attempt AI reply again"
											disabled={isRerolling || isReplying}
											onclick={rerollLastMessage}
										>
											<span
												class="material-symbols-outlined text-sm leading-none"
												class:animate-spin={isRerolling}
												>refresh</span
											>
											{isRerolling
												? "Retrying…"
												: "Retry"}
										</button>
									{/if}
									<button
										class="rounded p-1 text-slate-500 transition-colors hover:text-primary"
										type="button"
										title="Edit message"
										onclick={() => startEdit(message)}
									>
										<span
											class="material-symbols-outlined text-base leading-none"
											>edit</span
										>
									</button>
									<button
										class="rounded p-1 text-slate-500 transition-colors hover:text-red-400"
										type="button"
										title="Delete from here"
										onclick={() =>
											deleteFromMessage(message.id)}
									>
										<span
											class="material-symbols-outlined text-base leading-none"
											>delete</span
										>
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/if}
			{/each}
		{/if}

		<!-- Retry banner: shown below messages when last send failed and not already editing -->
		{#if lastSendFailed && !isReplying && messages.length > 0}
			<div class="flex justify-center">
				<button
					class="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-40"
					type="button"
					disabled={isRerolling}
					onclick={rerollLastMessage}
				>
					<span
						class="material-symbols-outlined text-base"
						class:animate-spin={isRerolling}>refresh</span
					>
					{isRerolling ? "Retrying…" : "Retry AI Response"}
				</button>
			</div>
		{/if}

		<!-- Typing indicator (shown while waiting for the AI reply) -->
		{#if isReplying || isRerolling}
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
					class="glass-panel flex items-center gap-1 rounded-bl-xl rounded-br-xl rounded-tr-xl border-l-4 border-l-primary px-5 py-4"
					aria-label="AI is typing"
					role="status"
				>
					<!-- Bouncing dots -->
					<span class="typing-dot"></span>
					<span class="typing-dot" style="animation-delay: 0.2s"
					></span>
					<span class="typing-dot" style="animation-delay: 0.4s"
					></span>
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

	/* ── Skeleton loader ────────────────────────────────────────────────── */
	.skeleton {
		background: linear-gradient(
			90deg,
			rgb(115 17 212 / 8%) 25%,
			rgb(115 17 212 / 18%) 50%,
			rgb(115 17 212 / 8%) 75%
		);
		background-size: 200% 100%;
		animation: skeleton-shimmer 1.6s ease-in-out infinite;
	}

	@keyframes skeleton-shimmer {
		0% {
			background-position: 200% 0;
		}

		100% {
			background-position: -200% 0;
		}
	}

	/* ── Markdown body styles (applied to .md-body wrapper) ─────────────── */
	:global(.md-body p.md-p) {
		margin-bottom: 0.5rem;
	}

	:global(.md-body p.md-p:last-child) {
		margin-bottom: 0;
	}

	:global(.md-body h1.md-h1) {
		font-size: 1.25rem;
		font-weight: 700;
		margin-top: 0.75rem;
		margin-bottom: 0.25rem;
	}

	:global(.md-body h2.md-h2) {
		font-size: 1.1rem;
		font-weight: 700;
		margin-top: 0.75rem;
		margin-bottom: 0.25rem;
	}

	:global(.md-body h3.md-h3) {
		font-size: 1rem;
		font-weight: 600;
		margin-top: 0.5rem;
		margin-bottom: 0.25rem;
	}

	:global(.md-body blockquote.md-blockquote) {
		border-left: 3px solid rgb(115 17 212 / 50%);
		padding-left: 0.75rem;
		margin: 0.5rem 0;
		font-style: italic;
		color: rgb(203 213 225 / 70%);
	}

	:global(.md-body hr.md-hr) {
		border: none;
		border-top: 1px solid rgb(115 17 212 / 25%);
		margin: 0.75rem 0;
	}

	:global(.md-body code.md-code) {
		background: rgb(0 0 0 / 35%);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-family: monospace;
		font-size: 0.85em;
	}

	:global(.md-body a.md-link) {
		color: rgb(167 139 250);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	:global(.md-body img.md-img) {
		max-width: 100%;
		border-radius: 8px;
		margin: 0.5rem 0;
		display: block;
	}

	/* ── Typing indicator dots ─────────────────────────────────────────── */
	.typing-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: rgb(115 17 212 / 70%);
		animation: typing-bounce 1.2s ease-in-out infinite;
	}

	@keyframes typing-bounce {
		0%,
		60%,
		100% {
			transform: translateY(0);
			opacity: 0.5;
		}

		30% {
			transform: translateY(-6px);
			opacity: 1;
		}
	}
</style>

<script>
	import { onDestroy } from 'svelte';
	import { store } from '../lib/store';

	const librarianAvatar =
		'https://lh3.googleusercontent.com/aida-public/AB6AXuAeU2KXL0RQMXMMR_MtNDh0qSh5Ebj1ENtUaFWUlRxOhFYbikmEQEHmkBUKA9l_PXvUp-Wv2cletbmBsnJUwCd_oAR3YD9s9GuOa1xfV2N5JZx2lY7GysL-EXep9j5dtu7AbM9dl1afLy6NVZ2f66L5Gslu8pdYx-JOu8gZ3rmLDaTzViwpicx4_FRnZKLaTFY6YtEN0tNoxiErlbiH85Esj-VpIKiHsDsunvt8Dgeq5BBWhLQ_UO9Beo6PQB5NVxLRUre_aHhxX8A';

	const userAvatarFallback =
		'/default_user_profile.png';

	let userAvatar =
		'https://lh3.googleusercontent.com/aida-public/AB6AXuAgyCB_mlBPGprofUWuGuO0YhbE0TKY5RUYNCYQnWxu1wmt-jH9hMCWqPgrVSrIZhbJZlvQvBe7wXhc6tObUX9rfdH-RIKZYVhk8nY4sallsM8iCi2okPRw5RKIXMRuCP9HFJqzHxnG3OEjPekaYyZX2P626OBzyQ9xNrwn6dTgG35m7RkXQWg0qjSJNyMPih9mUQYQodKTP0OoXOHapw_il6XmO4HTRglxjaXencEYGpYjwcegqNMbFIpVvqa_UFkjYBKqf_qpn7Q';

	const replies = [
		'The vellum remembers your words. I will mark this in the Seventh Ledger.',
		'An intriguing thread. Follow the moon sigil in the west wing to continue.',
		'The Archive accepts your query. A relevant scroll has begun to stir.',
		'Your path sharpens. Ask again, and I will reveal the next sealed clue.'
	];

	let nextId = 4;
	let draft = '';
	let isReplying = false;
	let messagesEl = null;

	let messages = [
		{
			id: 1,
			sender: 'librarian',
			text: 'The stars whisper of your arrival, Seeker. You tread upon floorboards that have not felt a heartbeat in centuries. What forbidden knowledge do you seek from the ancient shelves of this sanctum?',
			meta: 'The Librarian materialized at 10:42 PM'
		},
		{
			id: 2,
			sender: 'user',
			text: "I am looking for the Lost Cantos of the Silver Moon. It's said they were hidden here during the Great Eclipse. Can you guide me to the Restricted Archive?",
			meta: 'Delivered via spirit-link'
		},
		{
			id: 3,
			sender: 'librarian',
			text: 'Ah, the Cantos. A dangerous curiosity. The Restricted Archive is not a place for the faint of spirit. Do you possess the required seal to enter the Third Circle of the Archive?',
			quote:
				'"Light the three candles of discernment before you touch the velvet spine, for the moon\'s songs are etched in cold silver."'
		}
	];

	const toAvatarUrl = (url) => (url && url.trim() ? url.trim() : userAvatarFallback);
	const applyProfile = (profile) => {
		userAvatar = toAvatarUrl(profile?.avatar_url);
	};

	const unsubscribe = store.subscribe(() => {
		const state = store.getState();
		applyProfile(state.auth.profile);
	});

	applyProfile(store.getState().auth.profile);
	onDestroy(() => unsubscribe());

	function scrollToBottom(behavior = 'smooth') {
		if (!messagesEl) return;
		messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior });
	}

	async function sendMessage() {
		const text = draft.trim();
		if (!text || isReplying) return;

		messages = [
			...messages,
			{
				id: nextId++,
				sender: 'user',
				text,
				meta: 'Delivered via spirit-link'
			}
		];
		draft = '';

		await Promise.resolve();
		scrollToBottom();

		isReplying = true;
		setTimeout(async () => {
			const reply = replies[Math.floor(Math.random() * replies.length)];
			messages = [
				...messages,
				{
					id: nextId++,
					sender: 'librarian',
					text: reply
				}
			];
			isReplying = false;
			await Promise.resolve();
			scrollToBottom();
		}, 700);
	}

	function handleKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void sendMessage();
		}
	}

	function handleInput(event) {
		draft = event.currentTarget.value;
	}

	if (typeof window !== 'undefined') {
		requestAnimationFrame(() => {
			messagesEl = document.querySelector('[data-chat-messages]');
			scrollToBottom('auto');
		});
	}
</script>

<section class="parchment-bg relative flex min-h-0 flex-1 flex-col overflow-hidden">
	<div class="glass-panel flex items-center justify-between border-b border-primary/10 p-4">
		<div class="flex items-center gap-4">
			<div class="size-10 overflow-hidden rounded-full border border-primary">
				<img alt="Elder Librarian portrait" class="h-full w-full object-cover" src={librarianAvatar} />
			</div>
			<div>
				<h4 class="font-bold text-slate-100">The Elder Librarian</h4>
				<p class="flex items-center gap-1 text-xs text-primary">
					<span class="material-symbols-outlined animate-pulse text-[10px]">magic_button</span>
					Ancient Knowledge Spirit
				</p>
			</div>
		</div>
		<div class="flex items-center gap-3">
			<button class="p-2 text-slate-400 transition-colors hover:text-primary"
				><span class="material-symbols-outlined">history_edu</span></button
			>
			<button class="p-2 text-slate-400 transition-colors hover:text-primary"
				><span class="material-symbols-outlined">settings</span></button
			>
		</div>
	</div>

	<div data-chat-messages class="custom-scrollbar min-h-0 flex-1 space-y-8 overflow-y-auto scroll-smooth p-8">
		{#each messages as message (message.id)}
			{#if message.sender === 'librarian'}
				<div class="flex max-w-2xl gap-4">
					<div class="mt-2 size-8 shrink-0 overflow-hidden rounded-full border border-primary">
						<img alt="Elder Librarian small icon" class="h-full w-full object-cover" src={librarianAvatar} />
					</div>
					<div class="flex flex-col gap-2">
						<div class="glass-panel relative rounded-bl-xl rounded-br-xl rounded-tr-xl border-l-4 border-l-primary p-5">
							<div class="absolute -left-2 top-3 h-0 w-0 border-b-8 border-r-8 border-t-8 border-b-transparent border-r-primary/40 border-t-transparent"></div>
							<p class="leading-relaxed text-slate-200">{message.text}</p>
							{#if message.quote}
								<div class="mt-3 rounded-lg border border-primary/20 bg-black/20 p-4 text-sm italic text-primary/80">
									{message.quote}
								</div>
							{/if}
						</div>
						{#if message.meta}
							<span class="px-1 text-[10px] italic text-slate-500">{message.meta}</span>
						{/if}
					</div>
				</div>
			{:else}
				<div class="ml-auto flex max-w-2xl flex-row-reverse gap-4">
					<div class="mt-2 size-8 shrink-0 overflow-hidden rounded-full border border-slate-700">
						<img alt="Seeker user profile image" class="h-full w-full object-cover" src={userAvatar} />
					</div>
					<div class="flex flex-col items-end gap-2">
						<div class="relative rounded-bl-xl rounded-br-xl rounded-tl-xl bg-primary p-5 text-white shadow-lg">
							<div class="absolute -right-2 top-3 h-0 w-0 border-b-8 border-l-8 border-t-8 border-b-transparent border-l-primary border-t-transparent"></div>
							<p class="leading-relaxed">{message.text}</p>
						</div>
						{#if message.meta}
							<span class="px-1 text-[10px] italic text-slate-500">{message.meta}</span>
						{/if}
					</div>
				</div>
			{/if}
		{/each}

		{#if isReplying}
			<div class="flex max-w-2xl gap-4">
				<div class="mt-2 size-8 shrink-0 overflow-hidden rounded-full border border-primary">
					<img alt="Elder Librarian small icon" class="h-full w-full object-cover" src={librarianAvatar} />
				</div>
				<div class="glass-panel rounded-bl-xl rounded-br-xl rounded-tr-xl border-l-4 border-l-primary px-4 py-3 text-sm text-primary/80">
					The Librarian is composing...
				</div>
			</div>
		{/if}
	</div>

	<div class="glass-panel relative border-t border-primary/10 p-6">
		<div class="mystical-glow group mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-primary/30 bg-background-dark/80 p-2 transition-all focus-within:border-primary">
			<button class="p-3 text-slate-500 transition-colors hover:text-primary">
				<span class="material-symbols-outlined">ink_pen</span>
			</button>
			<textarea
				class="scrollbar-hide flex-1 resize-none border-none bg-transparent py-3 font-display italic text-slate-100 placeholder:text-slate-600 focus:ring-0"
				on:input={handleInput}
				on:keydown={handleKeydown}
				placeholder="Whisper your request into the inkwell..."
				rows="1"
				value={draft}
			></textarea>
			<div class="flex gap-1 pb-1">
				<button class="p-2 text-slate-500 transition-colors hover:text-primary">
					<span class="material-symbols-outlined">auto_fix_normal</span>
				</button>
					<button class="flex size-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg transition-all hover:bg-primary/80 active:scale-95" on:click={sendMessage}>
					<span class="material-symbols-outlined">send</span>
				</button>
			</div>
		</div>
		<div class="pointer-events-none absolute -top-4 right-10 opacity-20">
			<span class="material-symbols-outlined animate-pulse text-6xl text-primary">ink_highlighter</span>
		</div>
	</div>
</section>

<style>
	.parchment-bg {
		background-color: #1a1625;
		background-image: radial-gradient(circle at 2px 2px, rgb(115 17 212 / 5%) 1px, transparent 0);
		background-size: 24px 24px;
	}

	.mystical-glow {
		box-shadow: 0 0 15px rgb(115 17 212 / 30%);
	}

	.glass-panel {
		background: rgb(48 40 57 / 40%);
		backdrop-filter: blur(8px);
		border: 1px solid rgb(115 17 212 / 20%);
	}

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

	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>

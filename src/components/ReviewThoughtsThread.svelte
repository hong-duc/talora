<script>
	import { tick } from 'svelte';

	let totalReflections = 128;
	let draft = '';
	let threadEl;

	let reflections = [
		{
			id: 1,
			icon: 'storm',
			author: 'Aethelgard',
			time: '3 lunar cycles ago',
			text: "The prose feels like silk between fingers. I haven't felt this connected to a world since the first Age of Whispers."
		},
		{
			id: 2,
			icon: 'nights_stay',
			author: 'Selene_Shadow',
			time: 'Yesterday',
			text: 'The twist at the Loom of Ages left me breathless. Elara Vox has truly outdone herself with the starlight descriptions.'
		}
	];

	async function submitReflection() {
		const text = draft.trim();
		if (!text) return;

		reflections = [
			...reflections,
			{
				id: Date.now(),
				icon: 'auto_awesome',
				author: 'Guest Scholar',
				time: 'Just now',
				text
			}
		];
		totalReflections += 1;
		draft = '';

		await tick();
		if (threadEl) {
			threadEl.scrollTo({
				top: threadEl.scrollHeight,
				behavior: 'smooth'
			});
		}
	}
</script>

<div class="mb-8 flex items-center justify-between">
	<h3 class="flex items-center gap-3 text-2xl font-bold text-slate-100">
		<span class="material-symbols-outlined text-primary">edit_note</span>
		Scroll of Thoughts
	</h3>
	<span class="text-sm font-bold uppercase tracking-wider text-primary">{totalReflections} Reflections</span>
</div>

<div bind:this={threadEl} class="custom-scrollbar max-h-[360px] space-y-6 overflow-y-auto pr-1">
	{#each reflections as reflection (reflection.id)}
		<div class="flex items-start gap-4 rounded-xl border border-primary/10 bg-slate-900/40 p-6">
			<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/20">
				<span class="material-symbols-outlined text-primary">{reflection.icon}</span>
			</div>
			<div class="flex-1">
				<div class="mb-2 flex items-center justify-between">
					<h4 class="font-bold text-slate-200">{reflection.author}</h4>
					<span class="text-xs font-medium text-slate-500">{reflection.time}</span>
				</div>
				<p class="italic leading-relaxed text-slate-400">"{reflection.text}"</p>
			</div>
		</div>
	{/each}
</div>

<div class="mt-8">
	<textarea
		bind:value={draft}
		class="w-full rounded-xl border border-primary/20 bg-primary/5 p-4 italic text-slate-100 placeholder:text-slate-600 focus:border-primary focus:ring-primary"
		placeholder="Add your whisper to the scroll..."
		rows="3"
	></textarea>
	<div class="mt-3 flex justify-end">
		<button
			class="rounded-lg border border-primary/40 bg-primary/20 px-6 py-2 font-bold text-primary transition-all hover:bg-primary/30"
			on:click={submitReflection}
			type="button"
		>
			Submit Reflection
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

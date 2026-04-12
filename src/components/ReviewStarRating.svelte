<script>
	export let initialRating = 4.8;

	const stars = [1, 2, 3, 4, 5];
	let rating = initialRating;
	let hoverRating = 0;

	$: activeRating = hoverRating || rating;
	$: ratingLabel = `${activeRating.toFixed(1)} stardust rating`;

	function starType(star, value) {
		if (value >= star) return 'full';
		if (value >= star - 0.5) return 'half';
		return 'empty';
	}

	function preview(event, star) {
		const rect = event.currentTarget.getBoundingClientRect();
		const isHalf = event.clientX - rect.left < rect.width / 2;
		hoverRating = star - (isHalf ? 0.5 : 0);
	}

	function commit(star) {
		rating = hoverRating || star;
		hoverRating = 0;
	}

	function clearPreview() {
		hoverRating = 0;
	}
</script>

<div class="flex items-center justify-center gap-2 md:justify-start" data-arcane-skip>
	<div class="flex text-primary" on:mouseleave={clearPreview}>
		{#each stars as star}
			{@const type = starType(star, activeRating)}
			<button
				aria-label={`Rate ${star} stars`}
				class="inline-flex items-center justify-center"
				on:click={() => commit(star)}
				on:mousemove={(event) => preview(event, star)}
				type="button"
			>
				<span class={`material-symbols-outlined star-icon select-none ${type}`}>
					{type === 'half' ? 'star_half' : 'star'}
				</span>
			</button>
		{/each}
	</div>
	<span class="font-medium text-slate-400">{ratingLabel}</span>
</div>

<style>
	.star-icon.full,
	.star-icon.half {
		color: #7311d4;
		font-variation-settings: "FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24;
	}

	.star-icon.empty {
		color: rgb(115 17 212 / 35%);
		font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24;
	}
</style>

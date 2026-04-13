<script lang="ts">
	/**
	 * ReviewStarRating — interactive half-star rating widget.
	 * Emits no events; rating state is local only (can be extended later).
	 * Migrated to Svelte 5 runes.
	 */

	let { initialRating = 4.8 } = $props<{ initialRating?: number }>();

	// All 5 star positions
	const stars = [1, 2, 3, 4, 5];

	// Reactive state
	let rating = $state(initialRating);
	let hoverRating = $state(0);

	// Derived: which rating to display (hover preview overrides committed rating)
	const activeRating = $derived(hoverRating || rating);
	const ratingLabel = $derived(`${activeRating.toFixed(1)} stardust rating`);

	/** Determine if a star should render as full, half, or empty */
	function starType(star: number, value: number): "full" | "half" | "empty" {
		if (value >= star) return "full";
		if (value >= star - 0.5) return "half";
		return "empty";
	}

	/** Update hover preview — supports half-star precision */
	function preview(event: MouseEvent, star: number) {
		const rect = (
			event.currentTarget as HTMLElement
		).getBoundingClientRect();
		const isHalf = event.clientX - rect.left < rect.width / 2;
		hoverRating = star - (isHalf ? 0.5 : 0);
	}

	/** Commit the rating on click */
	function commit(_star: number) {
		rating = hoverRating || _star;
		hoverRating = 0;
	}

	/** Clear hover preview when mouse leaves the star row */
	function clearPreview() {
		hoverRating = 0;
	}
</script>

<div
	class="flex items-center justify-center gap-2 md:justify-start"
	data-arcane-skip
>
	<div class="flex text-primary" onmouseleave={clearPreview}>
		{#each stars as star}
			{@const type = starType(star, activeRating)}
			<button
				aria-label={`Rate ${star} stars`}
				class="inline-flex items-center justify-center"
				onclick={() => commit(star)}
				onmousemove={(event) => preview(event, star)}
				type="button"
			>
				<span
					class={`material-symbols-outlined star-icon select-none ${type}`}
				>
					{type === "half" ? "star_half" : "star"}
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
		font-variation-settings:
			"FILL" 1,
			"wght" 500,
			"GRAD" 0,
			"opsz" 24;
	}

	.star-icon.empty {
		color: rgb(115 17 212 / 35%);
		font-variation-settings:
			"FILL" 0,
			"wght" 500,
			"GRAD" 0,
			"opsz" 24;
	}
</style>

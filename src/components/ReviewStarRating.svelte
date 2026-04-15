<script lang="ts">
	/**
	 * ReviewStarRating — interactive star rating widget backed by story_ratings.
	 * - Shows average rating (from the server).
	 * - Lets signed-in users submit/update their own rating (1–5 whole stars).
	 * - Each user can rate once; subsequent clicks update their existing rating.
	 * - Guests see the average but cannot submit.
	 *
	 * Svelte 5 runes. Warnings fixed:
	 *  - state_referenced_locally  → rating synced via $effect, not captured in $state(prop)
	 *  - a11y_no_static_element_interactions → role="group" added to the hover container
	 */

	import { supabase } from "../lib/supabase";

	let {
		storyId = "",
		initialRating = 0,
		initialRatingCount = 0,
	} = $props<{
		storyId?: string;
		initialRating?: number;
		initialRatingCount?: number;
	}>();

	const stars = [1, 2, 3, 4, 5];

	// ─── Reactive state ─────────────────────────────────────────────────────────
	// rating: the displayed average (starts from initialRating, updated after submit)
	let rating = $state(0);
	let totalRatings = $state(0);
	let hoverRating = $state(0);

	// User's own committed rating (0 = not yet rated)
	let userRating = $state(0);
	let hasRated = $state(false);

	// UI states
	let isSubmitting = $state(false);
	let statusMessage = $state<string | null>(null);
	let statusType = $state<"error" | "info" | "success">("info");

	// ─── Sync prop → state (fixes state_referenced_locally warning) ─────────────
	$effect(() => {
		rating = initialRating;
	});

	$effect(() => {
		totalRatings = initialRatingCount;
	});

	// ─── Load user's existing rating + latest aggregate on mount ────────────────
	$effect(() => {
		if (!storyId) return;

		// Fetch aggregate + user's own rating from the API
		// The API reads the Bearer token from the Authorization header automatically
		supabase.auth.getSession().then(({ data: { session } }) => {
			const headers: HeadersInit = { "Content-Type": "application/json" };
			if (session?.access_token) {
				headers["Authorization"] = `Bearer ${session.access_token}`;
			}

			fetch(`/api/stories/${storyId}/rate`, { headers })
				.then((r) => r.json())
				.then((data) => {
					if (typeof data.averageRating === "number") {
						rating = data.averageRating;
					}
					if (typeof data.totalRatings === "number") {
						totalRatings = data.totalRatings;
					}
					if (
						data.userRating !== null &&
						data.userRating !== undefined
					) {
						userRating = data.userRating;
						hasRated = true;
					}
				})
				.catch(() => {
					/* silently ignore, fall back to server-rendered values */
				});
		});
	});

	// ─── Derived display values ──────────────────────────────────────────────────
	const activeRating = $derived(hoverRating || rating);

	const ratingLabel = $derived(
		totalRatings > 0
			? `${activeRating.toFixed(1)} · ${totalRatings} ${totalRatings === 1 ? "rating" : "ratings"}`
			: "No ratings yet",
	);

	// ─── Star-type helper (full / half / empty) ──────────────────────────────────
	function starType(star: number, value: number): "full" | "half" | "empty" {
		if (value >= star) return "full";
		if (value >= star - 0.5) return "half";
		return "empty";
	}

	// ─── Hover preview (whole stars only — DB stores integers 1-5) ──────────────
	function preview(_event: MouseEvent, star: number) {
		// Only show hover preview if the story can be rated
		if (!storyId || hasRated) return;
		hoverRating = star;
	}

	function clearPreview() {
		hoverRating = 0;
	}

	// ─── Submit rating ───────────────────────────────────────────────────────────
	async function commit(star: number) {
		if (!storyId) return; // display-only mode (no storyId passed)

		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) {
			statusMessage = "Sign in to rate this story";
			statusType = "info";
			setTimeout(() => {
				statusMessage = null;
			}, 3000);
			return;
		}

		// Optimistic update
		const previousRating = rating;
		const previousCount = totalRatings;
		const wasRated = hasRated;

		rating = star;
		userRating = star;
		hasRated = true;
		hoverRating = 0;
		isSubmitting = true;
		statusMessage = null;

		try {
			const res = await fetch(`/api/stories/${storyId}/rate`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${session.access_token}`,
				},
				body: JSON.stringify({ rating: star }),
			});

			const data = await res.json();

			if (!res.ok) {
				// Revert optimistic update on failure
				rating = previousRating;
				totalRatings = previousCount;
				hasRated = wasRated;
				userRating = wasRated ? userRating : 0;
				statusMessage = data.error || "Failed to submit rating";
				statusType = "error";
				setTimeout(() => {
					statusMessage = null;
				}, 4000);
			} else {
				// Settle with server-computed values
				rating = data.averageRating;
				totalRatings = data.totalRatings;
				userRating = data.userRating;
				statusMessage = wasRated
					? "Rating updated!"
					: "Thanks for rating!";
				statusType = "success";
				setTimeout(() => {
					statusMessage = null;
				}, 3000);
			}
		} catch {
			// Network error — revert
			rating = previousRating;
			totalRatings = previousCount;
			hasRated = wasRated;
			userRating = wasRated ? userRating : 0;
			statusMessage = "Network error. Please try again.";
			statusType = "error";
			setTimeout(() => {
				statusMessage = null;
			}, 4000);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="flex flex-col gap-1" data-arcane-skip>
	<!-- Stars row -->
	<div class="flex items-center gap-2">
		<!--
			role="group" fixes the a11y_no_static_element_interactions warning:
			the div handles onmouseleave, so it needs an ARIA role to be
			meaningful to assistive technologies.
		-->
		<div
			class="flex text-primary"
			role="group"
			aria-label="Star rating"
			onmouseleave={clearPreview}
		>
			{#each stars as star}
				{@const type = starType(star, activeRating)}
				<button
					aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
					aria-pressed={userRating === star}
					class="inline-flex items-center justify-center transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
					disabled={isSubmitting}
					onclick={() => commit(star)}
					onmousemove={(e) => preview(e, star)}
					type="button"
				>
					<span
						class={`material-symbols-outlined star-icon select-none ${type} ${
							hasRated && userRating === star ? "user-rated" : ""
						}`}
					>
						{type === "half" ? "star_half" : "star"}
					</span>
				</button>
			{/each}
		</div>

		<!-- Rating label -->
		<span class="font-medium text-slate-400 tabular-nums text-sm">
			{ratingLabel}
		</span>

		<!-- Spinner while submitting -->
		{#if isSubmitting}
			<span
				class="material-symbols-outlined animate-spin text-base text-primary"
				aria-label="Submitting rating">progress_activity</span
			>
		{/if}
	</div>

	<!-- Status message (success / error / info) -->
	{#if statusMessage}
		<p
			class="text-xs mt-0.5 {statusType === 'error'
				? 'text-red-400'
				: statusType === 'success'
					? 'text-green-400'
					: 'text-slate-400'}"
		>
			{statusMessage}
		</p>
	{/if}

	<!-- Hint when no storyId (display-only) or user has already rated -->
	{#if storyId && hasRated && !statusMessage}
		<p class="text-xs text-slate-500 mt-0.5">
			Your rating: {userRating} ★ · click to update
		</p>
	{/if}
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

	/* Highlight the star the user has personally committed */
	.star-icon.user-rated {
		color: #e9c349;
	}
</style>

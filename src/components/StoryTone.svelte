<script lang="ts">
    /**
     * StoryTone — multi-select tone picker for story creation.
     * Emits a "change" custom event with the selected tone array.
     */

    let {
        label = "Story Tone",
        name = "tone",
        initialTones = [],
    } = $props<{
        label?: string;
        name?: string;
        initialTones?: string[];
    }>();

    // bind:this sets this to the element on mount; undefined beforehand
    let rootelement: HTMLElement | undefined = $state(undefined);

    // Available tones with their CSS variable colour suffix
    interface Tone {
        name: string;
        colorClass: string;
    }

    const availableTones: Tone[] = [
        { name: "Cozy", colorClass: "cozy" },
        { name: "Mysterious", colorClass: "mysterious" },
        { name: "Epic", colorClass: "epic" },
        { name: "Dark", colorClass: "dark" },
        { name: "Romantic", colorClass: "romantic" },
        { name: "Humorous", colorClass: "humorous" },
        { name: "Slice-of-life", colorClass: "slice-of-life" },
        { name: "Martial arts", colorClass: "martial-arts" },
        { name: "Fantasy", colorClass: "fantasy" },
    ];

    // Selected tones — seeded from initialTones prop on first run
    let tones = $state<string[]>([]);

    // Seed from initialTones once on mount; also emit change whenever tones change
    $effect(() => {
        // Initialise from prop if nothing is selected yet
        if (initialTones.length > 0 && tones.length === 0) {
            tones = [...initialTones];
        }

        // Emit the current selection to the parent (works for both init and updates)
        if (rootelement) {
            rootelement.dispatchEvent(
                new CustomEvent("change", {
                    detail: $state.snapshot(tones),
                    bubbles: true,
                    composed: true,
                }),
            );
        }
    });

    /** Returns true when the given tone name is currently selected */
    const isSelected = (toneName: string) => tones.includes(toneName);

    /** Toggle a tone on/off in the selection */
    const toggleTone = (toneName: string) => {
        tones = isSelected(toneName)
            ? tones.filter((t) => t !== toneName)
            : [...tones, toneName];
    };
</script>

<div class="flex flex-col gap-4" data-arcane-skip bind:this={rootelement}>
    <!-- Section label — decorative, not a form label since there's no single input -->
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <p
        id={name}
        class="block text-xs uppercase tracking-widest text-accent-gold mb-4 font-bold"
    >
        {label}
    </p>

    <!-- Tone toggle buttons -->
    <div class="flex flex-wrap gap-2" aria-labelledby={name}>
        {#each availableTones as tone (tone.name)}
            <button
                type="button"
                class={`px-4 py-2 rounded-lg border text-xs transition-all ${
                    isSelected(tone.name)
                        ? "font-bold"
                        : "bg-surface-container border-purple-900/30 text-slate-400"
                }`}
                data-tone={tone.name.toLowerCase()}
                onclick={() => toggleTone(tone.name)}
                aria-pressed={isSelected(tone.name)}
                style={isSelected(tone.name)
                    ? `background-color: color-mix(in srgb, var(--color-${tone.colorClass}) 20%, transparent);
                       border-color: var(--color-${tone.colorClass});
                       color: var(--color-${tone.colorClass});`
                    : ""}
            >
                {tone.name}
            </button>
        {/each}
    </div>

    <p class="text-xs text-slate-500 italic mt-2">
        Select the emotional hues that color your narrative tapestry.
    </p>
</div>

<style>
    button {
        transition: all 0.2s ease;
    }

    button:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    /* Selected button gets elevated shadow */
    button[aria-pressed="true"] {
        box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
        transform: translateY(-2px);
    }
</style>

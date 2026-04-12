<script lang="ts">
    // Props with Svelte 5 syntax
    let {
        label = "Story Tone",
        name = "tone",
        initialTones = [],
    } = $props<{
        label?: string;
        name?: string;
        initialTones?: string[];
    }>();

    let rootelement: HTMLElement;

    // Tone object interface
    interface Tone {
        name: string;
        colorClass: string;
    }

    // Hardcoded tone list with colors
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

    // Selected tones state
    let tones = $state<string[]>([]);

    $effect(() => {
        emitChange()
    })

    // Initialize with initialTones
    $effect(() => {
        if (initialTones.length > 0 && tones.length === 0) {
            tones = [...initialTones];
        }
    });

    // Check if a tone is selected
    const isSelected = (toneName: string) => tones.includes(toneName);

    

    // Emit change event
    const emitChange = () => {
        if (rootelement) {
            const data = $state.snapshot(tones)

            rootelement.dispatchEvent(
                new CustomEvent("change", {
                    detail: data,
                    bubbles: true,
                    composed: true,
                })
            );
        }
    };

    // Toggle tone selection
    const toggleTone = (toneName: string) => {
        if (isSelected(toneName)) {
            // Remove tone
            tones = tones.filter(t => t !== toneName);
        } else {
            // Add tone
            tones = [...tones, toneName];
        }
        
    };

    // Handle button click
    const handleClick = (toneName: string) => {
        toggleTone(toneName);
    };

    // Emit initial state
    $effect(() => {
        if (initialTones.length > 0 && tones.length === 0) {
            tones = [...initialTones];
        }
    });
</script>

<div class="flex flex-col gap-4" data-arcane-skip bind:this={rootelement}>
    <!-- Label -->
    <label
    for={name}
        class="block text-xs uppercase tracking-widest text-accent-gold mb-4 font-bold"
    >
        {label}
    </label>

    <!-- Tone Buttons Grid -->
    <div class="flex flex-wrap gap-2" id="tone-selection">
        {#each availableTones as tone (tone.name)}
            <button
                type="button"
                class={`px-4 py-2 rounded-lg border text-xs transition-all ${isSelected(tone.name)
                    ? 'font-bold'
                    : 'bg-surface-container border-purple-900/30 text-slate-400'
                }`}
                data-tone={tone.name.toLowerCase()}
                onclick={() => handleClick(tone.name)}
                aria-pressed={isSelected(tone.name)}
                style={isSelected(tone.name) ? `
                    background-color: color-mix(in srgb, var(--color-${tone.colorClass}) 20%, transparent);
                    border-color: var(--color-${tone.colorClass});
                    color: var(--color-${tone.colorClass});
                ` : ''}
            >
                {tone.name}
            </button>
        {/each}
    </div>

    <!-- Description (optional) -->
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

    /* Selected button elevation effect */
    button[aria-pressed="true"] {
        box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
        transform: translateY(-2px);
    }
</style>

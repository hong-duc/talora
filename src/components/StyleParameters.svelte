<script lang="ts">
    import { untrack } from "svelte";
    // Props with Svelte 5 syntax
    // Accepts a single initialStyle object instead of 5 separate props — cleaner API
    let {
        label = "Style Parameters",
        namePrefix = "style",
        initialStyle = {
            descriptiveness: 3,
            dialogueRatio: 3,
            pacing: "medium" as "slow" | "medium" | "fast",
            emotionalIntensity: 3,
            autoStyle: true,
        },
    } = $props<{
        label?: string;
        namePrefix?: string;
        initialStyle?: {
            descriptiveness: number;
            dialogueRatio: number;
            pacing: "slow" | "medium" | "fast";
            emotionalIntensity: number;
            autoStyle: boolean;
        };
    }>();

    let rootelement: HTMLElement;

    // Single grouped state object — all style params live together
    // untrack: we intentionally want only the initial value, not a reactive derived
    let style = $state(
        untrack(() => ({
            descriptiveness: initialStyle.descriptiveness,
            dialogueRatio: initialStyle.dialogueRatio,
            pacing: initialStyle.pacing,
            emotionalIntensity: initialStyle.emotionalIntensity,
            autoStyle: initialStyle.autoStyle,
        })),
    );

    // Clamped updaters keep values within 1–5 range
    const updateDescriptiveness = (value: number) => {
        style.descriptiveness = Math.max(1, Math.min(5, value));
    };

    const updateDialogueRatio = (value: number) => {
        style.dialogueRatio = Math.max(1, Math.min(5, value));
    };

    const updateEmotionalIntensity = (value: number) => {
        style.emotionalIntensity = Math.max(1, Math.min(5, value));
    };

    // Human-readable labels for slider values
    const getLabelForValue = (
        value: number,
        type: "descriptiveness" | "dialogue" | "intensity",
    ) => {
        const labels = {
            descriptiveness: [
                "minimal",
                "moderate",
                "vivid",
                "rich",
                "extravagant",
            ],
            dialogue: [
                "narration",
                "balanced",
                "mixed",
                "dialogic",
                "dialogue",
            ],
            intensity: [
                "subtle",
                "moderate",
                "balanced",
                "intense",
                "overwhelming",
            ],
        };
        return labels[type][value - 1] || "";
    };

    // Emit the entire style object whenever any property changes
    $effect(() => {
        rootelement?.dispatchEvent(
            new CustomEvent("change", {
                detail: $state.snapshot(style),
                bubbles: true,
                composed: true,
            }),
        );
    });
</script>

<div
    class="flex flex-col gap-8"
    data-arcane-skip
    aria-disabled={style.autoStyle}
    bind:this={rootelement}
>
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label
        class="block text-xs uppercase tracking-widest text-secondary mb-2 font-bold"
    >
        {label}
    </label>

    <!-- Descriptiveness Slider -->
    <div>
        <div
            class="flex justify-between text-[10px] text-slate-400 uppercase tracking-tighter mb-2"
        >
            <span
                >Descriptiveness: {getLabelForValue(
                    style.descriptiveness,
                    "descriptiveness",
                )}</span
            >
            <span class="text-primary">{style.descriptiveness}/5</span>
        </div>
        <input
            class="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-primary"
            type="range"
            min="1"
            max="5"
            step="1"
            value={style.descriptiveness}
            oninput={(e) =>
                updateDescriptiveness(
                    parseInt((e.currentTarget as HTMLInputElement).value),
                )}
            name={`${namePrefix}-descriptiveness`}
            disabled={style.autoStyle}
        />
        <div class="flex justify-between text-[8px] text-slate-500 mt-1">
            <span>minimal</span>
            <span>vivid</span>
        </div>
    </div>

    <!-- Dialogue Ratio Slider -->
    <div>
        <div
            class="flex justify-between text-[10px] text-slate-400 uppercase tracking-tighter mb-2"
        >
            <span
                >Dialogue Ratio: {getLabelForValue(
                    style.dialogueRatio,
                    "dialogue",
                )}</span
            >
            <span class="text-primary">{style.dialogueRatio}/5</span>
        </div>
        <input
            class="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-primary"
            type="range"
            min="1"
            max="5"
            step="1"
            value={style.dialogueRatio}
            oninput={(e) =>
                updateDialogueRatio(
                    parseInt((e.currentTarget as HTMLInputElement).value),
                )}
            name={`${namePrefix}-dialogue-ratio`}
            disabled={style.autoStyle}
        />
        <div class="flex justify-between text-[8px] text-slate-500 mt-1">
            <span>narration</span>
            <span>dialogue</span>
        </div>
    </div>

    <!-- Narrative Pacing Radio Buttons -->
    <div>
        <span
            class="block text-[10px] text-slate-400 uppercase tracking-tighter mb-3"
            >Narrative Pacing</span
        >
        <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer group">
                <input
                    class="form-radio bg-transparent border-purple-700 text-primary focus:ring-offset-background"
                    type="radio"
                    name={`${namePrefix}-pacing`}
                    value="slow"
                    bind:group={style.pacing}
                    disabled={style.autoStyle}
                />
                <span
                    class="text-sm text-on-surface-variant group-hover:text-primary transition-colors"
                    >Slow</span
                >
            </label>
            <label class="flex items-center gap-2 cursor-pointer group">
                <input
                    class="form-radio bg-transparent border-purple-700 text-primary focus:ring-offset-background"
                    type="radio"
                    name={`${namePrefix}-pacing`}
                    value="medium"
                    bind:group={style.pacing}
                    disabled={style.autoStyle}
                />
                <span
                    class="text-sm text-on-surface-variant group-hover:text-primary transition-colors"
                    >Medium</span
                >
            </label>
            <label class="flex items-center gap-2 cursor-pointer group">
                <input
                    class="form-radio bg-transparent border-purple-700 text-primary focus:ring-offset-background"
                    type="radio"
                    name={`${namePrefix}-pacing`}
                    value="fast"
                    bind:group={style.pacing}
                    disabled={style.autoStyle}
                />
                <span
                    class="text-sm text-on-surface-variant group-hover:text-primary transition-colors"
                    >Fast</span
                >
            </label>
        </div>
    </div>

    <!-- Emotional Intensity Slider -->
    <div>
        <div
            class="flex justify-between text-[10px] text-slate-400 uppercase tracking-tighter mb-2"
        >
            <span
                >Emotional Intensity: {getLabelForValue(
                    style.emotionalIntensity,
                    "intensity",
                )}</span
            >
            <span class="text-primary">{style.emotionalIntensity}/5</span>
        </div>
        <input
            class="w-full h-1 bg-purple-950 rounded-lg appearance-none cursor-pointer accent-primary"
            type="range"
            min="1"
            max="5"
            step="1"
            value={style.emotionalIntensity}
            oninput={(e) =>
                updateEmotionalIntensity(
                    parseInt((e.currentTarget as HTMLInputElement).value),
                )}
            name={`${namePrefix}-emotional-intensity`}
            disabled={style.autoStyle}
        />
        <div class="flex justify-between text-[8px] text-slate-500 mt-1">
            <span>subtle</span>
            <span>intense</span>
        </div>
    </div>

    <!-- Auto Style Toggle -->
    <div class="flex items-center gap-4">
        <label class="relative inline-flex items-center cursor-pointer">
            <input
                class="sr-only peer"
                type="checkbox"
                bind:checked={style.autoStyle}
                name={`${namePrefix}-auto-style`}
            />
            <div
                class="w-11 h-6 bg-purple-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"
            ></div>
            <span class="ms-3 text-sm font-serif text-slate-300"
                >Auto Style</span
            >
        </label>
        <p class="text-xs text-slate-500 italic max-w-xs">
            The Scribe will automatically polish your syntax and expand on
            mystical descriptions based on selected tone.
        </p>
    </div>
</div>

<style>
    input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        background: transparent;
        cursor: pointer;
    }

    input[type="range"]::-webkit-slider-track {
        background: rgba(115, 17, 212, 0.2);
        height: 4px;
        border-radius: 2px;
    }

    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #7311d4;
        border: 2px solid #d8b9ff;
        cursor: pointer;
        margin-top: -6px;
    }

    input[type="range"]::-moz-range-track {
        background: rgba(115, 17, 212, 0.2);
        height: 4px;
        border-radius: 2px;
    }

    input[type="range"]::-moz-range-thumb {
        height: 16px;
        width: 16px;
        border-radius: 50%;
        background: #7311d4;
        border: 2px solid #d8b9ff;
        cursor: pointer;
    }

    .form-radio {
        border-color: #7311d4;
    }

    .form-radio:checked {
        background-color: #7311d4;
        border-color: #7311d4;
    }

    /* Disabled state styles */
    input:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }

    input[type="range"]:disabled::-webkit-slider-track {
        background: rgba(115, 17, 212, 0.1);
    }

    input[type="range"]:disabled::-webkit-slider-thumb {
        background: #4a5568;
        border-color: #718096;
    }

    input[type="range"]:disabled::-moz-range-track {
        background: rgba(115, 17, 212, 0.1);
    }

    input[type="range"]:disabled::-moz-range-thumb {
        background: #4a5568;
        border-color: #718096;
    }

    .form-radio:disabled {
        border-color: #4a5568;
        opacity: 0.6;
    }

    .form-radio:disabled:checked {
        background-color: #4a5568;
        border-color: #4a5568;
    }
</style>

<script lang="ts">
    const {
        title,
        description,
        onClose = undefined,
    } = $props<{
        title: string;
        description: string;
        onClose?: (() => void) | undefined;
    }>();
</script>

<div class="relative w-full max-w-md">
    <!-- Glow effect -->
    <div
        class="absolute inset-0 bg-(--color-error-container)/20 blur-xl rounded-lg"
    ></div>

    <div
        class="relative bg-(--color-error-container) p-0.5 rounded-lg shadow-2xl overflow-hidden"
    >
        <!-- Muted Gold/Silver Border Texture -->
        <div
            class="absolute inset-0 opacity-10 pointer-events-none bg-linear-to-br from-slate-400 to-amber-200"
        ></div>

        <div
            class="relative bg-[#3b0d1e]/95 backdrop-blur-md px-6 py-5 rounded-[7px] border border-slate-500/40 flex items-start gap-5"
        >
            <!-- Icon container -->
            <div
                class="shrink-0 bg-(--color-error)/10 p-3 rounded-full border border-(--color-error)/50 shadow-[0_0_15px_rgba(255,180,171,0.2)]"
            >
                <span
                    class="material-symbols-outlined text-(--color-error) text-3xl icon-filled"
                >
                    error
                </span>
            </div>

            <!-- Text content -->
            <div class="flex flex-col flex-1">
                <h3
                    class="font-headline text-xl text-(--color-error) font-bold leading-tight"
                >
                    {title}
                </h3>
                <p
                    class="text-(--color-on-error-container)/90 text-lg italic leading-snug mt-1"
                >
                    {description}
                </p>
            </div>

            <!-- Close button -->
            <button
                class="absolute top-4 right-4 text-(--color-error)/40 hover:text-(--color-error) transition-colors"
                onclick={() => onClose?.()}
                aria-label="Close toast"
            >
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
    </div>
</div>

<style>
    /* Ensure font-family is correct */
    .font-headline {
        font-family: var(--font-display);
    }

    .icon-filled {
        font-variation-settings: "FILL" 1;
    }
</style>

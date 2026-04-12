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
    class="absolute inset-0 bg-(--color-primary-container)/20 blur-xl rounded-lg"
  ></div>

  <div
    class="relative bg-(--color-primary-container) p-0.5 rounded-lg shadow-2xl overflow-hidden"
  >
    <!-- Gold Patterned Border -->
    <div
      class="absolute inset-0 opacity-30 pointer-events-none gold-pattern"
    ></div>

    <div
      class="relative bg-[#2e005d]/95 backdrop-blur-md px-6 py-5 rounded-[7px] border border-accent-gold/40 flex items-start gap-5"
    >
      <!-- Icon container -->
      <div
        class="shrink-0 bg-accent-gold/20 p-3 rounded-full border border-accent-gold/50 shadow-[0_0_15px_rgba(212,175,55,0.3)]"
      >
        <span
          class="material-symbols-outlined text-accent-gold text-3xl icon-filled"
        >
          auto_awesome
        </span>
      </div>

      <!-- Text content -->
      <div class="flex flex-col flex-1">
        <h3
          class="font-headline text-xl text-accent-gold font-bold leading-tight"
        >
          {title}
        </h3>
        <p
          class="text-on-primary-container/90 text-lg italic leading-snug mt-1"
        >
          {description}
        </p>
      </div>

      <!-- Close button -->
      <button
        class="absolute top-4 right-4 text-accent-gold/40 hover:text-accent-gold transition-colors"
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

  .gold-pattern {
    background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18l2.5-1M20 20.5V23l-2.5 1M20 20.5l2.5 1V18l-2.5-1M20 20.5l-2.5-1v2.5l2.5 1' stroke='%23d4af37' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
  }

  .icon-filled {
    font-variation-settings: "FILL" 1;
  }
</style>

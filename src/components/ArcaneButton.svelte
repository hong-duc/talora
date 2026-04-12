<script lang="ts">
  export let href: string | undefined = undefined;
  export let type: "button" | "submit" | "reset" = "button";
  export let icon: string | undefined = undefined;
  export let className = "";
</script>

{#if href}
  <a
    href={href}
    class={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-accent-gold/40 bg-primary px-6 py-3 font-bold text-white shadow-[0_16px_32px_rgba(115,17,212,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(115,17,212,0.55)] active:translate-y-1 active:scale-[0.98] active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.35),0_10px_18px_rgba(115,17,212,0.45)] ${className}`}
  >
    <span class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.55),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-active:opacity-100"></span>
    <span class="absolute -left-1/3 top-0 h-full w-1/2 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.55),transparent)] opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-50"></span>
    <span class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-accent-gold/20 opacity-0 transition duration-200 group-hover:opacity-100 group-active:opacity-100 group-active:ring-accent-gold/70"></span>
    <span class="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-gold/50 opacity-0 blur-lg group-active:opacity-100 group-active:animate-[ping_0.6s_ease-out_1]"></span>
    <span class="relative z-10 flex items-center gap-2">
      {#if icon}
        <span class="material-symbols-outlined transition-transform duration-300 group-active:rotate-12 group-active:scale-125">{icon}</span>
      {/if}
      <slot />
    </span>
  </a>
{:else}
  <button
    type={type}
    class={`group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-xl border border-accent-gold/40 bg-primary px-6 py-3 font-bold text-white shadow-[0_16px_32px_rgba(115,17,212,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(115,17,212,0.55)] active:translate-y-1 active:scale-[0.98] active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.35),0_10px_18px_rgba(115,17,212,0.45)] ${className}`}
  >
    <span class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.55),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-active:opacity-100"></span>
    <span class="absolute -left-1/3 top-0 h-full w-1/2 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.55),transparent)] opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-50"></span>
    <span class="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-accent-gold/20 opacity-0 transition duration-200 group-hover:opacity-100 group-active:opacity-100 group-active:ring-accent-gold/70"></span>
    <span class="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-gold/50 opacity-0 blur-lg group-active:opacity-100 group-active:animate-[ping_0.6s_ease-out_1]"></span>
    <span class="relative z-10 flex items-center gap-2">
      {#if icon}
        <span class="material-symbols-outlined transition-transform duration-300 group-active:rotate-12 group-active:scale-125">{icon}</span>
      {/if}
      <slot />
    </span>
  </button>
{/if}

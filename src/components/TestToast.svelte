<script lang="ts">
  import { Toaster, toast } from "svelte-sonner";
  import SuccessToast from "./toast/success.svelte";
  import ErrorToast from "./toast/error.svelte";

  // Success toast functions
  const showSuccessToast = () => {
    toast.custom(SuccessToast, {
      componentProps: {
        title: "Scroll Archived",
        description: "Success: Your scroll has been safely archived.",
        onClose: () => toast.dismiss(),
      },
      duration: 5000,
    });
  };

  const showCustomSuccessToast = () => {
    toast.custom(SuccessToast, {
      componentProps: {
        title: "Custom Success",
        description: "This is a custom success message with different content.",
        onClose: () => toast.dismiss(),
      },
      duration: 5000,
    });
  };

  // Error toast functions
  const showErrorToast = () => {
    toast.custom(ErrorToast, {
      componentProps: {
        title: "Reality Fractured",
        description:
          "Error: A rift has formed in the archive. Please try again.",
        onClose: () => toast.dismiss(),
      },
      duration: 5000,
    });
  };

  const showCustomErrorToast = () => {
    toast.custom(ErrorToast, {
      componentProps: {
        title: "Custom Error",
        description: "This is a custom error message with different content.",
        onClose: () => toast.dismiss(),
      },
      duration: 5000,
    });
  };

  // Dismiss all toasts
  const dismissAllToasts = () => {
    toast.dismiss();
  };

  // Show multiple success toasts
  const showMultipleSuccessToasts = () => {
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        toast.custom(SuccessToast, {
          componentProps: {
            title: `Success Toast ${i}`,
            description: `This is success toast number ${i}`,
            onClose: () => toast.dismiss(),
          },
          duration: 5000,
        });
      }, i * 300);
    }
  };

  // Show multiple error toasts
  const showMultipleErrorToasts = () => {
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        toast.custom(ErrorToast, {
          componentProps: {
            title: `Error Toast ${i}`,
            description: `This is error toast number ${i}`,
            onClose: () => toast.dismiss(),
          },
          duration: 5000,
        });
      }, i * 300);
    }
  };
</script>

<Toaster />
<div class="space-y-12">
  <!-- Success Toast Test Section -->
  <section
    class="rounded-2xl border border-primary/20 bg-linear-to-br from-slate-900/50 to-slate-900/30 p-6 shadow-xl"
  >
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="font-display text-3xl font-bold text-slate-100">
          Success Toast - Interactive
        </h2>
        <p class="mt-2 text-slate-400">
          Purple and gold design with "auto_awesome" icon
        </p>
      </div>
      <div
        class="rounded-lg bg-accent-gold/20 px-3 py-1 text-sm font-medium text-accent-gold"
      >
        Gold Accent
      </div>
    </div>

    <div class="grid gap-8 md:grid-cols-2">
      <!-- Controls -->
      <div class="space-y-6">
        <h3 class="text-xl font-semibold text-slate-300">Interactive Test</h3>
        <div class="space-y-4">
          <button
            on:click={showSuccessToast}
            class="w-full rounded-lg bg-(--color-primary-container) px-6 py-4 text-lg font-medium text-white hover:bg-(--color-primary-container)/90 transition-colors flex items-center justify-center gap-3"
          >
            <span class="material-symbols-outlined">auto_awesome</span>
            Show Success Toast
          </button>
          <button
            on:click={showCustomSuccessToast}
            class="w-full rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-6 py-4 text-lg font-medium text-accent-gold hover:bg-accent-gold/20 transition-colors flex items-center justify-center gap-3"
          >
            <span class="material-symbols-outlined">tune</span>
            Show Custom Success Toast
          </button>
        </div>

        <div class="rounded-lg bg-slate-900/50 p-4">
          <h4 class="mb-2 font-semibold text-slate-300">Features</h4>
          <ul class="space-y-2 text-sm text-slate-400">
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-accent-gold text-base"
                >check</span
              >
              Gold patterned border with SVG texture
            </li>
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-accent-gold text-base"
                >check</span
              >
              Purple glow effect with blur
            </li>
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-accent-gold text-base"
                >check</span
              >
              "auto_awesome" icon with fill effect
            </li>
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-accent-gold text-base"
                >check</span
              >
              Close button with hover transition
            </li>
          </ul>
        </div>
      </div>

      <!-- Preview -->
      <div class="space-y-4">
        <h3 class="text-xl font-semibold text-slate-300">Preview</h3>
        <div class="relative">
          <SuccessToast
            title="Scroll Archived"
            description="Success: Your scroll has been safely archived."
            onClose={() => {}}
          />
        </div>
        <p class="text-sm text-slate-500">
          Static preview of the SuccessToast component
        </p>
      </div>
    </div>
  </section>

  <!-- Error Toast Test Section -->
  <section
    class="rounded-2xl border border-(--color-error)/20 bg-linear-to-br from-slate-900/50 to-slate-900/30 p-6 shadow-xl"
  >
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="font-display text-3xl font-bold text-slate-100">
          Error Toast - Interactive
        </h2>
        <p class="mt-2 text-slate-400">
          Red and silver design with "error" icon
        </p>
      </div>
      <div
        class="rounded-lg bg-(--color-error)/20 px-3 py-1 text-sm font-medium text-(--color-error)"
      >
        Error Style
      </div>
    </div>

    <div class="grid gap-8 md:grid-cols-2">
      <!-- Controls -->
      <div class="space-y-6">
        <h3 class="text-xl font-semibold text-slate-300">Interactive Test</h3>
        <div class="space-y-4">
          <button
            on:click={showErrorToast}
            class="w-full rounded-lg bg-(--color-error-container) px-6 py-4 text-lg font-medium text-white hover:bg-(--color-error-container)/90 transition-colors flex items-center justify-center gap-3"
          >
            <span class="material-symbols-outlined">error</span>
            Show Error Toast
          </button>
          <button
            on:click={showCustomErrorToast}
            class="w-full rounded-lg border border-(--color-error)/40 bg-(--color-error)/10 px-6 py-4 text-lg font-medium text-(--color-error) hover:bg-(--color-error)/20 transition-colors flex items-center justify-center gap-3"
          >
            <span class="material-symbols-outlined">tune</span>
            Show Custom Error Toast
          </button>
        </div>

        <div class="rounded-lg bg-slate-900/50 p-4">
          <h4 class="mb-2 font-semibold text-slate-300">Features</h4>
          <ul class="space-y-2 text-sm text-slate-400">
            <li class="flex items-center gap-2">
              <span
                class="material-symbols-outlined text-(--color-error) text-base"
                >check</span
              >
              Red glow effect with blur
            </li>
            <li class="flex items-center gap-2">
              <span
                class="material-symbols-outlined text-(--color-error) text-base"
                >check</span
              >
              Muted gold/silver gradient border
            </li>
            <li class="flex items-center gap-2">
              <span
                class="material-symbols-outlined text-(--color-error) text-base"
                >check</span
              >
              "error" icon with fill effect
            </li>
            <li class="flex items-center gap-2">
              <span
                class="material-symbols-outlined text-(--color-error) text-base"
                >check</span
              >
              Close button with hover transition
            </li>
          </ul>
        </div>
      </div>

      <!-- Preview -->
      <div class="space-y-4">
        <h3 class="text-xl font-semibold text-slate-300">Preview</h3>
        <div class="relative">
          <ErrorToast
            title="Reality Fractured"
            description="Error: A rift has formed in the archive. Please try again."
            onClose={() => {}}
          />
        </div>
        <p class="text-sm text-slate-500">
          Static preview of the ErrorToast component
        </p>
      </div>
    </div>
  </section>

  <!-- Toast Controls Section -->
  <section
    class="rounded-2xl border border-primary/20 bg-linear-to-br from-slate-900/50 to-slate-900/30 p-6 shadow-xl"
  >
    <h2 class="font-display text-3xl font-bold text-slate-100 mb-6">
      Toast Controls
    </h2>

    <div class="grid gap-8 md:grid-cols-2">
      <div class="space-y-6">
        <h3 class="text-xl font-semibold text-slate-300">Batch Operations</h3>
        <div class="space-y-4">
          <button
            on:click={showMultipleSuccessToasts}
            class="w-full rounded-lg bg-primary/10 px-6 py-4 text-lg font-medium text-primary hover:bg-primary/20 transition-colors flex items-center justify-center gap-3"
          >
            <span class="material-symbols-outlined">queue</span>
            Show 3 Success Toasts
          </button>
          <button
            on:click={showMultipleErrorToasts}
            class="w-full rounded-lg bg-(--color-error)/10 px-6 py-4 text-lg font-medium text-(--color-error) hover:bg-(--color-error)/20 transition-colors flex items-center justify-center gap-3"
          >
            <span class="material-symbols-outlined">queue</span>
            Show 3 Error Toasts
          </button>
        </div>

        <div class="rounded-lg bg-slate-900/50 p-4">
          <h4 class="mb-2 font-semibold text-slate-300">
            svelte-sonner Configuration
          </h4>
          <ul class="space-y-2 text-sm text-slate-400">
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base"
                >check</span
              >
              Default duration: 5000ms (5 seconds)
            </li>
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base"
                >check</span
              >
              Position: Top-center (default)
            </li>
            <li class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base"
                >check</span
              >
              Built-in entrance/exit animations
            </li>
          </ul>
        </div>
      </div>

      <div class="space-y-6">
        <h3 class="text-xl font-semibold text-slate-300">Management</h3>
        <div class="space-y-4">
          <button
            on:click={dismissAllToasts}
            class="w-full rounded-lg bg-slate-800 px-6 py-4 text-lg font-medium text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-center gap-3"
          >
            <span class="material-symbols-outlined">close</span>
            Dismiss All Toasts
          </button>
        </div>

        <div class="rounded-lg bg-slate-900/50 p-4">
          <h4 class="mb-2 font-semibold text-slate-300">Usage Example</h4>
        </div>
      </div>
    </div>
  </section>
</div>

<script lang="ts">
    import { onMount, untrack } from "svelte";

    // Props with Svelte 5 syntax
    // initialImageUrl allows showing existing cover when editing a story
    let {
        label = "Visual Soul",
        uploadText = "Summon Cover Image",
        acceptTypes = "image/*",
        maxSizeMB = 5,
        initialImageUrl = "",
    } = $props<{
        initialImageUrl?: string;
        label?: string;
        uploadText?: string;
        acceptTypes?: string;
        maxSizeMB?: number;
    }>();

    let rootelement: HTMLElement;

    let uploadArea: HTMLElement;

    let fileInput: HTMLInputElement;

    // Default placeholder image used when no cover exists
    const DEFAULT_COVER =
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBTLkX3EG9NkCukJ3Z0fBy3pLj3F4cGczhgSJnukvUBY8YbJLZNM_rOQDenOPXb5J33sk1v-qZqiAVdkL14VD80wcMitXOubqP_dPBXyYJIP_mFSUtOfMTOKyXxc_dyA0W6o0ImddfFYf0oPy8pnWBijvDkj19Co1nsHsh0PAXB1UHgc2j7PZ7Egfp8O5VIaXH8oowH_K0aeLGIB4eaEeNM04E5rt2UYAMsg3_HH9Z-gLkrLAZRmMU00NrikKxPvblUl0ZVqvObFhM";

    // State with runes — use initialImageUrl if provided (edit mode), else default
    // untrack: we intentionally want only the initial value, not a reactive derived
    let selectedFile = $state<File | null>(null);
    let previewUrl = $state<string>(
        untrack(() => initialImageUrl || DEFAULT_COVER),
    );
    let uploadStatus = $state<"idle" | "uploading" | "success" | "error">(
        "idle",
    );
    let errorMessage = $state<string>("");
    let isUploading = $state(false);

    // Derived values
    const statusText = $derived(getStatusText());

    // File validation function adapted from create-story.ts
    function validateFile(file: File | null): {
        isValid: boolean;
        error?: string;
    } {
        if (!file) return { isValid: false };

        const validTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!validTypes.includes(file.type)) {
            return {
                isValid: false,
                error: "Invalid Artifact - Please select a valid image file (.jpg, .png, or .webp)",
            };
        }

        const maxSize = maxSizeMB * 1024 * 1024;
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: `Artifact Too Large - Please select an image smaller than ${maxSizeMB}MB`,
            };
        }

        return { isValid: true };
    }
    // Status text helper
    function getStatusText(): string {
        switch (uploadStatus) {
            case "uploading":
                return "Invoking essence to Supabase...";
            case "success":
                return "Essence invoked! Ready for submission.";
            case "error":
                return errorMessage || "Upload failed. Please try again.";
            default:
                return "";
        }
    }

    // Handle file selection
    function handleFileSelect(event: Event) {
        uploadStatus = "idle";
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        // Validate file
        const validation = validateFile(file);
        if (!validation.isValid) {
            errorMessage = validation.error || "Invalid file";
            uploadStatus = "error";
            input.value = "";
            selectedFile = null;
            return;
        }

        // Set loading state
        selectedFile = file;

        // Show local preview immediately

        previewUrl = URL.createObjectURL(file);

        rootelement.dispatchEvent(
            new CustomEvent("change", {
                bubbles: true,
                composed: true,
                detail: file,
            }),
        );
    }

    // Clean up blob URLs on unmount
    $effect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    });

    //setup click event for files input
    onMount(() => {
        uploadArea.addEventListener("click", () => {
            fileInput.click();
        });
    });
</script>

<div
    bind:this={rootelement}
    class="glass-card gold-border rounded-xl flex flex-col relative overflow-hidden min-h-100 h-full"
>
    <img
        id="cover-preview"
        class="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
        alt="Mystical mountain landscape for story cover"
        src={previewUrl}
    />
    <div class="relative z-10 p-8 flex flex-col h-full">
        <label
            for="cover-image"
            class="block text-xs uppercase tracking-widest text-accent-gold mb-4 font-bold"
        >
            {label}
        </label>

        <!-- Upload area -->
        <div
            bind:this={uploadArea}
            class="flex-1 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center group hover:border-primary transition-all bg-slate-950/20"
            id="visual-soul-upload-area"
            class:opacity-50={isUploading}
            class:cursor-not-allowed={isUploading}
            class:cursor-pointer={!isUploading}
        >
            <span
                class="material-symbols-outlined text-5xl text-primary mb-2 group-hover:scale-110 transition-transform"
            >
                cloud_upload
            </span>
            <p class="text-sm font-serif text-slate-400">
                {uploadText}
            </p>
            <p class="text-[10px] text-slate-500 mt-1 italic">
                PNG, JPG, or Arcane Scrolls
            </p>
        </div>

        <!-- Hidden file input -->
        <input
            bind:this={fileInput}
            id="essence-upload"
            accept={acceptTypes}
            type="file"
            class="hidden"
            onchange={handleFileSelect}
            name="cover-image"
        />

        <!-- Upload status -->
        <div
            id="upload-status"
            class="text-sm mt-4"
            class:hidden={uploadStatus === "idle"}
        >
            <span
                id="upload-status-text"
                class="italic"
                class:text-accent-gold={uploadStatus === "uploading" ||
                    uploadStatus === "success"}
                class:text-red-400={uploadStatus === "error"}
            >
                {statusText}
            </span>
        </div>
    </div>
</div>

<style>
    .glass-card {
        background: rgba(32, 21, 40, 0.6);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(212, 175, 55, 0.2);
    }

    .gold-border {
        border: 1px solid rgba(212, 175, 55, 0.3);
    }

    .min-h-100 {
        min-height: 400px;
    }
</style>

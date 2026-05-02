<script lang="ts">
    import { untrack } from "svelte";

    let {
        targetUserId,
        initialIsFollowing = false,
        followerCount = 0,
    } = $props<{
        targetUserId: string;
        initialIsFollowing?: boolean;
        followerCount?: number;
    }>();

    // untrack() explicitly captures the initial prop value as a one-time snapshot,
    // silencing the state_referenced_locally warning while making intent clear.
    let isFollowing = $state(untrack(() => initialIsFollowing));
    let currentCount = $state(untrack(() => followerCount));
    let isLoading = $state(false);

    // ─── Toast helpers (arcane-toast pattern) ────────────────────────────────

    function showSuccessToast(following: boolean) {
        window.dispatchEvent(
            new CustomEvent("arcane-toast:show", {
                detail: {
                    id: "follow-toast",
                    eyebrow: "Network Updated",
                    title: following ? "Now Following" : "Unfollowed",
                    description: following
                        ? "You are now following this user."
                        : "You have unfollowed this user.",
                    icon: "check_circle",
                    duration: 4000,
                },
            }),
        );
    }

    function showErrorToast() {
        window.dispatchEvent(
            new CustomEvent("arcane-toast:show", {
                detail: {
                    id: "follow-toast",
                    eyebrow: "Follow Error",
                    title: "The Ritual Failed",
                    description:
                        "Could not update follow status. Please try again.",
                    icon: "error",
                    duration: 6000,
                },
            }),
        );
    }

    // ─── Toggle logic ─────────────────────────────────────────────────────────

    async function toggleFollow() {
        if (isLoading) return;

        isLoading = true;

        // Optimistic UI update
        const intent = !isFollowing;
        isFollowing = intent;
        currentCount = Math.max(0, currentCount + (intent ? 1 : -1));

        try {
            const method = intent ? "POST" : "DELETE";
            const res = await fetch(`/api/user/${targetUserId}/follow`, {
                method,
            });
            if (!res.ok) throw new Error("Failed to toggle follow status");

            showSuccessToast(intent);
        } catch (error) {
            // Revert on failure
            isFollowing = !intent;
            currentCount = Math.max(0, currentCount + (intent ? -1 : 1));
            console.error("Follow toggle error:", error);
            showErrorToast();
        } finally {
            isLoading = false;
        }
    }
</script>

<!-- No 1px borders used, relying on spacing and tonal layers as per DESIGN.md -->
<div class="flex items-center gap-8">
    <!-- Follower Count Display (Scholarly Marginalia Style using Inter font) -->
    <div class="flex flex-col text-center">
        <span
            class="font-sans text-xs font-medium tracking-[0.05em] text-[#958f98] uppercase"
            >Followers</span
        >
        <span
            class="font-serif text-2xl tracking-tight text-[#e9c349] transition-all duration-300"
            >{currentCount}</span
        >
    </div>

    <!-- The physical switch -->
    <div class="flex items-center gap-4">
        <button
            type="button"
            role="switch"
            aria-checked={isFollowing}
            onclick={toggleFollow}
            disabled={isLoading}
            class="group relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-500 focus:outline-none disabled:opacity-50"
            aria-label="Toggle follow"
        >
            <!-- Base Layer: Glass & Gradient style for the track -->
            <div
                class="absolute inset-0 rounded-full transition-all duration-500"
                class:bg-[#e9c349]={isFollowing}
                class:bg-[#3c3048]={!isFollowing}
                class:shadow-[0_0_40px_-5px_#e9c349]={isFollowing}
                class:opacity-80={isFollowing}
                class:opacity-70={!isFollowing}
            ></div>

            <!-- The Signature "Double Outline" -->
            <!-- Outer border: gold when following, muted grey when not -->
            <div
                class="absolute -inset-[0.175rem] rounded-full border scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 {isFollowing
                    ? 'border-[#e9c349]'
                    : 'border-[#958f98]/40'}"
            ></div>
            <!-- Inner border: gold when following, muted grey when not -->
            <div
                class="absolute inset-0 rounded-full border scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 {isFollowing
                    ? 'border-[#e9c349]'
                    : 'border-[#958f98]/40'}"
            ></div>

            <!-- The thumb/nub (on-surface soft white) -->
            <span
                class="pointer-events-none relative z-10 inline-block h-6 w-6 transform rounded-full bg-[#efdcfb] shadow-md transition-transform duration-500 ease-in-out"
                class:translate-x-3={isFollowing}
                class:-translate-x-3={!isFollowing}
            >
                <!-- Inner alchemical dot syncing with track -->
                <span
                    class="absolute inset-1.5 rounded-full transition-colors duration-500"
                    class:bg-[#e9c349]={isFollowing}
                    class:bg-[#190e24]={!isFollowing}
                ></span>
            </span>
        </button>

        <!-- Label -->
        <span
            class="font-sans text-sm font-medium tracking-[0.05em] uppercase transition-colors duration-500"
            class:text-[#e9c349]={isFollowing}
            class:text-[#958f98]={!isFollowing}
        >
            {isFollowing ? "Following" : "Follow"}
        </span>
    </div>
</div>

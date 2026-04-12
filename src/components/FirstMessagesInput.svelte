<script lang="ts">
    import { untrack } from "svelte";
    // Props with Svelte 5 syntax
    // initialMessages allows pre-populating when editing a story
    let {
        label = "First Messages",
        placeholder = "Infuse first messages...",
        name = "first_messages",
        initialMessages = [],
    } = $props<{
        label?: string;
        placeholder?: string;
        name?: string;
        initialMessages?: Array<{
            id?: string;
            title: string;
            content: string;
            sort_order: number;
        }>;
    }>();

    const inputId = $derived(`${name}-input`);

    type Message = {
        id?: string;
        title: string;
        content: string;
        sort_order: number;
    };

    const MAX_MESSAGES = 10;
    const DRAG_THRESHOLD = 5; // pixels
    let rootelement: HTMLElement;

    // State with runes — seed from initialMessages if provided (edit mode)
    // untrack: we intentionally want only the initial value, not a reactive derived
    let messages = $state<Message[]>(
        untrack(() => (initialMessages.length > 0 ? [...initialMessages] : [])),
    );
    let activeIndex = $state(0);
    let isDragging = $state(false);
    let dragStartIndex = $state(-1);
    let dragOverIndex = $state(-1);
    let dragStartX = $state(0);
    let dragStartY = $state(0);
    const emit = () => {
        const data = $state.snapshot(messages);
        rootelement.dispatchEvent(
            new CustomEvent("change", {
                detail: data,
                bubbles: true,
                composed: true,
            }),
        );
    };

    $effect(() => {
        emit();
    });

    const addMessage = () => {
        if (messages.length >= MAX_MESSAGES) return;
        const newMsg: Message = {
            title: "",
            content: "",
            sort_order: messages.length,
        };
        messages = [...messages, newMsg];
        activeIndex = messages.length - 1;
    };

    // const removeMessage = (index: number) => {
    //     if (messages.length <= 1) return;
    //     messages = messages.filter((_, i) => i !== index);
    //     // Update sort_order for remaining messages
    //     messages.forEach((msg, idx) => {
    //         msg.sort_order = idx;
    //     });
    //     if (activeIndex >= messages.length) {
    //         activeIndex = Math.max(0, messages.length - 1);
    //     }

    // };

    const setActive = (index: number) => {
        // Only switch if not currently dragging
        if (!isDragging) {
            activeIndex = index;
        }
    };

    const updateTitle = (index: number, value: string) => {
        messages[index].title = value;
    };

    const updateContent = (index: number, value: string) => {
        messages[index].content = value;
    };

    // Drag and drop functions
    const handleMouseDown = (index: number, event: MouseEvent) => {
        dragStartIndex = index;
        dragStartX = event.clientX;
        dragStartY = event.clientY;

        // Don't prevent default - let click events work
        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = Math.abs(moveEvent.clientX - dragStartX);
            const dy = Math.abs(moveEvent.clientY - dragStartY);

            // Start dragging if mouse moved beyond threshold
            if ((dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) && !isDragging) {
                isDragging = true;
                // Prevent text selection during drag
                moveEvent.preventDefault();
                // Set cursor to grabbing
                document.body.style.cursor = "grabbing";
            }

            // Update drag over index based on mouse position
            if (isDragging) {
                // Calculate which tab the mouse is over
                const buttons = document.querySelectorAll(".tab-button");
                let newDragOverIndex = -1;

                buttons.forEach((button, i) => {
                    const rect = button.getBoundingClientRect();
                    if (
                        moveEvent.clientX >= rect.left &&
                        moveEvent.clientX <= rect.right &&
                        moveEvent.clientY >= rect.top &&
                        moveEvent.clientY <= rect.bottom
                    ) {
                        newDragOverIndex = i;
                    }
                });

                if (
                    newDragOverIndex !== -1 &&
                    newDragOverIndex !== dragOverIndex
                ) {
                    dragOverIndex = newDragOverIndex;
                }
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            document.body.style.cursor = "";

            if (
                isDragging &&
                dragStartIndex !== -1 &&
                dragOverIndex !== -1 &&
                dragStartIndex !== dragOverIndex
            ) {
                // Perform reorder
                const newMessages = [...messages];
                const [moved] = newMessages.splice(dragStartIndex, 1);
                newMessages.splice(dragOverIndex, 0, moved);

                // Update sort_order
                newMessages.forEach((msg, idx) => {
                    msg.sort_order = idx;
                });

                messages = newMessages;
                activeIndex = dragOverIndex;
            }

            resetDrag();
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    };

    const resetDrag = () => {
        isDragging = false;
        dragStartIndex = -1;
        dragOverIndex = -1;
        dragStartX = 0;
        dragStartY = 0;
    };

    // Initialize on mount
    $effect(() => {
        // Add global mouse up listener to handle drag end
        const handleMouseUp = () => {
            if (isDragging) {
                resetDrag();
            }
        };

        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    });

    // Ensure messages array is never empty
    $effect(() => {
        if (messages.length === 0) {
            messages = [{ title: "", content: "", sort_order: 0 }];
        }
    });
</script>

<div class="flex flex-col gap-3" data-arcane-skip bind:this={rootelement}>
    <label
        class="flex items-center gap-2 text-accent-gold text-lg font-bold tracking-wide uppercase"
        for={inputId}
    >
        <span class="material-symbols-outlined text-sm">chat_bubble</span>
        {label}
    </label>
    <div class="flex flex-col gap-4">
        <!-- Tab Navigation -->
        <div class="flex items-center gap-2">
            {#each messages as msg, index (index)}
                {#if isDragging && dragOverIndex === index && dragStartIndex !== index}
                    <div class="relative">
                        <div class="size-10 flex items-center justify-center">
                            <div
                                class="w-1 h-6 bg-accent-gold rounded-full"
                            ></div>
                        </div>
                    </div>
                {/if}
                <button
                    type="button"
                    class="tab-button size-10 rounded-lg flex items-center justify-center border font-bold transition-all relative {index ===
                    activeIndex
                        ? 'border-accent-gold bg-primary/40 text-accent-gold shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                        : 'border-primary/30 bg-background-dark/40 text-slate-400 hover:border-primary'} {isDragging &&
                    dragStartIndex === index
                        ? 'opacity-50 scale-95'
                        : ''} {isDragging &&
                    dragOverIndex === index &&
                    dragStartIndex !== index
                        ? 'border-accent-gold/50 bg-accent-gold/10'
                        : ''}"
                    onclick={() => setActive(index)}
                    onmousedown={(e) => handleMouseDown(index, e)}
                >
                    {msg.sort_order + 1}
                    {#if isDragging && dragStartIndex === index}
                        <div
                            class="absolute inset-0 bg-accent-gold/20 rounded-lg"
                        ></div>
                    {/if}
                    {#if isDragging && dragOverIndex === index && dragStartIndex !== index}
                        <div
                            class="absolute inset-0 border-2 border-accent-gold/50 border-dashed rounded-lg"
                        ></div>
                    {/if}
                </button>
                {#if isDragging && dragOverIndex === index && dragStartIndex !== index && index === messages.length - 1}
                    <div class="relative">
                        <div class="size-10 flex items-center justify-center">
                            <div
                                class="w-1 h-6 bg-accent-gold rounded-full"
                            ></div>
                        </div>
                    </div>
                {/if}
            {/each}
            {#if messages.length < MAX_MESSAGES}
                <button
                    type="button"
                    class="size-10 rounded-lg flex items-center justify-center border border-primary/30 border-dashed bg-transparent text-primary hover:text-accent-gold transition-all"
                    onclick={addMessage}
                >
                    <span class="material-symbols-outlined text-xl">add</span>
                </button>
            {/if}
        </div>

        <!-- Active Message Inputs -->
        {#if messages[activeIndex]}
            {@const activeMsg = messages[activeIndex]}
            <div class="relative">
                <div class="mb-4">
                    <!-- svelte-ignore a11y_label_has_associated_control -->
                    <label
                        class="block text-xs text-accent-gold/70 font-bold uppercase tracking-widest mb-2 px-1"
                    >
                        Message Title
                    </label>
                    <input
                        class="w-full rounded-lg text-slate-100 focus:outline-0 focus:ring-1 focus:ring-accent-gold border border-primary/30 bg-background-dark/80 h-12 px-4 text-lg font-display placeholder:text-slate-600 gold-glow transition-all"
                        placeholder="E.g., The Awakening..."
                        type="text"
                        value={activeMsg.title}
                        oninput={(e) =>
                            updateTitle(
                                activeIndex,
                                (e.currentTarget as HTMLInputElement).value,
                            )}
                    />
                </div>
                <textarea
                    class="w-full min-h-50 rounded-lg text-slate-100 focus:outline-0 focus:ring-1 focus:ring-accent-gold border border-primary/30 bg-background-dark/80 p-4 text-base font-display italic placeholder:text-slate-600 gold-glow transition-all resize-none"
                    placeholder="The first words the reader shall encounter..."
                    value={activeMsg.content}
                    oninput={(e) =>
                        updateContent(
                            activeIndex,
                            (e.currentTarget as HTMLTextAreaElement).value,
                        )}
                ></textarea>
            </div>
        {/if}
    </div>
    <!-- Hidden input removed - data now emitted via onChange event -->
    <p class="text-xs text-slate-500 italic">
        The initial whispers that greet the seeker upon opening the tome.
    </p>
</div>

<style>
    .gold-glow:focus {
        box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
        border-color: #d4af37;
    }
</style>

<script lang="ts">
    /**
     * CharacterRegistry — manage a list of story characters.
     * Emits a "change" custom event with the updated character array
     * whenever a character is added, edited, or removed.
     */
    import { untrack } from "svelte";
    import type { StoryCharacterJson } from "../lib/types";

    let {
        label = "Character Registry",
        placeholderName = "Name",
        placeholderDescription = "Describe the soul's essence...",
        initialCharacters = [],
    } = $props<{
        label?: string;
        placeholderName?: string;
        placeholderDescription?: string;
        name?: string;
        initialCharacters?: StoryCharacterJson[];
    }>();

    // bind:this sets this to the element on mount; undefined beforehand
    let rootelement: HTMLElement | undefined = $state(undefined);
    // bind:this needs $state so Svelte can track the reference
    let nameInput = $state<HTMLInputElement>();
    let descriptionInput = $state<HTMLTextAreaElement>();

    type Character = StoryCharacterJson;

    // Seed from initialCharacters only once — untrack prevents a reactive loop
    let characters = $state<Character[]>(untrack(() => [...initialCharacters]));

    let editingIndex = $state<number | null>(null);
    let isAdding = $state(false);

    /** Dispatch current character list to parent */
    const emitChange = () => {
        rootelement?.dispatchEvent(
            new CustomEvent("change", {
                detail: $state.snapshot(characters),
                bubbles: true,
                composed: true,
            }),
        );
    };

    const startAdd = () => {
        isAdding = true;
        editingIndex = null;
    };

    const cancelAdd = () => {
        isAdding = false;
        editingIndex = null;
    };

    const saveCharacter = () => {
        if (!nameInput || !descriptionInput) return;

        const newCharacter: Character = {
            name: nameInput.value.trim(),
            description: descriptionInput.value,
        };

        // A name is required
        if (!newCharacter.name) return;

        if (editingIndex !== null) {
            // Update existing character in-place
            characters = characters.map((char, idx) =>
                idx === editingIndex ? { ...newCharacter } : char,
            );
            editingIndex = null;
        } else {
            // Append new character
            characters.push(newCharacter);
        }

        // Always emit after any change (add or edit)
        emitChange();
        isAdding = false;
    };

    const editCharacter = (index: number) => {
        editingIndex = index;
        isAdding = true;
    };

    const removeCharacter = (index: number) => {
        characters = characters.filter((_, i) => i !== index);
        if (editingIndex === index) cancelAdd();
        emitChange();
    };
</script>

<div class="flex flex-col gap-6" data-arcane-skip bind:this={rootelement}>
    <!-- Header -->
    <div class="flex justify-between items-end mb-2">
        <div>
            <!-- svelte-ignore a11y_label_has_associated_control -->
            <label
                class="block text-xs uppercase tracking-widest text-secondary mb-2 font-bold"
            >
                {label}
            </label>
            <h3 class="text-2xl font-display font-bold">characters</h3>
        </div>
        <button
            class="flex items-center gap-2 bg-secondary/10 border border-secondary text-secondary px-4 py-2 rounded-lg text-sm font-bold hover:bg-secondary/20 transition-all"
            type="button"
            onclick={startAdd}
        >
            <span class="material-symbols-outlined text-sm">person_add</span>
            add new char
        </button>
    </div>

    <!-- Add / Edit form -->
    {#if isAdding}
        <div
            class="bg-surface-container rounded-lg p-5 border border-purple-900/30 hover:border-primary/50 transition-all mb-6"
        >
            <input
                class="w-full bg-transparent border-none text-primary font-bold p-0 mb-3 focus:ring-0 text-lg font-display"
                placeholder={placeholderName}
                value={editingIndex !== null
                    ? characters[editingIndex]?.name
                    : ""}
                bind:this={nameInput}
                type="text"
            />
            <textarea
                class="w-full bg-transparent border-none text-xs text-on-surface-variant font-display leading-relaxed p-0 focus:ring-0 h-24 min-h-20"
                placeholder={placeholderDescription}
                bind:this={descriptionInput}
                value={editingIndex !== null
                    ? characters[editingIndex]?.description
                    : ""}
            ></textarea>
            <div class="flex justify-end gap-2 mt-4">
                <button
                    class="px-4 py-2 text-slate-400 hover:text-slate-300 transition-colors text-sm"
                    type="button"
                    onclick={cancelAdd}
                >
                    Cancel
                </button>
                <button
                    class="px-4 py-2 bg-primary/20 text-primary border border-primary/40 rounded-lg text-sm font-bold hover:bg-primary/30 transition-all"
                    type="button"
                    onclick={saveCharacter}
                >
                    {editingIndex !== null ? "Update Soul" : "Bind Soul"}
                </button>
            </div>
        </div>
    {/if}

    <!-- Character grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        {#each characters as character, index (index)}
            <div
                class="bg-surface-container rounded-lg p-5 border border-purple-900/30 hover:border-primary/50 transition-all group"
            >
                <div class="flex justify-between items-start mb-3">
                    <input
                        class="w-full bg-transparent border-none text-primary font-bold p-0 focus:ring-0 text-lg font-display"
                        value={character.name}
                        readonly
                        type="text"
                    />
                    <div
                        class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <button
                            class="material-symbols-outlined text-sm text-slate-400 hover:text-primary transition-colors"
                            type="button"
                            onclick={() => editCharacter(index)}
                            title="Edit"
                        >
                            edit
                        </button>
                        <button
                            class="material-symbols-outlined text-sm text-slate-400 hover:text-red-400 transition-colors"
                            type="button"
                            onclick={() => removeCharacter(index)}
                            title="Remove"
                        >
                            delete
                        </button>
                    </div>
                </div>
                <textarea
                    class="w-full bg-transparent border-none text-xs text-on-surface-variant font-display leading-relaxed p-0 focus:ring-0 h-20 min-h-20"
                    readonly>{character.description}</textarea
                >
            </div>
        {/each}

        <!-- Empty state -->
        {#if characters.length === 0 && !isAdding}
            <div
                class="bg-surface-container rounded-lg p-5 border border-purple-900/30 hover:border-primary/50 transition-all opacity-40 col-span-full md:col-span-3"
            >
                <div
                    class="h-full flex flex-col items-center justify-center text-slate-500 italic"
                >
                    <span class="material-symbols-outlined mb-2 text-3xl"
                        >group</span
                    >
                    <span class="text-sm"
                        >No characters yet. Bind a new soul to begin.</span
                    >
                </div>
            </div>
        {/if}
    </div>
</div>

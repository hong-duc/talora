<script lang="ts">
    import type { Tag, TagCategoryGroup } from "../lib/types";

    const fallbackColor = "#6b7280";
    const customCategoryId = "custom";
    const customCategoryName = "Custom";

    let rootelement : HTMLElement


    $effect(()=>{
        const data = $state.snapshot(selectedTags)
        rootelement.dispatchEvent(new CustomEvent("change", {
            detail: data, 
            bubbles: true,
            composed: true
        }))
    })

    // Props with Svelte 5 syntax
    let {
        label = "Story Essences",
        placeholder = "Infuse essence (e.g. Grimdark, Romance)...",
        name = "story_essences",
        initialTags = [],
    } = $props<{
        label?: string;
        placeholder?: string;
        name?: string;
        initialTags?: Tag[];
    }>();

    const inputId = $derived(`${name}-input`);

    type Suggestion = {
        tag: Tag;
        category: TagCategoryGroup;
    };

    // State with runes
    let categories = $state<TagCategoryGroup[]>([]);
    let selectedTags = $state<Tag[]>([]);
    let query = $state("");
    let isOpen = $state(false);
    let isLoaded = $state(false);
    let isLoading = $state(false);
    let loadError = $state("");
    let blurTimeout: ReturnType<typeof setTimeout> | null = null;
    let activeIndex = $state(-1);

    // Derived values
    const normalize = (value: string) => value.trim().toLowerCase();
    const tagKey = (tag: Tag) => tag.id ?? normalize(tag.name);

    const allTags = $derived(categories.flatMap((category) => category.tags));
    const canCreate = $derived(
        query.trim().length > 0 &&
            !allTags.some((tag) => normalize(tag.name) === normalize(query)),
    );

    const tagColorById = $derived(
        categories.reduce<Record<string, string>>((acc, category) => {
            const color = category.color || fallbackColor;
            category.tags.forEach((tag) => {
                if (tag.id) acc[tag.id] = color;
            });
            return acc;
        }, {}),
    );

    const isSelected = (tag: Tag) =>
        selectedTags.some(
            (item) => normalize(item.name) === normalize(tag.name),
        );

    const filteredCategories = $derived(
        categories
            .map((category) => ({
                ...category,
                tags: category.tags.filter((tag) => {
                    if (isSelected(tag)) return false;
                    if (!query.trim()) return true;
                    return normalize(tag.name).includes(normalize(query));
                }),
            }))
            .filter((category) => category.tags.length > 0),
    );

    const flatSuggestionsFn = $derived(() => {
        const suggestions: Suggestion[] = [];

        for (const category of filteredCategories) {
            for (const tag of category.tags) {
                suggestions.push({ tag, category });
            }
        }

        return suggestions;
    });

    const flatSuggestions = $derived(flatSuggestionsFn());

    const getSuggestionIndex = (tag: Tag) => {
        let index = 0;
        for (const category of filteredCategories) {
            for (const categoryTag of category.tags) {
                if (tagKey(categoryTag) === tagKey(tag)) {
                    return index;
                }
                index += 1;
            }
        }
        return -1;
    };

    // Functions
    const findTagByName = (name: string) => {
        const normalized = normalize(name);
        for (const category of categories) {
            const match = category.tags.find(
                (tag) => normalize(tag.name) === normalized,
            );
            if (match) return match;
        }
        return null;
    };

    const findTagById = (id: string) => {
        for (const category of categories) {
            const match = category.tags.find((tag) => tag.id === id);
            if (match) return match;
        }
        return null;
    };

    const upsertCustomCategory = (tag: Tag) => {
        const existingIndex = categories.findIndex(
            (category) => category.id === customCategoryId,
        );

        if (existingIndex >= 0) {
            const existing = categories[existingIndex];
            // Check if tag already exists in custom category
            const tagExists = existing.tags.some(
                (existingTag) =>
                    normalize(existingTag.name) === normalize(tag.name),
            );
            if (!tagExists) {
                const updatedCategory = {
                    ...existing,
                    tags: [...existing.tags, tag],
                };
                categories = [
                    ...categories.slice(0, existingIndex),
                    updatedCategory,
                    ...categories.slice(existingIndex + 1),
                ];
            }
            return;
        }

        categories = [
            ...categories,
            {
                id: customCategoryId,
                name: customCategoryName,
                color: fallbackColor,
                tags: [tag],
            },
        ];
    };

    

    const addTag = (tag: Tag) => {
        if (isSelected(tag)) {
            query = "";
            isOpen = false;
            activeIndex = -1;
            return;
        }
        selectedTags = [
            ...selectedTags,
            { id: tag.id ?? null, name: tag.name },
        ];
        query = "";
        isOpen = false;
        activeIndex = -1;
        
    };

    const removeTag = (tag: Tag) => {
        selectedTags = selectedTags.filter(
            (item) => normalize(item.name) !== normalize(tag.name),
        );
        
    };

    const createTag = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const existing = findTagByName(trimmed);
        if (existing) {
            addTag(existing);
            return;
        }

        const newTag = { id: null, name: trimmed };
        upsertCustomCategory(newTag);
        addTag(newTag);
    };

    const ensureTagsLoaded = async () => {
        if (isLoaded || isLoading) return;
        isLoading = true;
        loadError = "";

        try {
            const response = await fetch("/api/tags", {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || response.statusText);
            }

            const result = await response.json().catch(() => null);
            const incoming = Array.isArray(result?.categories)
                ? result.categories
                : [];

            categories = incoming
                .map((category: any) => ({
                    id: String(category.id),
                    name: category.name,
                    color: category.color || fallbackColor,
                    tags: Array.isArray(category.tags)
                        ? category.tags
                              .map((tag: any) => ({
                                  id: tag.id ?? null,
                                  name: tag.name,
                              }))
                              .filter((tag: any) => Boolean(tag.name))
                        : [],
                }))
                .filter((category: any) => category.tags.length > 0);

            // Add initial tags that aren't in categories to custom category
            for (const tag of selectedTags) {
                if (tag.id) {
                    const existingTag = findTagById(tag.id);
                    if (!existingTag) {
                        // Tag exists in selected tags but not in categories - add to custom
                        upsertCustomCategory(tag);
                    }
                } else {
                    // Tag without ID - check by name
                    const existingTag = findTagByName(tag.name);
                    if (!existingTag) {
                        upsertCustomCategory(tag);
                    }
                }
            }

            isLoaded = true;
        } catch (error) {
            loadError =
                error instanceof Error ? error.message : "Failed to load tags.";
        } finally {
            isLoading = false;
        }
    };

    const onFocus = () => {
        if (blurTimeout) clearTimeout(blurTimeout);
        isOpen = true;
        void ensureTagsLoaded();
    };

    const onBlur = () => {
        blurTimeout = setTimeout(() => {
            isOpen = false;
            activeIndex = -1;
        }, 120);
    };

    const onInput = (event: Event) => {
        const target = event.currentTarget as HTMLInputElement;
        query = target.value;
        isOpen = true;
        activeIndex = 0;
        void ensureTagsLoaded();
    };

    const onKeydown = (event: KeyboardEvent) => {
        const max = flatSuggestions.length + (canCreate ? 1 : 0) - 1;

        if (event.key === "Enter") {
            event.preventDefault();
            if (activeIndex >= 0 && activeIndex < flatSuggestions.length) {
                addTag(flatSuggestions[activeIndex].tag);
                return;
            }
            if (canCreate) {
                createTag(query);
            }
            return;
        }

        if (event.key === "Backspace" && query.trim() === "") {
            const last = selectedTags[selectedTags.length - 1];
            if (last) removeTag(last);
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            if (max < 0) return;
            activeIndex = Math.min(activeIndex + 1, max);
            if (activeIndex < 0) activeIndex = 0;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (max < 0) return;
            activeIndex = Math.max(activeIndex - 1, 0);
        }
    };

    const toRgba = (hex: string, alpha: number) => {
        const clean = hex.replace("#", "");
        const value =
            clean.length === 3
                ? clean
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : clean;
        const bigint = parseInt(value, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const getTagColor = (tag: Tag) =>
        tag.id ? tagColorById[tag.id] || fallbackColor : fallbackColor;

    const tagStyle = (color: string) =>
        `border-color: ${toRgba(color, 0.6)}; background-color: ${toRgba(color, 0.2)}; color: ${color};`;

    // Initialize with initial tags
    $effect(() => {
        if (initialTags.length > 0 && selectedTags.length === 0) {
            selectedTags = [...initialTags];
            
        }
        void ensureTagsLoaded();
    });
</script>

<div class="flex flex-col gap-3" data-arcane-skip bind:this={rootelement}>
    <label
        class="flex items-center gap-2 text-accent-gold text-lg font-bold tracking-wide uppercase"
        for={inputId}
    >
        <span class="material-symbols-outlined text-sm">local_offer</span>
        {label}
    </label>
    <div class="relative">
        <div
            class="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-background-dark/60 p-3 min-h-14 gold-glow focus-within:ring-1 focus-within:ring-accent-gold transition-all"
        >
            {#each selectedTags as tag (tagKey(tag))}
                <div
                    class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                    style={tagStyle(getTagColor(tag))}
                >
                    <span>{tag.name}</span>
                    <button
                        class="hover:text-white transition-colors"
                        type="button"
                        onclick={() => removeTag(tag)}
                    >
                        <span class="material-symbols-outlined text-[14px]"
                            >close</span
                        >
                    </button>
                </div>
            {/each}
            <input
                id={inputId}
                class="flex-1 min-w-30 bg-transparent border-none focus:ring-0 text-slate-100 placeholder:text-slate-600 text-sm font-display"
                {placeholder}
                value={query}
                oninput={onInput}
                onfocus={onFocus}
                onblur={onBlur}
                onkeydown={onKeydown}
                type="text"
            />
        </div>

        {#if isOpen && (flatSuggestions.length > 0 || canCreate || isLoading || loadError)}
            <div
                class="absolute z-20 mt-2 w-full rounded-xl border border-primary/20 bg-[#201528] shadow-2xl isolate"
                style="isolation: isolate;"
            >
                {#if isLoading && flatSuggestions.length === 0}
                    <div class="px-4 py-3 text-sm text-slate-400">
                        Summoning essences...
                    </div>
                {/if}

                {#if loadError && flatSuggestions.length === 0}
                    <div class="px-4 py-3 text-sm text-red-300">
                        {loadError}
                    </div>
                {/if}

                {#each filteredCategories as category (category.id)}
                    <div
                        class="flex items-center gap-2 px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500"
                    >
                        <span
                            class="h-2 w-2 rounded-full"
                            style={`background-color: ${category.color || fallbackColor};`}
                        ></span>
                        <span>{category.name}</span>
                    </div>
                    {#each category.tags as tag (tagKey(tag))}
                        {@const index = getSuggestionIndex(tag)}
                        <button
                            class={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${index === activeIndex ? "bg-primary/20 text-accent-gold" : "text-slate-200 hover:bg-primary/10"}`}
                            type="button"
                            onmousedown={(e) => {
                                e.preventDefault();
                                addTag(tag);
                            }}
                        >
                            <span>{tag.name}</span>
                            <span
                                class="h-2 w-2 rounded-full"
                                style={`background-color: ${category.color || fallbackColor};`}
                            ></span>
                        </button>
                    {/each}
                {/each}

                {#if canCreate}
                    {@const createIndex = flatSuggestions.length}
                    <button
                        class={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${createIndex === activeIndex ? "bg-primary/20 text-accent-gold" : "text-slate-200 hover:bg-primary/10"}`}
                        type="button"
                        onmousedown={(e) => {
                            e.preventDefault();
                            createTag(query);
                        }}
                    >
                        <span>Create "{query}"</span>
                        <span
                            class="material-symbols-outlined text-base text-accent-gold"
                            >add</span
                        >
                    </button>
                {/if}
            </div>
        {/if}
    </div>
    <!-- Hidden input removed - data now emitted via onChange event -->
    <p class="text-xs text-slate-500 italic">
        The spiritual threads that weave your tale into the tapestry of the
        library.
    </p>
</div>

<style>
    .gold-glow:focus-within {
        box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
        border-color: #d4af37;
    }
</style>

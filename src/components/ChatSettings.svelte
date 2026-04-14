<script lang="ts">
    /**
     * ChatSettings — slide-in panel for managing AI backend configurations.
     *
     * Why a separate component: keeps ChatWindow focused on chat UX while this
     * handles all the CRUD for ai_configs in an isolated, testable unit.
     *
     * Features:
     *  - Dropdown list of saved configs (by name)
     *  - Add / edit / delete a config
     *  - Free-text model input
     *  - API key treated like a password (never shown back, only masked)
     *  - base_url field visible only for custom provider
     */

    import { onMount } from "svelte";
    import { PROVIDER_META, PROVIDER_OPTIONS } from "../lib/ai-providers";
    import type { AiConfig, AiProvider } from "../lib/types";

    // ─── Props ─────────────────────────────────────────────────────────────────

    interface Props {
        /** Bearer token for authenticated API calls */
        accessToken: string;
        /** Called when the panel should close */
        onClose: () => void;
    }

    let { accessToken, onClose }: Props = $props();

    // ─── State ─────────────────────────────────────────────────────────────────

    /** Saved configs loaded from the API */
    let configs = $state<AiConfig[]>([]);

    /** The config currently selected in the dropdown (null = "+ New Config") */
    let selectedId = $state<string | null>(null);

    /** Whether we are in "create new" mode */
    let isNew = $state(false);

    /** Loading / saving / deleting flags */
    let isLoading = $state(true);
    let isSaving = $state(false);
    let isDeleting = $state(false);

    /** Feedback message shown below the form */
    let feedback = $state<{ type: "success" | "error"; text: string } | null>(
        null,
    );

    // Form fields
    let formName = $state("");
    let formProvider = $state<AiProvider>("deepseek");
    let formModel = $state("");
    let formApiKey = $state(""); // plaintext while typing; masked after save
    let formBaseUrl = $state("");
    let formIsDefault = $state(false);

    // ─── Computed ──────────────────────────────────────────────────────────────

    /** Whether the custom base_url field should be visible */
    let showBaseUrl = $derived(formProvider === "custom");

    /** The currently selected config object */
    let selectedConfig = $derived(
        configs.find((c) => c.id === selectedId) ?? null,
    );

    // ─── Lifecycle ─────────────────────────────────────────────────────────────

    onMount(loadConfigs);

    // ─── API helpers ───────────────────────────────────────────────────────────

    /** Fetch the user's saved configs and populate the dropdown */
    async function loadConfigs() {
        isLoading = true;
        try {
            const res = await fetch("/api/user/ai-configs", {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            const json = await res.json();
            configs = json.configs ?? [];

            // Pre-select the default config if one exists; fall back to new-config mode
            const def = configs.find((c) => c.is_default);
            if (def) selectConfig(def.id!);
            else if (configs.length > 0) selectConfig(configs[0].id!);
            else startNewConfig(); // no saved configs — start in create mode
        } catch {
            setFeedback("error", "Failed to load configurations");
        } finally {
            isLoading = false;
        }
    }

    /** Save the current form (create or update) */
    async function saveConfig() {
        if (isSaving) return;
        if (!formName.trim())
            return setFeedback("error", "Please enter a config name");
        if (!formModel.trim())
            return setFeedback("error", "Please enter a model name");
        if (showBaseUrl && !formBaseUrl.trim())
            return setFeedback(
                "error",
                "Base URL is required for custom provider",
            );

        isSaving = true;
        feedback = null;

        const payload: Record<string, any> = {
            name: formName,
            provider: formProvider,
            model: formModel,
            base_url: formBaseUrl || undefined,
            is_default: formIsDefault,
        };

        // Only include api_key if the user typed something (not the masked placeholder)
        if (formApiKey && formApiKey !== selectedConfig?.api_key_masked) {
            payload.api_key = formApiKey;
        }

        try {
            const url = isNew
                ? "/api/user/ai-configs"
                : `/api/user/ai-configs/${selectedId}`;
            const method = isNew ? "POST" : "PUT";

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok)
                return setFeedback("error", json.error ?? "Save failed");

            setFeedback(
                "success",
                isNew ? "Configuration created!" : "Configuration saved!",
            );
            await loadConfigs();

            // Select the just-saved config
            if (json.config?.id) selectConfig(json.config.id);
        } catch {
            setFeedback("error", "Network error — please try again");
        } finally {
            isSaving = false;
        }
    }

    /** Delete the currently selected config */
    async function deleteConfig() {
        if (!selectedId || isDeleting) return;
        if (
            !confirm(`Delete "${selectedConfig?.name}"? This cannot be undone.`)
        )
            return;

        isDeleting = true;
        try {
            const res = await fetch(`/api/user/ai-configs/${selectedId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!res.ok) {
                const json = await res.json();
                return setFeedback("error", json.error ?? "Delete failed");
            }

            setFeedback("success", "Configuration deleted");
            await loadConfigs();
            // Reset to new-config form after deletion
            startNewConfig();
        } catch {
            setFeedback("error", "Network error — please try again");
        } finally {
            isDeleting = false;
        }
    }

    // ─── Form helpers ──────────────────────────────────────────────────────────

    /** Populate the form fields from a saved config */
    function selectConfig(id: string) {
        const cfg = configs.find((c) => c.id === id);
        if (!cfg) return;

        selectedId = id;
        isNew = false;
        formName = cfg.name;
        formProvider = cfg.provider;
        formModel = cfg.model;
        formApiKey = cfg.api_key_masked ?? ""; // Show mask; user replaces to update key
        formBaseUrl = cfg.base_url ?? "";
        formIsDefault = cfg.is_default;
        feedback = null;
    }

    /** Reset the form to blank for creating a new config */
    function startNewConfig() {
        selectedId = null;
        isNew = true;
        formName = "";
        formProvider = "deepseek";
        formModel = "";
        formApiKey = "";
        formBaseUrl = "";
        formIsDefault = false;
        feedback = null;
    }

    /** Show a dismissible feedback message */
    function setFeedback(type: "success" | "error", text: string) {
        feedback = { type, text };
    }

    /** Handle dropdown change — "new" sentinel value triggers blank form */
    function handleDropdownChange(e: Event) {
        const val = (e.currentTarget as HTMLSelectElement).value;
        if (val === "__new__") startNewConfig();
        else selectConfig(val);
    }
</script>

<!-- ─── Panel overlay ────────────────────────────────────────────────────── -->
<div
    class="fixed inset-0 z-40 flex items-start justify-end"
    role="dialog"
    aria-modal="true"
    aria-label="AI Settings"
>
    <!-- Dim backdrop -->
    <button
        class="absolute inset-0 bg-black/50"
        onclick={onClose}
        aria-label="Close settings"
        type="button"
    ></button>

    <!-- Panel -->
    <aside
        class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-primary/20 bg-background-dark shadow-2xl"
    >
        <!-- Header -->
        <div
            class="flex items-center justify-between border-b border-primary/10 bg-primary/5 px-6 py-4"
        >
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-primary"
                    >settings</span
                >
                <h2 class="text-lg font-bold tracking-tight">
                    AI Configuration
                </h2>
            </div>
            <button
                class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-primary/10 hover:text-primary"
                onclick={onClose}
                type="button"
                aria-label="Close"
            >
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6">
            {#if isLoading}
                <p class="text-center text-sm text-slate-500">
                    Loading configurations…
                </p>
            {:else}
                <!-- Config selector dropdown -->
                <div class="mb-6">
                    <label
                        class="mb-1 block px-1 text-xs font-bold uppercase tracking-widest text-primary"
                        for="config-select"
                    >
                        Active Configuration
                    </label>
                    <select
                        id="config-select"
                        class="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
                        onchange={handleDropdownChange}
                        value={isNew ? "__new__" : (selectedId ?? "__new__")}
                    >
                        {#each configs as cfg (cfg.id)}
                            <option value={cfg.id}>
                                {cfg.name}{cfg.is_default ? " ✦" : ""}
                            </option>
                        {/each}
                        <option value="__new__">＋ New Configuration</option>
                    </select>
                </div>

                <!-- Config form -->
                <form
                    class="space-y-4"
                    onsubmit={(e) => {
                        e.preventDefault();
                        void saveConfig();
                    }}
                >
                    <!-- Name -->
                    <div>
                        <label
                            class="mb-1 block px-1 text-xs font-bold uppercase tracking-widest text-primary"
                            for="cfg-name"
                        >
                            Name
                        </label>
                        <input
                            id="cfg-name"
                            class="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
                            type="text"
                            placeholder="e.g. My DeepSeek"
                            bind:value={formName}
                        />
                    </div>

                    <!-- Provider -->
                    <div>
                        <label
                            class="mb-1 block px-1 text-xs font-bold uppercase tracking-widest text-primary"
                            for="cfg-provider"
                        >
                            Provider
                        </label>
                        <select
                            id="cfg-provider"
                            class="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-slate-100 focus:border-primary focus:ring-1 focus:ring-primary"
                            bind:value={formProvider}
                        >
                            {#each PROVIDER_OPTIONS as p (p)}
                                <option value={p}
                                    >{PROVIDER_META[p].label}</option
                                >
                            {/each}
                        </select>
                    </div>

                    <!-- Model (free text) -->
                    <div>
                        <label
                            class="mb-1 block px-1 text-xs font-bold uppercase tracking-widest text-primary"
                            for="cfg-model"
                        >
                            Model
                        </label>
                        <input
                            id="cfg-model"
                            class="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
                            type="text"
                            placeholder="e.g. deepseek-chat, mistralai/mistral-7b-instruct"
                            bind:value={formModel}
                        />
                    </div>

                    <!-- API Key — treated like a password -->
                    <div>
                        <label
                            class="mb-1 block px-1 text-xs font-bold uppercase tracking-widest text-primary"
                            for="cfg-apikey"
                        >
                            API Key
                        </label>
                        <input
                            id="cfg-apikey"
                            class="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
                            type="password"
                            autocomplete="new-password"
                            placeholder={isNew
                                ? "Paste your API key"
                                : "Leave blank to keep existing key"}
                            bind:value={formApiKey}
                        />
                        <p class="mt-1 px-1 text-[10px] text-slate-500">
                            Keys are stored encrypted. The value is never sent
                            back to your browser.
                        </p>
                    </div>

                    <!-- Base URL — only shown for custom provider -->
                    {#if showBaseUrl}
                        <div>
                            <label
                                class="mb-1 block px-1 text-xs font-bold uppercase tracking-widest text-primary"
                                for="cfg-baseurl"
                            >
                                Base URL
                            </label>
                            <input
                                id="cfg-baseurl"
                                class="w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:border-primary focus:ring-1 focus:ring-primary"
                                type="url"
                                placeholder="https://your-api.example.com/v1"
                                bind:value={formBaseUrl}
                            />
                        </div>
                    {/if}

                    <!-- Set as default toggle -->
                    <label class="flex cursor-pointer items-center gap-3">
                        <input
                            class="size-5 rounded accent-primary"
                            type="checkbox"
                            bind:checked={formIsDefault}
                        />
                        <span class="text-sm text-slate-300"
                            >Set as active default</span
                        >
                    </label>

                    <!-- Feedback -->
                    {#if feedback}
                        <p
                            class={`rounded-xl px-4 py-3 text-sm font-medium ${feedback.type === "success" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                        >
                            {feedback.text}
                        </p>
                    {/if}

                    <!-- Action buttons -->
                    <div class="flex items-center gap-3 pt-2">
                        <button
                            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/80 active:scale-95 disabled:opacity-50"
                            type="submit"
                            disabled={isSaving}
                        >
                            <span class="material-symbols-outlined text-lg"
                                >save</span
                            >
                            {isSaving
                                ? "Saving…"
                                : isNew
                                  ? "Create"
                                  : "Save Changes"}
                        </button>

                        {#if !isNew && selectedId}
                            <button
                                class="rounded-xl border border-red-500/30 px-4 py-3 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                                type="button"
                                onclick={deleteConfig}
                                disabled={isDeleting}
                                aria-label="Delete configuration"
                            >
                                <span class="material-symbols-outlined"
                                    >delete</span
                                >
                            </button>
                        {/if}
                    </div>
                </form>
            {/if}
        </div>
    </aside>
</div>

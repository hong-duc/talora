/**
 * ai-providers.ts
 * Defines the known AI providers and their default base URLs.
 *
 * Why: Centralises provider metadata so the UI and the AI client
 * read from one source of truth instead of spreading magic strings.
 *
 * All providers expose an OpenAI-compatible REST API, so the same
 * fetch logic in ai-client.ts works for every entry here.
 */

import type { AiProvider } from './types';

// ─── Provider metadata ───────────────────────────────────────────────────────

export interface ProviderMeta {
    label: string;       // Human-readable name shown in the UI
    defaultBaseUrl: string; // Base URL used when the user hasn't overridden it
    requiresBaseUrl: boolean; // true → user MUST supply a URL (custom provider)
}

// Map each provider id to its metadata
export const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
    deepseek: {
        label: 'DeepSeek',
        defaultBaseUrl: 'https://api.deepseek.com/v1',
        requiresBaseUrl: false,
    },
    openrouter: {
        label: 'OpenRouter',
        defaultBaseUrl: 'https://openrouter.ai/api/v1',
        requiresBaseUrl: false,
    },
    langdb: {
        label: 'LangDB',
        defaultBaseUrl: 'https://api.langdb.ai/v1',
        requiresBaseUrl: false,
    },
    custom: {
        label: 'Custom / Self-hosted',
        defaultBaseUrl: '',
        requiresBaseUrl: true, // No sensible default — user must specify
    },
};

// Ordered list of providers for dropdown rendering
export const PROVIDER_OPTIONS: AiProvider[] = [
    'deepseek',
    'openrouter',
    'langdb',
    'custom',
];

/**
 * Resolve the base URL to use for a given provider + optional user override.
 * Throws if a custom provider has no base_url.
 */
export function resolveBaseUrl(provider: AiProvider, userBaseUrl?: string): string {
    const url = userBaseUrl?.trim() || PROVIDER_META[provider].defaultBaseUrl;

    if (!url) {
        throw new Error(
            `Provider "${provider}" requires a base_url. ` +
            'Please configure one in your AI settings.'
        );
    }

    return url;
}

/**
 * ai-client.ts
 * Calls any OpenAI-compatible AI backend to generate a story reply.
 *
 * Why: All supported providers (DeepSeek, OpenRouter, LangDB, custom)
 * expose the same /chat/completions endpoint format, so one client works
 * for all of them — only the base URL and API key differ.
 *
 * How:
 *  1. Build a system prompt from the story's metadata (setting, tone, characters…)
 *  2. Convert the stored messages into the OpenAI message format
 *  3. POST to <baseUrl>/chat/completions
 *  4. Return the assistant's reply text
 */

import type { Message, Story, SceneState } from './types';
import { resolveBaseUrl } from './ai-providers';
import type { AiProvider } from './types';

// ─── Types used internally by this module ────────────────────────────────────

/** Minimal shape of a resolved AI config needed to make a call */
export interface ResolvedAiConfig {
    provider: AiProvider;
    model: string;
    apiKey: string;      // decrypted plaintext — only passed server-side
    baseUrl?: string;    // optional user override
}

/** A single OpenAI-format chat message */
interface OaiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ─── System prompt builder ────────────────────────────────────────────────────

/**
 * Build the system prompt that shapes the AI's persona and story context.
 * Injects story setting, tone, characters, world rules, and lore.
 */
function buildSystemPrompt(story: Story, sceneState?: SceneState): string {
    const lines: string[] = [
        'You are an interactive storytelling AI. Stay in character and advance the story.',
        '',
        `Story: "${story.title}"`,
    ];

    if (story.description) lines.push(`Synopsis: ${story.description}`);
    if (story.setting) lines.push(`Setting: ${story.setting}`);
    if (story.tone?.length) lines.push(`Tone: ${story.tone.join(', ')}`);
    if (story.world_rules) lines.push(`World rules: ${story.world_rules}`);
    if (story.lore) lines.push(`Lore: ${story.lore}`);

    // Characters
    if (story.characters?.length) {
        lines.push('', 'Characters:');
        for (const c of story.characters) {
            const parts = [c.name];
            if (c.description) parts.push(c.description);
            if (c.personality) parts.push(`Personality: ${c.personality}`);
            lines.push(`- ${parts.join(' — ')}`);
        }
    }

    // Inject current scene context if available
    if (sceneState) {
        lines.push('', 'Current scene context:');
        if (sceneState.current_location) lines.push(`Location: ${sceneState.current_location}`);
        if (sceneState.current_situation) lines.push(`Situation: ${sceneState.current_situation}`);
        if (sceneState.summary) lines.push(`Story so far: ${sceneState.summary}`);
    }

    // Style guidance derived from story settings
    const desc = story.descriptiveness ?? 3;
    const pacing = story.pacing ?? 'medium';
    const intensity = story.emotional_intensity ?? 3;

    lines.push(
        '',
        `Style: descriptiveness ${desc}/5, pacing ${pacing}, emotional intensity ${intensity}/5.`,
        'Keep responses concise unless drama warrants longer prose.',
    );

    return lines.join('\n');
}

/**
 * Convert the stored Message array into the OpenAI chat message format.
 * We prepend the system prompt as the first message.
 */
function buildMessageHistory(
    messages: Message[],
    systemPrompt: string
): OaiMessage[] {
    const history: OaiMessage[] = [{ role: 'system', content: systemPrompt }];

    for (const msg of messages) {
        history.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
        });
    }

    return history;
}

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Call the AI provider and return the assistant's reply text.
 *
 * @param history   All messages from the session so far (including the new user message)
 * @param story     The story record — used to build the system prompt
 * @param config    The resolved AI config (provider, model, decrypted key, base_url)
 * @param sceneState Optional current scene state for richer context
 */
export async function generateReply(
    history: Message[],
    story: Story,
    config: ResolvedAiConfig,
    sceneState?: SceneState
): Promise<string> {
    const baseUrl = resolveBaseUrl(config.provider, config.baseUrl);
    const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

    const systemPrompt = buildSystemPrompt(story, sceneState);
    const messages = buildMessageHistory(history, systemPrompt);

    const body = {
        model: config.model,
        messages,
        max_tokens: 800,
        temperature: 0.9,  // Higher creativity for storytelling
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`AI provider returned ${response.status}: ${errText}`);
    }

    const json = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };

    const reply = json.choices?.[0]?.message?.content;
    if (!reply) throw new Error('AI provider returned an empty response');

    return reply.trim();
}

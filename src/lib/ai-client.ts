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
    apiKey: string;       // decrypted plaintext — only passed server-side
    baseUrl?: string;     // optional user override
    // Generation parameter overrides — if not set the defaults below are used
    maxTokens?: number;   // default: 800
    temperature?: number; // default: 0.9
    topP?: number;        // default: not sent (provider default)
    topK?: number;        // default: not sent (provider default)
}

/** A single OpenAI-format chat message */
interface OaiMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ─── System prompt builder ────────────────────────────────────────────────────

/**
 * Build the system prompt that shapes the AI's persona and story context.
 *
 * Injects: setting, tone, world rules, lore, characters and scene state.
 *
 * Style section branches on story.auto_style:
 *  – true  (default) → tell the AI to infer style from tone + setting
 *  – false           → provide explicit numeric style parameters
 */
function buildSystemPrompt(story: Story, sceneState?: SceneState): string {
    const lines: string[] = [
        'You are an interactive storytelling AI.',
        'Your role is to narrate and advance an immersive story.',
        'Stay in character at all times. Respond only with story content — never break the fourth wall or explain your reasoning.',
        '',
        `━━ STORY: "${story.title}" ━━`,
    ];

    if (story.description) {
        lines.push('', `Synopsis: ${story.description}`);
    }

    if (story.setting) {
        lines.push('', '━━ SETTING ━━', story.setting);
    }

    if (story.tone?.length) {
        lines.push('', `Tone: ${story.tone.join(', ')}`);
    }

    if (story.world_rules) {
        lines.push('', '━━ WORLD RULES ━━', story.world_rules);
    }

    if (story.lore) {
        lines.push('', '━━ LORE ━━', story.lore);
    }

    // Characters
    if (story.characters?.length) {
        lines.push('', '━━ CHARACTERS ━━');
        for (const c of story.characters) {
            lines.push(`• ${c.name}`);
            if (c.description) lines.push(`  Description: ${c.description}`);
            if (c.personality) lines.push(`  Personality: ${c.personality}`);
        }
    }

    // Current scene context injected from scene_states table
    if (sceneState) {
        lines.push('', '━━ CURRENT SCENE ━━');
        if (sceneState.current_location) lines.push(`Location: ${sceneState.current_location}`);
        if (sceneState.current_situation) lines.push(`Situation: ${sceneState.current_situation}`);
        if (sceneState.summary) lines.push(`Story so far: ${sceneState.summary}`);
    }

    // ── Style section ────────────────────────────────────────────────────────
    lines.push('', '━━ WRITING STYLE ━━');

    if (story.auto_style !== false) {
        // auto_style = true (or not explicitly set): let the AI infer the style
        lines.push(
            'Automatically infer the appropriate writing style — descriptiveness, pacing,',
            'dialogue density, and emotional intensity — from the tone and setting described above.',
            'Adapt dynamically as each scene evolves:',
            '  • Slow and atmospheric during exploration or introspection',
            '  • Terse and punchy during action or conflict',
            '  • Warm and flowing during emotional or intimate moments',
        );
    } else {
        // auto_style = false: honour the author-specified numeric parameters
        const desc = story.descriptiveness ?? 3;
        const dialogueRatio = story.dialogue_ratio ?? 3;
        const pacing = story.pacing ?? 'medium';
        const intensity = story.emotional_intensity ?? 3;

        lines.push(
            'Follow these author-specified parameters consistently:',
            `• Descriptiveness:    ${desc}/5  — ${descHint(desc)}`,
            `• Dialogue ratio:     ${dialogueRatio}/5  — ${dialogueHint(dialogueRatio)}`,
            `• Pacing:             ${pacing}  — ${pacingHint(pacing)}`,
            `• Emotional intensity:${intensity}/5  — ${intensityHint(intensity)}`,
        );
    }

    return lines.join('\n');
}

// ─── Style hint helpers ───────────────────────────────────────────────────────

function descHint(v: number): string {
    const hints = [
        'very sparse, minimal prose',
        'light description',
        'moderate, balanced description',
        'rich and detailed prose',
        'highly immersive, lush and expansive prose',
    ];
    return hints[Math.min(Math.max(Math.round(v) - 1, 0), 4)];
}

function dialogueHint(v: number): string {
    const hints = [
        'almost no dialogue — pure narration',
        'sparse dialogue',
        'balanced narration and dialogue',
        'dialogue-heavy',
        'dialogue-dominant, rapid back-and-forth',
    ];
    return hints[Math.min(Math.max(Math.round(v) - 1, 0), 4)];
}

function pacingHint(p: string): string {
    if (p === 'slow') return 'linger on details, build atmosphere gradually';
    if (p === 'fast') return 'keep momentum, cut quickly to the next beat';
    return 'balanced flow between action and reflection';
}

function intensityHint(v: number): string {
    const hints = [
        'calm and subdued',
        'mild emotional undertones',
        'moderate emotional depth',
        'emotionally charged and vivid',
        'highly dramatic, intense, passionate',
    ];
    return hints[Math.min(Math.max(Math.round(v) - 1, 0), 4)];
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

    // Build request body — honour per-config overrides, fall back to good defaults
    const body: Record<string, unknown> = {
        model: config.model,
        messages,
        max_tokens: config.maxTokens ?? 800,
        temperature: config.temperature ?? 0.9,  // Higher creativity for storytelling
    };
    if (config.topP !== undefined) body.top_p = config.topP;
    if (config.topK !== undefined) body.top_k = config.topK;

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

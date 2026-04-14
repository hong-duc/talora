-- ============================================================
-- Migration 001 — Add features: generation_params, tagline
-- Run this once against your Supabase database.
-- ============================================================

-- 1. generation_params on ai_configs
--    Stores optional AI generation overrides per config:
--    { max_tokens, temperature, top_p, top_k }
ALTER TABLE public.ai_configs
    ADD COLUMN IF NOT EXISTS generation_params JSONB DEFAULT '{}'::jsonb;

-- 2. tagline on stories (short one-liner shown below the title)
ALTER TABLE public.stories
    ADD COLUMN IF NOT EXISTS tagline TEXT;

-- 3. RLS for messages: allow owner of the session to update and delete rows
CREATE POLICY IF NOT EXISTS "messages: session owner can insert"
    ON public.messages FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.story_sessions ss
            WHERE ss.id = session_id AND ss.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "messages: session owner can select"
    ON public.messages FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.story_sessions ss
            WHERE ss.id = session_id AND ss.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "messages: session owner can update"
    ON public.messages FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.story_sessions ss
            WHERE ss.id = session_id AND ss.user_id = auth.uid()
        )
    );

CREATE POLICY IF NOT EXISTS "messages: session owner can delete"
    ON public.messages FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.story_sessions ss
            WHERE ss.id = session_id AND ss.user_id = auth.uid()
        )
    );

-- 4. RLS for story_sessions: allow owner to delete their sessions
CREATE POLICY IF NOT EXISTS "story_sessions: owner can delete"
    ON public.story_sessions FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- Migration 002: Replace is_public (boolean) with status (story_status enum)
--
-- The story_status enum was already created in the schema:
--   CREATE TYPE public.story_status AS ENUM ('draft', 'public', 'private', 'deleted');
--
-- Data mapping:
--   is_public = true  → status = 'public'
--   is_public = false → status = 'draft'   (never published = still a draft)
-- ============================================================================

-- Step 1: Add the status column (enum already exists).
--         Use IF NOT EXISTS to make the migration safe to re-run.
ALTER TABLE public.stories
    ADD COLUMN IF NOT EXISTS status public.story_status DEFAULT 'draft';

-- Step 2: Back-fill status from the old boolean column.
UPDATE public.stories
    SET status = CASE
        WHEN is_public = TRUE THEN 'public'::public.story_status
        ELSE                       'draft'::public.story_status
    END;

-- Step 3: Remove the now-redundant is_public column.
ALTER TABLE public.stories
    DROP COLUMN IF EXISTS is_public;

-- Step 4: (Optional) The soft_delete_story() trigger function already
--         references the status column, so it will now work correctly
--         without any further changes.

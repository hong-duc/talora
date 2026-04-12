--
-- PostgreSQL database dump
--

\restrict nQrMY6HLfEq841DF7XsdDSgjLtIYWAkmSFnSmqCRDgsVodg2KgVgeZLw9HST51k

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: story_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.story_status AS ENUM (
    'draft',
    'public',
    'private',
    'deleted'
);


ALTER TYPE public.story_status OWNER TO postgres;

--
-- Name: decrease_tag_usage(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.decrease_tag_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

UPDATE tags
SET usage_count = usage_count - 1
WHERE id = OLD.tag_id;

RETURN OLD;

END;
$$;


ALTER FUNCTION public.decrease_tag_usage() OWNER TO postgres;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name'
  );

  return new;
end;
$$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- Name: increase_tag_usage(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increase_tag_usage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

UPDATE tags
SET usage_count = usage_count + 1
WHERE id = NEW.tag_id;

RETURN NEW;

END;
$$;


ALTER FUNCTION public.increase_tag_usage() OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- Name: soft_delete_story(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.soft_delete_story() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE stories
    SET status = 'deleted'
    WHERE id = OLD.id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.soft_delete_story() OWNER TO postgres;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION public.update_updated_at() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: characters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid,
    name character varying(255) NOT NULL,
    description text,
    personality text,
    avatar_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.characters OWNER TO postgres;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid,
    user_id uuid,
    parent_id uuid,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- Name: messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.messages OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username character varying(50),
    avatar_url text,
    bio text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: scene_states; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scene_states (
    session_id uuid NOT NULL,
    summary text,
    current_location text,
    current_situation text,
    last_mode text,
    last_intensity integer,
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT scene_states_last_mode_check CHECK ((last_mode = ANY (ARRAY['character'::text, 'narrator'::text, 'hybrid'::text])))
);


ALTER TABLE public.scene_states OWNER TO postgres;

--
-- Name: stories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid,
    title text NOT NULL,
    description text,
    setting text,
    tone text[],
    world_rules text,
    descriptiveness integer DEFAULT 3,
    dialogue_ratio integer DEFAULT 3,
    pacing text DEFAULT 'medium'::text,
    emotional_intensity integer DEFAULT 3,
    auto_style boolean DEFAULT true,
    is_public boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    characters jsonb,
    lore text,
    cover_image_url text,
    CONSTRAINT stories_descriptiveness_check CHECK (((descriptiveness >= 1) AND (descriptiveness <= 5))),
    CONSTRAINT stories_dialogue_ratio_check CHECK (((dialogue_ratio >= 1) AND (dialogue_ratio <= 5))),
    CONSTRAINT stories_emotional_intensity_check CHECK (((emotional_intensity >= 1) AND (emotional_intensity <= 5))),
    CONSTRAINT stories_pacing_check CHECK ((pacing = ANY (ARRAY['slow'::text, 'medium'::text, 'fast'::text])))
);


ALTER TABLE public.stories OWNER TO postgres;

--
-- Name: COLUMN stories.cover_image_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.stories.cover_image_url IS 'url to the cover image of the story';


--
-- Name: story_characters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_characters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid,
    character_id uuid,
    role character varying(100)
);


ALTER TABLE public.story_characters OWNER TO postgres;

--
-- Name: story_ratings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_ratings (
    story_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT story_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.story_ratings OWNER TO postgres;

--
-- Name: story_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid NOT NULL,
    user_id uuid,
    title text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    start_id uuid
);


ALTER TABLE public.story_sessions OWNER TO postgres;

--
-- Name: story_starts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_starts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id uuid NOT NULL,
    title character varying(150) NOT NULL,
    first_message text NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.story_starts OWNER TO postgres;

--
-- Name: story_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.story_tags (
    story_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.story_tags OWNER TO postgres;

--
-- Name: tag_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alias text NOT NULL,
    tag_id uuid NOT NULL
);


ALTER TABLE public.tag_aliases OWNER TO postgres;

--
-- Name: tag_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tag_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    color text
);


ALTER TABLE public.tag_categories OWNER TO postgres;

--
-- Name: COLUMN tag_categories.color; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tag_categories.color IS 'tag color under this category';


--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    category_id uuid,
    is_official boolean DEFAULT false,
    created_by uuid,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: characters characters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: scene_states scene_states_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_states
    ADD CONSTRAINT scene_states_pkey PRIMARY KEY (session_id);


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


--
-- Name: story_characters story_characters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_characters
    ADD CONSTRAINT story_characters_pkey PRIMARY KEY (id);


--
-- Name: story_ratings story_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_ratings
    ADD CONSTRAINT story_ratings_pkey PRIMARY KEY (story_id, user_id);


--
-- Name: story_sessions story_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_sessions
    ADD CONSTRAINT story_sessions_pkey PRIMARY KEY (id);


--
-- Name: story_starts story_starts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_starts
    ADD CONSTRAINT story_starts_pkey PRIMARY KEY (id);


--
-- Name: story_tags story_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_tags
    ADD CONSTRAINT story_tags_pkey PRIMARY KEY (story_id, tag_id);


--
-- Name: tag_aliases tag_aliases_alias_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_aliases
    ADD CONSTRAINT tag_aliases_alias_key UNIQUE (alias);


--
-- Name: tag_aliases tag_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_aliases
    ADD CONSTRAINT tag_aliases_pkey PRIMARY KEY (id);


--
-- Name: tag_categories tag_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_categories
    ADD CONSTRAINT tag_categories_name_key UNIQUE (name);


--
-- Name: tag_categories tag_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_categories
    ADD CONSTRAINT tag_categories_pkey PRIMARY KEY (id);


--
-- Name: tags tags_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_name_key UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_slug_key UNIQUE (slug);


--
-- Name: idx_comments_story; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_comments_story ON public.comments USING btree (story_id);


--
-- Name: idx_messages_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_messages_session ON public.messages USING btree (session_id);


--
-- Name: idx_sessions_story; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_story ON public.story_sessions USING btree (story_id);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_user ON public.story_sessions USING btree (user_id);


--
-- Name: idx_story_characters_story; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_story_characters_story ON public.story_characters USING btree (story_id);


--
-- Name: idx_story_starts_story; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_story_starts_story ON public.story_starts USING btree (story_id);


--
-- Name: idx_story_tags_tag; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_story_tags_tag ON public.story_tags USING btree (tag_id);


--
-- Name: idx_tags_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tags_slug ON public.tags USING btree (slug);


--
-- Name: story_tags tag_usage_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tag_usage_trigger AFTER INSERT ON public.story_tags FOR EACH ROW EXECUTE FUNCTION public.increase_tag_usage();


--
-- Name: story_tags trigger_decrease_tag_usage; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_decrease_tag_usage AFTER DELETE ON public.story_tags FOR EACH ROW EXECUTE FUNCTION public.decrease_tag_usage();


--
-- Name: story_tags trigger_increase_tag_usage; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_increase_tag_usage AFTER INSERT ON public.story_tags FOR EACH ROW EXECUTE FUNCTION public.increase_tag_usage();


--
-- Name: story_sessions update_session_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_session_updated_at BEFORE UPDATE ON public.story_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: stories update_stories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: characters characters_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characters
    ADD CONSTRAINT characters_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.story_sessions(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: scene_states scene_states_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scene_states
    ADD CONSTRAINT scene_states_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.story_sessions(id) ON DELETE CASCADE;


--
-- Name: stories stories_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: story_characters story_characters_character_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_characters
    ADD CONSTRAINT story_characters_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;


--
-- Name: story_ratings story_ratings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_ratings
    ADD CONSTRAINT story_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: story_sessions story_sessions_start_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_sessions
    ADD CONSTRAINT story_sessions_start_fk FOREIGN KEY (start_id) REFERENCES public.story_starts(id) ON DELETE SET NULL;


--
-- Name: story_sessions story_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_sessions
    ADD CONSTRAINT story_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: story_starts story_starts_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_starts
    ADD CONSTRAINT story_starts_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE SET NULL;


--
-- Name: story_tags story_tags_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_tags
    ADD CONSTRAINT story_tags_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE SET NULL;


--
-- Name: story_tags story_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.story_tags
    ADD CONSTRAINT story_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: tag_aliases tag_aliases_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tag_aliases
    ADD CONSTRAINT tag_aliases_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;


--
-- Name: tags tags_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.tag_categories(id) ON DELETE SET NULL;


--
-- Name: tags tags_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: characters Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.characters FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: comments Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.comments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: profiles Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: stories Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.stories FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: story_characters Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.story_characters FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: story_starts Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.story_starts FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: story_tags Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.story_tags FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: tags Enable insert for authenticated users only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable insert for authenticated users only" ON public.tags FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: characters Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.characters FOR SELECT USING (true);


--
-- Name: comments Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.comments FOR SELECT USING (true);


--
-- Name: profiles Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.profiles FOR SELECT USING (true);


--
-- Name: stories Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.stories FOR SELECT USING (true);


--
-- Name: story_characters Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.story_characters FOR SELECT USING (true);


--
-- Name: story_starts Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.story_starts FOR SELECT USING (true);


--
-- Name: story_tags Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.story_tags FOR SELECT USING (true);


--
-- Name: tag_aliases Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.tag_aliases FOR SELECT USING (true);


--
-- Name: tag_categories Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.tag_categories FOR SELECT USING (true);


--
-- Name: tags Enable read access for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable read access for all users" ON public.tags FOR SELECT USING (true);


--
-- Name: story_starts allow delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "allow delete" ON public.story_starts FOR DELETE USING (true);


--
-- Name: story_tags allow delete; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "allow delete" ON public.story_tags FOR DELETE USING (true);


--
-- Name: stories allow delete for author only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "allow delete for author only" ON public.stories FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = author_id));


--
-- Name: story_starts allow update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "allow update" ON public.story_starts FOR UPDATE USING (true);


--
-- Name: stories allow update for author only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "allow update for author only" ON public.stories FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = author_id));


--
-- Name: characters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: scene_states; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.scene_states ENABLE ROW LEVEL SECURITY;

--
-- Name: stories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

--
-- Name: story_characters; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.story_characters ENABLE ROW LEVEL SECURITY;

--
-- Name: story_ratings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.story_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: story_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.story_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: story_starts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.story_starts ENABLE ROW LEVEL SECURITY;

--
-- Name: story_tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.story_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: tag_aliases; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tag_aliases ENABLE ROW LEVEL SECURITY;

--
-- Name: tag_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tag_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: tags; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION decrease_tag_usage(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.decrease_tag_usage() TO anon;
GRANT ALL ON FUNCTION public.decrease_tag_usage() TO authenticated;
GRANT ALL ON FUNCTION public.decrease_tag_usage() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION increase_tag_usage(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.increase_tag_usage() TO anon;
GRANT ALL ON FUNCTION public.increase_tag_usage() TO authenticated;
GRANT ALL ON FUNCTION public.increase_tag_usage() TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION soft_delete_story(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.soft_delete_story() TO anon;
GRANT ALL ON FUNCTION public.soft_delete_story() TO authenticated;
GRANT ALL ON FUNCTION public.soft_delete_story() TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE characters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.characters TO anon;
GRANT ALL ON TABLE public.characters TO authenticated;
GRANT ALL ON TABLE public.characters TO service_role;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comments TO anon;
GRANT ALL ON TABLE public.comments TO authenticated;
GRANT ALL ON TABLE public.comments TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE scene_states; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.scene_states TO anon;
GRANT ALL ON TABLE public.scene_states TO authenticated;
GRANT ALL ON TABLE public.scene_states TO service_role;


--
-- Name: TABLE stories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.stories TO anon;
GRANT ALL ON TABLE public.stories TO authenticated;
GRANT ALL ON TABLE public.stories TO service_role;


--
-- Name: TABLE story_characters; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.story_characters TO anon;
GRANT ALL ON TABLE public.story_characters TO authenticated;
GRANT ALL ON TABLE public.story_characters TO service_role;


--
-- Name: TABLE story_ratings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.story_ratings TO anon;
GRANT ALL ON TABLE public.story_ratings TO authenticated;
GRANT ALL ON TABLE public.story_ratings TO service_role;


--
-- Name: TABLE story_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.story_sessions TO anon;
GRANT ALL ON TABLE public.story_sessions TO authenticated;
GRANT ALL ON TABLE public.story_sessions TO service_role;


--
-- Name: TABLE story_starts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.story_starts TO anon;
GRANT ALL ON TABLE public.story_starts TO authenticated;
GRANT ALL ON TABLE public.story_starts TO service_role;


--
-- Name: TABLE story_tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.story_tags TO anon;
GRANT ALL ON TABLE public.story_tags TO authenticated;
GRANT ALL ON TABLE public.story_tags TO service_role;


--
-- Name: TABLE tag_aliases; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tag_aliases TO anon;
GRANT ALL ON TABLE public.tag_aliases TO authenticated;
GRANT ALL ON TABLE public.tag_aliases TO service_role;


--
-- Name: TABLE tag_categories; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tag_categories TO anon;
GRANT ALL ON TABLE public.tag_categories TO authenticated;
GRANT ALL ON TABLE public.tag_categories TO service_role;


--
-- Name: TABLE tags; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tags TO anon;
GRANT ALL ON TABLE public.tags TO authenticated;
GRANT ALL ON TABLE public.tags TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict nQrMY6HLfEq841DF7XsdDSgjLtIYWAkmSFnSmqCRDgsVodg2KgVgeZLw9HST51k


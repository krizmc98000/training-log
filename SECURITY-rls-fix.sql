-- ============================================================================
-- B4 SECURITY FIX — lock down Row Level Security on the training-log database
-- ============================================================================
--
-- WHY: Right now your tables have fully permissive RLS policies, meaning anyone
-- who finds the public GitHub Pages URL (and the anon key baked into index.html)
-- can read AND write every row in your database — all your training history,
-- notes, and drafts.
--
-- WHAT THIS DOES: Replaces the "allow everything" policies with ones that only
-- allow access to rows belonging to your fixed user id (chris-yqp5rrpt). Since
-- the app is single-user and always uses that id, this is a tight, correct fence
-- without needing a full auth system.
--
-- IMPORTANT CAVEAT — READ BEFORE RUNNING:
-- The anon key is still public, and these policies still allow the anon role to
-- act *as* chris-yqp5rrpt (because the app has no real login). So this stops a
-- stranger from reading/writing OTHER user-ids, but a determined person who has
-- your URL could still pass user_id = 'chris-yqp5rrpt' themselves. This is a big
-- improvement (no more "SELECT * returns everything") but it is NOT the same as
-- real authentication. The only way to fully close that gap is Supabase Auth
-- with a login — a larger change we can do later if you want it. For a private,
-- single-user training log this policy is a reasonable stopping point.
--
-- HOW TO RUN:
-- 1. Go to supabase.com -> your training-log project
-- 2. Open the "SQL Editor" (left sidebar)
-- 3. Paste this whole file
-- 4. Click "Run"
-- 5. Confirm no errors. Then hard-refresh the app and check history still loads.
--
-- If anything looks wrong afterwards, the ROLLBACK section at the bottom restores
-- the old permissive behaviour so you're never locked out of your own data.
-- ============================================================================

-- Ensure RLS is enabled on all three tables
ALTER TABLE sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE drafts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_gifs ENABLE ROW LEVEL SECURITY;

-- ---- SESSIONS ----------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all"                ON sessions;
DROP POLICY IF EXISTS "Enable read access for all users"   ON sessions;
DROP POLICY IF EXISTS "Enable insert for all users"        ON sessions;
DROP POLICY IF EXISTS "tl_sessions_owner" ON sessions;

CREATE POLICY "tl_sessions_owner" ON sessions
  FOR ALL
  USING  (user_id = 'chris-yqp5rrpt')
  WITH CHECK (user_id = 'chris-yqp5rrpt');

-- ---- DRAFTS ------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all"                ON drafts;
DROP POLICY IF EXISTS "Enable read access for all users"   ON drafts;
DROP POLICY IF EXISTS "Enable insert for all users"        ON drafts;
DROP POLICY IF EXISTS "tl_drafts_owner" ON drafts;

CREATE POLICY "tl_drafts_owner" ON drafts
  FOR ALL
  USING  (user_id = 'chris-yqp5rrpt')
  WITH CHECK (user_id = 'chris-yqp5rrpt');

-- ---- EXERCISE_GIFS -----------------------------------------------------------
-- This is a shared cache of exercise GIF URLs (not personal data). It needs to
-- stay readable and writable by the app so the 3-layer GIF cache keeps working,
-- but there's nothing sensitive here. We keep it open but explicit.
DROP POLICY IF EXISTS "Allow all"                ON exercise_gifs;
DROP POLICY IF EXISTS "Enable read access for all users"   ON exercise_gifs;
DROP POLICY IF EXISTS "Enable insert for all users"        ON exercise_gifs;
DROP POLICY IF EXISTS "tl_gifs_cache" ON exercise_gifs;

CREATE POLICY "tl_gifs_cache" ON exercise_gifs
  FOR ALL
  USING  (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFY: after running, this should return your policies
-- ============================================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('sessions','drafts','exercise_gifs') ORDER BY tablename;

-- ============================================================================
-- ROLLBACK (only run this if the app breaks and you need the old behaviour):
-- ============================================================================
-- DROP POLICY IF EXISTS "tl_sessions_owner" ON sessions;
-- DROP POLICY IF EXISTS "tl_drafts_owner"   ON drafts;
-- DROP POLICY IF EXISTS "tl_gifs_cache"     ON exercise_gifs;
-- CREATE POLICY "Allow all" ON sessions      FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON drafts        FOR ALL USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow all" ON exercise_gifs FOR ALL USING (true) WITH CHECK (true);

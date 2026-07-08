-- ============================================================================
-- CLAUDE PT CHAT BACKUP TABLE
-- ============================================================================
--
-- WHY: The Claude PT chat used to live only in the browser's localStorage, which
-- iOS wipes whenever you delete/reinstall the home-screen app (the same event
-- that reset your week counter and cleared your user id). This table gives the
-- chat the same cloud durability your workout sessions already have.
--
-- WHAT IT STORES: One row per user, holding the whole conversation as JSON. The
-- app upserts the trailing 200 messages on a debounce and restores them on load.
--
-- HOW TO RUN:
-- 1. Go to supabase.com -> your training-log project
-- 2. Open the "SQL Editor"
-- 3. Paste this whole file and click "Run"
-- 4. Hard-refresh the app. From then on the chat survives reinstalls.
--
-- Run this BEFORE deploying the new index.html, or the first few chat messages
-- after deploy will silently fail to back up (they'll still show locally, and
-- will back up fine once the table exists).
-- ============================================================================

CREATE TABLE IF NOT EXISTS pt_chat (
  user_id     text PRIMARY KEY,
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pt_chat ENABLE ROW LEVEL SECURITY;

-- Match the same owner-scoped policy used on sessions/drafts (see SECURITY-rls-fix.sql).
-- Only rows belonging to the fixed single user are readable/writable.
DROP POLICY IF EXISTS "tl_pt_chat_owner" ON pt_chat;
CREATE POLICY "tl_pt_chat_owner" ON pt_chat
  FOR ALL
  USING  (user_id = 'chris-yqp5rrpt')
  WITH CHECK (user_id = 'chris-yqp5rrpt');

-- ============================================================================
-- VERIFY (optional):
-- SELECT user_id, jsonb_array_length(messages) AS message_count, updated_at
-- FROM pt_chat;
-- ============================================================================

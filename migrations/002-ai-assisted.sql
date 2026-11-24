-- =====================================================================
-- MIGRATION 002: posts.ai_assisted ("AI-assisted" label)
-- ---------------------------------------------------------------------
-- AI draft approve hoke jo post banti hai, uspe ai_assisted = 1 lagta hai. Post page pe title ke neeche
-- "AI-assisted · Reviewed by <admin>" dikhta hai. Normal (insaan ki likhi) posts pe 0, koi label nahi.
--
-- ORDER ZAROORI: ye migration code deploy hone se PEHLE chalao. Naya approve code is column me likhta hai,
-- column na ho to Approve button error dega.
--   mysql -h <host> -P <port> -u <user> -p --ssl-mode=REQUIRED <db> < migrations/002-ai-assisted.sql
-- Backward-compatible: purani sab posts ko DEFAULT 0 milta hai, koi data nahi badalta.
-- =====================================================================

ALTER TABLE `posts` ADD COLUMN `ai_assisted` tinyint(1) NOT NULL DEFAULT 0;

-- Phase 1 me (is column se pehle) jo AI drafts approve ho chuke the, unki posts pe bhi label laga do.
UPDATE `posts` SET `ai_assisted` = 1
WHERE `id` IN (SELECT `post_id` FROM `ai_drafts` WHERE `status` = 'approved' AND `post_id` IS NOT NULL);

-- ---------------------------------------------------------------------
-- DOWN (undo):
--   ALTER TABLE `posts` DROP COLUMN `ai_assisted`;
-- ---------------------------------------------------------------------

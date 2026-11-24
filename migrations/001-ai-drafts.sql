-- =====================================================================
-- MIGRATION 001: AI drafts (admin review queue)
-- ---------------------------------------------------------------------
-- Kya karta hai: AI se generate hui posts pehle yahan `ai_drafts` table me "pending" banke aati hain.
-- Admin /admin/ai-posts pe unhe padhta hai, edit karta hai, aur Approve ya Reject karta hai.
--   Approve -> `posts` me nayi row banti hai (author_id = approve karne wala admin), draft "approved" ho jata hai.
--   Reject  -> draft "rejected" ho jata hai, site pe kabhi nahi dikhta (delete nahi hota, record ke liye rehta hai).
--
-- Alag table kyu (posts me `status` column kyu nahi)?
--   Agar drafts `posts` me hote to site ki HAR query (list, detail, likes) me `WHERE status = 'published'` lagana padta.
--   Ek jagah bhi bhoole to unapproved post public. Alag table me ye galti ho hi nahi sakti, aur posts ka code nahi badla.
--
-- Kaise chalana hai:
--   UP   (table banao)  : neeche wala CREATE TABLE chalao.  mysql -u <user> -p <db_name> < migrations/001-ai-drafts.sql
--   DOWN (undo / hatao) : file ke end me commented DROP TABLE hai, use alag se chalao.
-- Backward-compatible hai: koi purani table / column nahi badalta.
-- =====================================================================

CREATE TABLE IF NOT EXISTS `ai_drafts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `summary` varchar(255) NOT NULL,
  `body` text NOT NULL,
  -- Post kin sources se bani (ek line = ek link/source). Approve pe body ke end me "Sources" section ban ke judta hai.
  `sources` text DEFAULT NULL,
  -- AI ne kis topic pe likha. Aage (Phase 2) duplicate topic rokne ke kaam aayega.
  `topic` varchar(255) DEFAULT NULL,
  `status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  -- Reject karte waqt admin ka optional reason. Phase 2 me AI ki quality sudharne ke kaam aayega.
  `reject_reason` varchar(500) DEFAULT NULL,
  -- Kis admin ne approve/reject kiya, kab kiya.
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  -- Approve hone pe bani post ka id. Post baad me delete ho jaye to ye NULL ho jata hai (draft ka record bacha rehta hai).
  `post_id` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Admin portal "status = pending, naye pehle" se list karta hai, ye index usi query ke liye.
  KEY `ai_drafts_status_created` (`status`, `created_at`),
  KEY `ai_drafts_reviewed_by` (`reviewed_by`),
  KEY `ai_drafts_post_id` (`post_id`),
  CONSTRAINT `ai_drafts_reviewer_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `authors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `ai_drafts_post_fk` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- DOWN (undo). Sirf tab chalana jab ye feature poora hatana ho. Saare AI drafts ka data chala jayega.
-- Jo posts approve hoke `posts` me ban chuki hain wo bachi rahengi (wo normal admin posts hain).
--   DROP TABLE IF EXISTS `ai_drafts`;
-- ---------------------------------------------------------------------

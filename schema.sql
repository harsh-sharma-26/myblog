-- [FIX #10] Database dobara banana ho to ye SQL chala do.
-- Ye schema asli Aiven DB ke `SHOW CREATE TABLE` output se liya gaya hai (2026-10-17), andaze se nahi.
-- authors pehle banana zaruri hai kyunki posts uska foreign key use karta hai.
--
-- ============================================================
-- QUOTES (" vs `) KA CHAKKAR -- future me confuse mat hona
-- ============================================================
-- Aiven ne jo `SHOW CREATE TABLE` diya usme naam double quotes me the, jaise "posts", "id".
-- Wajah: Aiven ka MySQL "ANSI_QUOTES" mode me chal raha hai, isliye wo output me " use karta hai.
-- Problem: normal MySQL (jaise aapke laptop pe) me " ka matlab "text/string" hota hai, table ya column ka naam nahi.
-- Agar wahi " wali SQL normal MySQL me chalate to syntax error aata.
-- Isliye maine sab " ko backtick (`) se badal diya. Backtick MySQL ke DONO modes me naam ke liye chalta hai
-- (Aiven pe bhi, normal MySQL pe bhi), to ye file kahin bhi chal jayegi.
-- Sirf quotes badle hain, tables/columns/types bilkul wahi hain jo asli DB me hain.
--
-- ============================================================
-- `likes` COLUMN NULL KYU HAI AUR USSE KYA RISK HAI
-- ============================================================
-- Asli DB me likes ka definition hai: `int DEFAULT '0'` -- yaani "NOT NULL" nahi likha, to value NULL (khali) ho sakti hai.
-- (Maine pehle galti se NOT NULL likh diya tha, wo asli DB se match nahi karta tha, isliye theek kiya.)
-- Default 0 ka matlab: naya post banate waqt agar likes ki value na do to apne aap 0 ho jata hai.
--   Hamara INSERT query likes ko touch hi nahi karta, to naye posts me hamesha 0 hi aata hai. Koi dikkat nahi.
-- Risk sirf tab hai jab kisi purani row me likes NULL ho (jaise kisi ne manually NULL daal diya ho).
--   MySQL me NULL + 1 = NULL hota hai, to `likes = likes + 1` us row pe kaam hi nahi karega, like kabhi badhega nahi.
-- Bachav (1): views me `post.likes || 0` hai, to NULL screen pe 0 dikhta hai, page crash nahi hota.
-- Bachav (2): agar kabhi NULL rows mile to ye chala do:   UPDATE posts SET likes = 0 WHERE likes IS NULL;
-- Bachav (3): chaho to column hi sakht bana do:           ALTER TABLE posts MODIFY likes INT NOT NULL DEFAULT 0;
--   (Isse pehle (2) chalana padega, warna NULL rows ki wajah se ALTER fail ho sakta hai.)

CREATE TABLE `authors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) NOT NULL,
  `Email` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `summary` varchar(255) NOT NULL,
  `body` text NOT NULL,
  `author_id` int NOT NULL,
  -- NOTE: likes NULL ho sakta hai, upar ke comment me poori detail hai.
  `likes` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `author_id` (`author_id`),
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`)
);

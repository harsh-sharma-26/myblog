-- [FIX #10] Database dobara banana ho to ye SQL chala do.
-- Ye schema asli Aiven DB ke `SHOW CREATE TABLE` output se liya gaya tha (2026-10-17), ab usme
-- authentication + authorization ka structure add hai (2026-10-19).
--
-- FILE KA LAYOUT:
--   PART 1: Naya (fresh) database banane ke liye -- saare tables final shape me.
--   PART 2: Purana (already chal raha) database upgrade karne ke liye -- sirf ALTER/CREATE jo naya hai.
--   Dono me se SIRF EK part chalana hai. Fresh DB pe PART 1, purane live DB pe PART 2. Dono mat chalana.
--
-- ============================================================
-- BIG PICTURE: KAUN KYA HAI (authentication + authorization)
-- ============================================================
-- Do tarah ke log hain, dono ke alag tables aur alag login page:
--
--   1) ADMIN  = `authors` table ki row.
--        - Login page: /admin/login. Koi signup nahi (koi bhi admin na ban jaye), password seed script se set hota hai.
--        - Admin kisi bhi post ko create / read / update / delete kar sakta hai.
--        - Admin jo post banata hai wo hamesha usi ke naam se jata hai (posts.author_id = uski authors.id).
--          Create-post form me ab author dropdown nahi hai, kisi aur author ke naam se post nahi ban sakta.
--
--   2) NORMAL USER = `users` table ki row.
--        - Login page: /login, signup: /signup.
--        - Apni banayi post par create / read / update / delete (sirf jahan posts.user_id = uski id).
--        - Dusron ki post sirf read kar sakta hai.
--        - Post like / unlike kar sakta hai.
--
--   Koi `roles` table nahi hai. Role is baat se decide hota hai ki login kis table se hua
--   (session me type = 'admin' ya 'user' rakhte hain). Ye check code (middleware) me hota hai, DB me nahi.
--
-- ============================================================
-- RELATIONS (kaun kisse juda hai)
-- ============================================================
--   authors 1 ---- N posts       (posts.author_id -> authors.id)  : admin ki posts. Pehle se tha.
--   users   1 ---- N posts       (posts.user_id   -> users.id)    : normal user ki posts. NAYA.
--   users   1 ---- N post_likes  (post_likes.user_id -> users.id) : kisne like kiya. NAYA.
--   posts   1 ---- N post_likes  (post_likes.post_id -> posts.id) : kaunsi post like hui. NAYA.
--   users N ---- M posts  (post_likes ke through): ek user kai posts like kar sakta hai, ek post ko kai users.
--
--   Har post ka OWNER exactly ek hota hai: ya author_id set (admin ki post) ya user_id set (user ki post).
--   Dono set nahi ho sakte, dono khali bhi nahi (posts ka CHECK constraint ye force karta hai).
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
--
-- ============================================================
-- `likes` COUNTER AUR `post_likes` TABLE -- DONO KYU
-- ============================================================
-- posts.likes     = sirf total count (home/list page pe turant dikh jaye, COUNT(*) join nahi chahiye).
-- post_likes      = asli record ki KAUN sa user kaunsi post like kar chuka hai (duplicate like rokne ke liye).
-- Dono ko sync rakhne ke liye like/unlike ke waqt EK hi transaction me:
--   like   : INSERT INTO post_likes ...  +  UPDATE posts SET likes = likes + 1
--   unlike : DELETE FROM post_likes ...  +  UPDATE posts SET likes = GREATEST(likes - 1, 0)
-- Purani posts ke likes ka count user-wise nahi hai (kisne kiya pata nahi), isliye wo counter me as-is rahega
-- aur naye likes uske upar add honge. Un purane likes ko koi user "unlike" nahi kar sakta (post_likes me row hi nahi).
--
-- Abhi sirf normal USERS like kar sakte hain. Admin ke likes jaan-bujhkar support nahi kiye (simplicity).
-- Agar future me chahiye: post_likes me `author_id INT NULL` add karo, PK hatake alag `id` PK lagao,
-- aur (user_id, post_id) tatha (author_id, post_id) pe alag UNIQUE keys lagao.


-- ############################################################
-- PART 1: FRESH DATABASE (naya DB banane ke liye)
-- ############################################################
-- Order important hai kyunki foreign key ke liye referenced table pehle ban chuki honi chahiye:
--   authors, users  ->  posts  ->  post_likes

-- ADMIN. Pehle se tha, ab login ke liye password_hash + unique Email add hua.
CREATE TABLE `authors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) NOT NULL,
  -- Email ab admin login ID hai, isliye UNIQUE (neeche UNIQUE KEY).
  `Email` varchar(255) NOT NULL,
  -- bcrypt/argon2 ka hash, plain password kabhi nahi. NULL = abhi password set nahi hua, ye author login nahi kar sakta.
  -- NULL isliye allowed hai ki purani authors rows toot na jaye; password seed script se baad me set hota hai.
  `password_hash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_authors_email` (`Email`)
);

-- NORMAL USER. Naya table. Signup /signup se hota hai.
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  -- Login ID. UNIQUE taaki ek email se do account na bane.
  `email` varchar(255) NOT NULL,
  -- bcrypt/argon2 ka hash, plain password kabhi nahi.
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
);

-- POSTS. Pehle se tha. Do badlav: author_id ab NULL ho sakta hai, aur user_id naya aaya.
CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `summary` varchar(255) NOT NULL,
  `body` text NOT NULL,
  -- ADMIN ki post me set, USER ki post me NULL. (Pehle NOT NULL tha, ab NULL allowed kyunki user ki post ka koi author nahi.)
  `author_id` int DEFAULT NULL,
  -- NORMAL USER ki post me set, ADMIN ki post me NULL. Naya column.
  `user_id` int DEFAULT NULL,
  -- NOTE: likes NULL ho sakta hai, upar ke comment me poori detail hai.
  `likes` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `author_id` (`author_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`),
  -- ON DELETE jaan-bujhkar default (RESTRICT) hai: jis user ki posts hain use delete karoge to error aayega,
  -- posts chupke se gayab nahi hongi. (MySQL CHECK wale column par CASCADE/SET NULL allow bhi nahi karta.)
  CONSTRAINT `posts_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  -- Exactly ek owner: author_id aur user_id me se EK hi NULL hona chahiye (<> yaani "alag-alag").
  -- CHECK MySQL 8.0.16+ me enforce hota hai. Purane MySQL me ye chupchap ignore hota hai, tab code me bhi check rakho.
  CONSTRAINT `posts_one_owner_chk` CHECK ((`author_id` IS NULL) <> (`user_id` IS NULL))
);

-- LIKES. Naya table. Ek row = "ye user ne ye post like ki".
CREATE TABLE `post_likes` (
  `user_id` int NOT NULL,
  `post_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Composite PK: ek user ek post ko sirf EK baar like kar sakta hai, duplicate DB level pe hi block.
  -- Alag `id` column ki zaroorat nahi.
  PRIMARY KEY (`user_id`, `post_id`),
  -- "ye post kisne like ki" wali query tez rakhne ke liye.
  KEY `post_id` (`post_id`),
  -- CASCADE: user ya post delete ho to uske like-records apne aap hat jaye.
  CONSTRAINT `post_likes_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_likes_post_fk` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
);


-- ############################################################
-- PART 2: EXISTING DATABASE UPGRADE (purana live DB, data bacha ke)
-- ############################################################
-- Ye saari statements COMMENTED hain taaki file ko poora chalane pe PART 1 ke saath takraye nahi.
-- Purane DB pe sirf SQL lines (jo `--   ` yaani 3 spaces ke saath shuru hoti hain) ka comment hata ke chalao,
-- upar se neeche, order me. Jo lines `-- ` (1 space) se shuru hain wo sirf explanation hain, unhe mat chhedna.
-- Sab changes backward-compatible hain: purani rows aur purani posts bilkul safe rehti hain.
--
-- STEP 0 (check): authors me duplicate Email to nahi? Result khali aana chahiye, warna Step 1 ka UNIQUE fail hoga.
--   SELECT Email, COUNT(*) FROM authors GROUP BY Email HAVING COUNT(*) > 1;
--
-- STEP 1: authors ko admin-login ke layak banao.
--   ALTER TABLE `authors`
--     ADD COLUMN `password_hash` varchar(255) DEFAULT NULL,
--     ADD UNIQUE KEY `uq_authors_email` (`Email`);
--
-- STEP 2: users table banao.
--   CREATE TABLE `users` (
--     `id` int NOT NULL AUTO_INCREMENT,
--     `email` varchar(255) NOT NULL,
--     `password_hash` varchar(255) NOT NULL,
--     `display_name` varchar(100) NOT NULL,
--     `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     PRIMARY KEY (`id`),
--     UNIQUE KEY `uq_users_email` (`email`)
--   );
--
-- STEP 3: posts me user_id add karo aur author_id ko NULL-able banao.
-- Purani sab posts me author_id set hai aur user_id NULL, to naya CHECK unpar apne aap sahi baithta hai.
-- (Existing FK posts_ibfk_1 ko chhedne ki zaroorat nahi, MODIFY usse nahi todta.)
--   ALTER TABLE `posts`
--     MODIFY COLUMN `author_id` int DEFAULT NULL,
--     ADD COLUMN `user_id` int DEFAULT NULL AFTER `author_id`,
--     ADD KEY `user_id` (`user_id`),
--     ADD CONSTRAINT `posts_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
--     ADD CONSTRAINT `posts_one_owner_chk` CHECK ((`author_id` IS NULL) <> (`user_id` IS NULL));
--
-- STEP 4: post_likes table banao.
--   CREATE TABLE `post_likes` (
--     `user_id` int NOT NULL,
--     `post_id` int NOT NULL,
--     `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
--     PRIMARY KEY (`user_id`, `post_id`),
--     KEY `post_id` (`post_id`),
--     CONSTRAINT `post_likes_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
--     CONSTRAINT `post_likes_post_fk` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE
--   );
--
-- STEP 5 (SQL se nahi, code/script se): har author ka password set karo.
-- Seed script plain password ko bcrypt/argon2 se hash karke authors.password_hash me daalegi.
-- Jab tak ye nahi hota, authors login nahi kar payenge (password_hash NULL = login band).

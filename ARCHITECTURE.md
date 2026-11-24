# MyBlog — Architecture & Reference Guide

> Future reference ke liye banaya gaya. Project ko dobara samajhna ho to yahin se shuru karo.
> Last updated: 2026-11-24 (**AI se blog posts**: admin review portal aur free AI generator jo har 12 ghante draft banata hai. Section 15, 16 aur 17 dekho)

## 0. Padhne ka order (naye ho to yahin se shuru karo)

✅ = abhi padho, ⭐ = sabse zaroori, ⏭️ = baad me padhna

1. ✅ **1. Ye project kya hai?**
2. ✅ **2. Tech stack**
3. ✅ **3. Folder structure**
4. ⭐ **5. Request ka poora safar** (ise pehle samjho, baaki sab isi se juda hai)
5. **4. Har file kya karti hai**
   - ✅ `app.js`, `data/database.js`, `routes/blog.js`, `routes/auth.js`, `views/`
   - ⏭️ `LikeButton.jsx` (12.8 ke baad padhna)
   - ⏭️ Styles, Dark / Light mode, Page loader, Responsive design, Redesign me kya badla
6. ✅ **6. Database** (6.1, 6.2), saath me `schema.sql` kholo
7. **12. Authentication & Authorization**
   - ✅ 12.1 Basic baatein → 12.2 Do tarah ke log → 12.3 DB structure
   - ⭐ 12.4 Login ka poora safar
   - ✅ 12.5 Permissions → 12.8 Likes → 12.9 `.env` → 12.11 File map
   - ⏭️ 12.6 Security, 12.7 JOIN, 12.10 Live DB checklist, 12.12 Testing, 12.14 Limits
   - ⏭️ 12.13 Gotchas (code badalne se pehle zaroor padhna)
8. ✅ **7. Project kaise chalayein**
9. ⏭️ **8, 9, 10, 11** (git history, fixes, pending, performance): ye history hai, project samajhne ke liye zaroori nahi
10. ⭐ **13. Logging & Health check** (server par kuch toote to yahin se shuru karo)
11. ⏭️ **14. Site ka text English me** (naya text likhte waqt dhyan rakhna)
12. ⭐ **15. AI Posts: admin review portal** (AI ki likhi post pehle admin ke paas aati hai, phir approve/reject)
13. ⭐ **16. AI post generator** (har 12 ghante apne aap draft kaise banta hai, free me)
   - ✅ 16.1 Seedhi baat → 16.3 Ek run ka poora safar → 16.10 Kaunsi setting kahan hai
   - ⭐ 16.12 Kuch toote to kya karein
   - ⏭️ baaki details (topics, sources, checks, GitHub Actions) jab code badalna ho tab
14. ⏭️ **17. Local MySQL reset** (laptop pe `ECONNREFUSED` aaye to)

## 1. Ye project kya hai?

Ek **blog website** jisme **login system** hai. Do tarah ke log hain:

| | Normal **User** | **Admin** (= `authors` table ka insaan) |
|---|---|---|
| Login page | `/login`, signup `/signup` | `/admin/login` (signup nahi hai) |
| Posts padhna | haan | haan |
| Post banana | haan, **apne naam se** | haan, **apne naam se** |
| Post edit / delete | sirf **apni** post | **kisi ki bhi** post |
| Like / unlike | haan | nahi (sirf count dikhta hai) |

Guest (bina login) sirf posts padh sakta hai. Poori detail section 12 me hai.

Ye **CRUD** (Create, Read, Update, Delete) + **authentication/authorization** ka example hai.

## 2. Tech stack

| Cheez | Kya use hua | Kaam |
|---|---|---|
| Node.js + **Express 4** | backend server | URLs (routes) handle karta hai |
| **EJS** | template engine | HTML pages server pe banata hai (server-side rendering) |
| **MySQL** (Aiven cloud) via **mysql2/promise** | database | posts, authors (admin), users, post_likes store karta hai |
| **dotenv** | config | `.env` se DB credentials load karta hai |
| **React 18 (CDN) + Babel standalone** | sirf Like button | build step ke bina browser me JSX chalta hai |
| Plain CSS | styling | `public/styles/` |
| **compression** | middleware | HTML/CSS/JS responses gzip hoke jati hain (chhoti size, tez load) |
| **bcryptjs** | password hashing | password DB me hash hoke jata hai, plain nahi (section 12) |
| **cookie-session** | login session | login ki yaad browser ki signed cookie me rehti hai, alag session table nahi |
| nodemon | dev tool | `npm start` pe file change hote hi server restart |
| **@google/genai** | AI (Google Gemini, free tier) | AI se blog post ka draft likhwana (section 16) |
| **GitHub Actions** | scheduler (free, GitHub ka) | har 12 ghante AI generator script chalana (section 16.9) |

## 3. Folder structure

```
myBlog/
├── app.js                  ← Entry point. Server yahin se start hota hai (session + CSRF middleware yahin lagte hain)
├── schema.sql              ← DB tables ka SQL (PART 1 = fresh DB, PART 2 = purane DB ka upgrade)
├── migrations/                                                              [NAYA FOLDER, section 15/16]
│   ├── 001-ai-drafts.sql   ← ai_drafts table (AI drafts ki review queue)
│   └── 002-ai-assisted.sql ← posts.ai_assisted column ("AI-assisted" label)
├── .github/workflows/
│   └── ai-post.yml         ← GitHub Actions: har 12 ghante AI generator chalata hai [NAYA, section 16.9]
├── package.json            ← Dependencies + scripts ("npm start", "npm run set-admin-password", "npm run generate-post")
├── .env                    ← DB credentials + SESSION_SECRET (gitignored, kabhi commit mat karna)
├── logs/app.log            ← local par server ke logs (gitignored, apne aap banta hai, section 13) [NAYA]
├── data/
│   └── database.js         ← MySQL connection pool
├── routes/
│   ├── blog.js             ← Posts ke routes (list/create/edit/delete/like) + DB queries
│   ├── auth.js             ← signup, login, admin login, logout            [NAYA]
│   ├── admin-ai-drafts.js  ← /admin/ai-posts: AI drafts ka review portal (approve/reject/edit) [NAYA, section 15]
│   └── ai-drafts-api.js    ← /api/ai-drafts: AI generator yahan draft bhejta hai (secret token se) [NAYA, section 15.5]
├── middleware/                                                              [NAYA FOLDER]
│   ├── auth.js             ← "kaun hai?" (loadCurrentUser) + login-required guards
│   ├── csrf.js             ← CSRF token check (har POST par)
│   ├── rate-limit.js       ← galat password baar-baar daalne par rokta hai
│   └── request-logger.js   ← har request ki ek log line (method, URL, status, time) [NAYA]
├── utils/                                                                   [NAYA FOLDER]
│   ├── permissions.js      ← "kaun kya kar sakta hai" ke rules (ek hi jagah)
│   ├── validation.js       ← saare forms / :id ka server-side input check
│   ├── password.js         ← bcrypt hash / verify
│   ├── async-handler.js    ← async route ke error ko 500 page pe bhejta hai (pehle blog.js me tha)
│   ├── logger.js           ← logger: console me hamesha, file me sirf local par (section 13) [NAYA]
│   └── ai-drafts.js        ← AI draft ki validation + approve pe "Sources" list jodna [NAYA, section 15]
├── scripts/
│   ├── set-admin-password.js ← admin ka password terminal se set karne ki script [NAYA]
│   └── ai-generator/         ← AI post generator (section 16)                   [NAYA FOLDER]
│       ├── generate-post.js  ← main script: queue check → topic → research → likho → jaancho → bhejo
│       ├── topics.js         ← 6 topics + agla topic kaunsa ho
│       ├── sources.js        ← RSS feeds se asli logon ke articles laana
│       ├── prompts.js        ← AI ko likhne ke rules
│       └── checks.js         ← copy-paste / nakli quote / length check
├── views/                  ← EJS templates (HTML pages)
│   ├── posts-list.ejs      ← /posts  (saare posts)
│   ├── post-detail.ejs     ← /posts/:id (ek post poora)
│   ├── create-post.ejs     ← /new-post (form)
│   ├── update-post.ejs     ← /posts/:id/edit (form)
│   ├── login.ejs / signup.ejs / admin-login.ejs ← auth pages           [NAYE]
│   ├── admin-ai-posts.ejs / admin-ai-post-review.ejs / admin-ai-post-edit.ejs ← AI posts portal [NAYE, section 15]
│   ├── 400.ejs / 403.ejs / 404.ejs / 500.ejs ← error pages (400 = validation fail, 403 = permission nahi)
│   └── includes/           ← reusable chhote tukde
│       ├── head.ejs        ← <head> (meta, fonts, base.css, title, csrf meta tag)
│       ├── header.ejs      ← top navbar (login ki halat ke hisaab se badalta hai)
│       ├── post-item.ejs   ← list me ek post ka card
│       ├── like-widget.ejs ← like button ka khali div (React isme mount hota hai) [NAYA]
│       ├── csrf-field.ejs  ← har form ka chhupa hua security token field         [NAYA]
│       └── form-error.ejs  ← form ke upar laal error box                          [NAYA]
└── public/                 ← browser ko seedha serve hota hai (static)
    ├── styles/             ← base.css (theme variables + header + buttons), forms.css, posts.css, loader.css, admin.css (AI posts portal)
    ├── scripts/theme.js    ← light/dark toggle + navbar active link
    ├── scripts/loader.js   ← page loader ka logic (setTimeout)
    └── react/LikeButton.jsx← React like-button component
```

## 4. Har file kya karti hai

### `app.js` — server ka dil
1. `dotenv` se `.env` load karta hai.
2. Express app banata hai, **EJS** ko view engine set karta hai (`views/` folder).
3. **`SESSION_SECRET` check**: `.env` me na ho (ya 32 characters se chhota ho) to server start hi nahi hota (section 12.9).
4. Middlewares (**order matter karta hai**, upar se neeche chalte hain):
   1. `express.urlencoded` → HTML form ka data `req.body` me aata hai.
   2. `compression()` → saare responses gzip compress hote hain (performance, section 11).
   3. `express.static("public")` → `/styles/...` aur `/react/...` files seedha serve hoti hain. Ye session se **pehle** hai, taaki CSS/JS ki request pe DB lookup na ho.
   4. `requestLogger` → har page/API request ki ek log line. Static ke **baad** hai, isliye CSS/JS ki requests log nahi hoti (section 13).
   5. `GET /health` → server + database chal rahe hain ya nahi, JSON me batata hai (section 13).
   6. `cookieSession` → login ki cookie padhta/likhta hai (`req.session`).
   7. `loadCurrentUser` → cookie se asli user DB se nikalta hai (`req.currentUser`).
   8. `csrfProtection` → har POST pe security token check.
5. `authRoutes` aur `blogRoutes` mount karta hai.
6. **404 handler**: koi route match na ho to `404.ejs` (pehle Express ka plain "Cannot GET" aata tha).
7. **Error handler** (4 arguments wala) — koi bhi route crash kare to `500.ejs` dikhata hai, aur error ka poora stack trace + URL log karta hai.
8. `PORT` (env) ya default `3000` pe listen karta hai. Start hote hi `Server started` log karta hai aur ek baar database check karta hai. `x-powered-by` header band hai. Proxy ke peeche (Railway/Render etc.) `.env` me `TRUST_PROXY=1` daalo.
9. `process.on("unhandledRejection" / "uncaughtException")` → request ke bahar hone wale crash bhi process band hone se pehle log ho jate hain.

### `data/database.js` — DB connection
- `mysql.createPool(...)` → **connection pool** (har request pe naya connection nahi banta, pool se reuse hota hai — fast aur efficient).
- Host/user/password `.env` se. Variable names do tarah ke support hain: `MYSQLHOST` (Railway style) ya `DB_HOST` (current Aiven style) — pehla mila wahi use hota hai.
- `ssl: { rejectUnauthorized: false }` → cloud DB ke liye SSL on hai (certificate verify nahi karta).
- Pool export hota hai; `routes/blog.js` me `db.query(...)` se use hota hai.

### `routes/blog.js` — posts ke routes
"Login?" column: **—** = koi bhi (guest bhi), **login** = user ya admin, **user** = sirf normal user, **owner/admin** = apni post ya admin.

| Method | URL | Login? | Kya hota hai | Response |
|---|---|---|---|---|
| GET | `/` | — | redirect | → `/posts` |
| GET | `/posts` | — | posts + owner ka naam (**LEFT JOIN**, section 12.7) | `posts-list.ejs` |
| GET | `/new-post` | login | form (author dropdown **nahi** hai) | `create-post.ejs` (guest → `/login`) |
| POST | `/posts` | login | validate + INSERT (owner session se) | redirect → `/posts` |
| GET | `/posts/:id` | — | ek post + owner | `post-detail.ejs` (nahi mila / galat id → 404) |
| GET | `/posts/:id/edit` | owner/admin | post fetch, form prefill | `update-post.ejs` (permission nahi → 403) |
| POST | `/posts/:id/edit` | owner/admin | title/summary/body UPDATE | redirect → `/posts` |
| POST | `/posts/:id/delete` | owner/admin | post DELETE | redirect → `/posts` |
| POST | `/posts/:id/like` | user | `post_likes` me row + counter +1 (transaction) | JSON `{ likes, liked }` |
| POST | `/posts/:id/unlike` | user | `post_likes` se row hatao + counter -1 | JSON `{ likes, liked }` |

Notes:
- `?` placeholders (parameterized queries) use hote hain → **SQL injection se bachav**.
- `const [posts] = await db.query(...)` → mysql2 `[rows, fields]` return karta hai, hum sirf rows lete hain.
- Like/unlike **JSON** return karte hain (page reload nahi hota), baaki routes HTML render/redirect karte hain.
- `router.param("id")` har `:id` ko pehle check karta hai (sirf 1 se 2147483647 tak ka number), galat ho to DB tak jaye bina 404.
- Edit/delete ke liye `loadModifiablePost` middleware: post nahi mili → 404, permission nahi → 403, warna `req.post` me rakh deta hai.
- Post banate waqt **owner server decide karta hai** (session se), form se kabhi nahi. Form me `author_id`/`user_id` bhejne se kuch nahi hota.

### `routes/auth.js` — login / signup / logout

| Method | URL | Kya hota hai |
|---|---|---|
| GET/POST | `/signup` | naya normal user banao (`users` table), phir seedha login |
| GET/POST | `/login` | normal user login (`users` table se verify) |
| GET | `/admin` | redirect → `/admin/login` |
| GET/POST | `/admin/login` | admin login (`authors` table se verify) |
| POST | `/logout` | cookie hata deta hai (GET se logout nahi, section 12.6) |

Detail section 12 me.

### `views/` — EJS templates
- `<%= x %>` → value print (HTML-escape ke saath, safe). `<%- include(...) %>` → doosra template include.
- `head.ejs` ko `title` pass hota hai (`include('includes/head', { title: '...' })`).
- `posts-list.ejs` → loop chalata hai, har post ke liye `post-item.ejs` include karta hai. Posts na ho to "No posts found" message.
- `post-item.ejs` → card: title, author, summary, Read Post, like widget. **Edit / Delete sirf unhe dikhte hain jinhe permission hai** (`canModify(post)`, section 12.5).
- `post-detail.ejs` → poora post + like-widget + (permission ho to) Edit/Delete. Admin ki post me author ka email (mailto) dikhta hai, normal user ki post me sirf naam (user ki email public nahi dikhate).
- `create-post.ejs` / `update-post.ejs` → forms. **Author dropdown dono jagah hata diya**: create me "Posting as <naam>" dikhta hai, aur post ka owner edit se kabhi nahi badalta.
- `login.ejs` / `signup.ejs` / `admin-login.ejs` → auth forms. Galti hone par wahi page error box ke saath dobara dikhta hai (email bhari rehti hai, password nahi).
- `403.ejs` → "Not allowed" page (permission nahi / CSRF token galat).
- `includes/like-widget.ejs` → like button ka khali div + `data-liked` / `data-mode` (guest / user / admin).
- `includes/csrf-field.ejs` → **har POST form me zaruri**. Chhupa hua `_csrf` input banata hai.
- Templates me `locals.currentUser` / `locals.csrfToken` likha hai (seedha `currentUser` nahi), taaki error page jaisi jagah jahan ye set nahi hota wahan EJS crash na kare.
- Jin pages pe like button hai (`posts-list`, `post-detail`) unke neeche React, ReactDOM, Babel CDN scripts + `LikeButton.jsx` load hoti hai.

### `public/react/LikeButton.jsx` — React like feature
Flow:
1. EJS (`includes/like-widget.ejs`) server pe khali `<div class="like-widget" data-post-id="7" data-likes="12" data-liked="true" data-mode="user">` render karta hai.
2. Browser me Babel `LikeButton.jsx` ko compile karta hai; code har `.like-widget` dhundh ke uske andar alag React root mount karta hai.
3. Initial "liked" state ab **server se** (`data-liked`, DB ke `post_likes` table se) aati hai. Pehle ye browser ke localStorage me thi, to sirf usi browser me yaad rehti thi aur koi bhi localStorage badal ke jitni baar chahe like kar sakta tha. Ab kisi bhi device pe login karo, heart sahi dikhta hai. localStorage ka koi use nahi bacha.
4. `data-mode` button ka behaviour decide karta hai: **`user`** = like/unlike chalega, **`guest`** = click par `/login?next=...` pe bhejta hai, **`admin`** = button disabled (admin like nahi karta), sirf count dikhta hai.
5. Click pe **optimistic update**: UI turant badalta hai, phir background me `fetch POST /posts/:id/like|unlike`. Fetch me header `x-csrf-token` (`<meta name="csrf-token">` se) aur `Accept: application/json` jata hai.
6. Server ka asli count + `liked` aane pe sync; fail hone pe UI wapas undo; 401 (session expire) aaye to login page.

### `public/styles/` + `public/scripts/theme.js` — UI / design (redesign: 2026-10-17)
- **`base.css`**: sabse zaruri file. Upar **CSS variables** hain (`--bg`, `--surface`, `--accent`, ...). Rang badalna ho to sirf yahan badlo, poori site badal jayegi. Isi me reset, typography, buttons (`.btn`, `.btn-alt`, `.btn-danger`), sticky glass navbar, theme toggle button aur error pages (`.status-page`) ki styling hai.
- **`posts.css`**: posts list ka **responsive card grid** (`.posts-grid`), card (`.post-item`), post detail page (`#post-detail`), like button.
- **`forms.css`**: create/update form ka card look aur input focus ring.
- **`public/scripts/theme.js`**: dark/light toggle ka plain JavaScript (React nahi).

### Dark / Light mode kaise kaam karta hai
1. Light colors `:root` me hain. Dark colors `:root[data-theme="dark"]` me hain.
2. Toggle button (header me, gol sun/moon icon) dabane pe `theme.js` `<html data-theme="dark|light">` lagata hai aur choice `localStorage` ("theme" key) me save karta hai.
3. Agar user ne kabhi choose nahi kiya, to CSS khud phone/computer ki setting (`prefers-color-scheme`) follow karti hai. Isiliye dark variables **do jagah** likhe hain (data-theme wala aur media query wala), ek block dono ke liye share nahi ho sakta.
4. `theme.js` `<head>` me bina `defer` ke load hoti hai, taaki page dikhne se pehle theme lag jaye aur white flash na aaye.
5. Naya color/element banao to hamesha `var(--...)` use karo, hardcoded color nahi, warna wo dark mode me galat dikhega.

### Page loader (site khulne se pehle) — `loader.css` + `loader.js`
Flow:
1. `views/includes/header.ejs` me sabse upar `<div id="page-loader">` hai (header har page me pehle include hota hai, isliye loader har page pe aata hai). Ye default me **hidden** rehta hai.
2. `head.ejs` me `loader.js` bina `defer` ke load hoti hai. Ye turant `<html>` pe class **`is-loading`** lagati hai: loader (poori screen ka opaque card, sabse upar) dikhta hai, scroll band. Site peeche render hoti rehti hai, `visibility: hidden` ab nahi lagta (performance, section 11).
3. `setTimeout` se loader kam se kam **1.4 sec** (`MIN_LOADER_TIME`) rukta hai, aur page ke poore load hone ka bhi intezar karta hai.
4. Phir `is-loading` hat ke **`is-ready`** lagti hai: loader upar slide hoke nikalta hai (`.hide`), header upar se neeche slide hota hai, content neeche se upar, aur post cards ek ke baad ek (stagger) aate hain. Ye animations `.is-ready` selectors se chalti hain (`base.css`, `posts.css`).

Safety (site kabhi atakegi nahi):
- JS band ho to `is-loading` class lagti hi nahi, to loader hidden rehta hai aur site normal dikhti hai.
- `MAX_LOADER_TIME` (4 sec) ke baad site zabardasti khul jati hai, chahe CDN slow ho.
- Jin users ne "reduce motion" on kiya hai unke liye loader skip hota hai.

Time badalna ho to `public/scripts/loader.js` ke upar `MIN_LOADER_TIME` / `MAX_LOADER_TIME` badlo. Loader ka rang/shape `loader.css` me hai.

### Responsive design
- Cards ka grid `repeat(auto-fill, minmax(min(100%, 20rem), 1fr))` hai: desktop pe 2-3 columns, phone pe apne aap 1 column. Iske liye media query nahi chahiye.
- `max-width: 600px` ki media queries sirf spacing, font aur navbar chhota karti hain.
- Buttons, form fields aur like button phone pe tap karne layak bade hain.
- `prefers-reduced-motion` on ho to saari animations band ho jati hain.

### Redesign me kya badla (HTML side)
- `includes/head.ejs`: Inter font + `theme.js` + `theme-color` meta.
- `includes/header.ejs`: theme toggle button.
- `includes/post-item.ejs`: naya card (author avatar, summary, Read Post, like, Edit/Delete). Delete ab red `btn-danger`.
- `posts-list.ejs`: page header (heading + subtitle + "New Post"), empty state card. `<li id="posts-list">` (repeat hoti id, galat HTML) ki jagah class `posts-grid-item`.
- `400/404/500.ejs`: `<main class="status-page">`.

## 5. Request ka poora safar (example: `/posts` kholna)

```
Browser → GET /posts
   → app.js (middlewares) → routes/blog.js (GET /posts)
   → cookieSession → loadCurrentUser (cookie se user, DB check) → csrfProtection (GET hai, bas token set)
   → data/database.js pool → MySQL: SELECT posts LEFT JOIN authors LEFT JOIN users (+ liked_by_me)
   → res.render("posts-list", { posts })  (EJS HTML banata hai)
   → Browser ko HTML + CSS + React scripts milte hain
   → LikeButton.jsx har card ke like-widget me button mount karta hai
```

Form submit (create): `create-post.ejs` form (`_csrf` token ke saath) → `POST /posts` → CSRF check → `requireLogin` → validate → INSERT (owner session se) → `redirect /posts` (POST-redirect-GET pattern, refresh pe duplicate submit nahi hota).

## 6. Database (asli schema `schema.sql` me hai)

4 tables (+ AI wala 5th table `ai_drafts`, section 15.3). **Purane `authors` aur `posts` me data nahi tootta**, naye tables add hue aur 3 chhote badlav hue.

| Table | Kaun hai | Columns |
|---|---|---|
| **`authors`** (purana) | **Admin** | `id` PK, `Name`, `Email` (ab **UNIQUE**), `password_hash` (**naya**, NULL = login band) |
| **`users`** (naya) | **Normal user** | `id` PK, `email` (UNIQUE), `password_hash`, `display_name`, `created_at` |
| **`posts`** (purana) | post | `id` PK, `title`, `summary`, `body`, `author_id` (ab **NULL ho sakta hai**, FK → authors), `user_id` (**naya**, NULL, FK → users), `likes` (counter) |
| **`post_likes`** (naya) | kisne kya like kiya | `user_id` FK → users, `post_id` FK → posts, `created_at`; **PRIMARY KEY (user_id, post_id)** |
| **`ai_drafts`** (naya, 2026-11-24) | AI ki likhi posts jo abhi review me hain | section 15.3 |

`posts` me ek aur naya column (2026-11-24): **`ai_assisted`** (0 ya 1). 1 = ye post AI draft se approve hui thi, page pe "AI-assisted" label dikhta hai (section 16.8).

Relations (section 12.3 me poora samjhaya hai):
- `authors 1 — N posts` (`posts.author_id`): admin ki posts
- `users 1 — N posts` (`posts.user_id`): normal user ki posts
- `users N — M posts` via `post_likes`: likes
- Har post ka **exactly ek owner**: `author_id` ya `user_id` (dono nahi, koi nahi bhi nahi). `CHECK` constraint ye force karta hai.

### 6.1 Schema me " ki jagah ` kyu use kiya?
- Aiven ka MySQL **ANSI_QUOTES mode** me chalta hai, isliye `SHOW CREATE TABLE` ka output naam ko double quotes me deta hai: `"posts"`, `"id"`.
- Normal MySQL (aapke laptop wala) me `"` ka matlab **string/text** hota hai, table-column ka naam nahi. Wahi SQL wahan chalate to **syntax error** aata.
- Isliye maine sab `"` ko **backtick** `` ` `` se badal diya. Backtick MySQL ke **dono modes** me naam ke liye chalta hai, to `schema.sql` Aiven pe bhi chalegi aur local MySQL pe bhi.
- Sirf quotes badle hain. Tables, columns, types, keys sab asli DB jaise hi hain.
- Agar future me Aiven se dobara `SHOW CREATE TABLE` chalaoge aur output file me paste karoge, to `"` ko phir `` ` `` se badalna mat bhoolna.

### 6.2 `likes` column NULL kyu ho sakta hai, aur isse kya dikkat hai?
- Asli DB me definition `int DEFAULT '0'` hai. Usme `NOT NULL` nahi likha, isliye value **NULL (khali)** ho sakti hai. (Maine pehle galti se `NOT NULL` likha tha, wo asli DB se match nahi karta tha, isliye theek kiya.)
- **DEFAULT 0 ka matlab:** naya post banate waqt `likes` ki value na do to apne aap `0` ho jata hai. Hamara `INSERT` `likes` ko touch hi nahi karta, to naye posts me hamesha `0` aata hai. Isme koi dikkat nahi.
- **Risk kab hai:** sirf tab jab kisi row me `likes` NULL ho (jaise kisi ne DB me manually NULL daal diya). MySQL me `NULL + 1 = NULL` hota hai, to `UPDATE posts SET likes = likes + 1` us row pe kaam nahi karega aur like kabhi badhega nahi.
- **Abhi kaise bachav hai:** views me `post.likes || 0` hai, to NULL screen pe `0` dikhta hai aur page crash nahi hota.
- **Agar kabhi NULL rows mile:**
  ```sql
  UPDATE posts SET likes = 0 WHERE likes IS NULL;
  ```
- **Sakht fix (optional):** pehle upar wala UPDATE chalao, phir
  ```sql
  ALTER TABLE posts MODIFY likes INT NOT NULL DEFAULT 0;
  ```
  Isse NULL kabhi store hi nahi hoga. (Pehle UPDATE isliye zaruri hai ki NULL rows hongi to ALTER fail ho sakta hai.) Ye abhi nahi kiya hai, kyunki asli DB badalna aapka decision hai.

## 7. Project kaise chalayein

```bash
npm install
# .env me ye daalo: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT, SESSION_SECRET
npm start        # nodemon app.js → http://localhost:3000
```

Pehli baar login system chalane ke liye (live DB par) ye 3 kaam zaruri hain, detail section 12.10 me:
1. `schema.sql` ka **PART 2** DB par chalao (backup ke baad).
2. `.env` me `SESSION_SECRET` ho.
3. `npm run set-admin-password -- <author-email>` se har admin ka password set karo.

AI generator ko local pe test karna ho (section 16.11): `.env` me `GEMINI_API_KEY` aur `AI_DRAFTS_API_TOKEN` daalo, server chalu rakho, phir `DRY_RUN=1 npm run generate-post`.

## 8. Git history ka summary
- Railway DB → **Aiven DB** migration
- React LikeButton component add hua
- Mobile media queries add hui
- Abhi uncommitted: comments add hue (`app.js`, `routes/blog.js`, `LikeButton.jsx`) + ek bug fix: edit route me `res.statusCode(404)` → `res.status(404)` (pehle crash karta tha).

## 9. Fixes applied (2026-10-17) — code me `[FIX #n]` comments dhundho

| # | Fix | Kahan |
|---|---|---|
| 1 | `asyncHandler` wrapper: DB error ab 500 page pe jata hai, hang nahi hota. Like/unlike me missing post pe 404 JSON | `routes/blog.js` |
| 2 | Trailing space hataye (form action, summary value, textarea) | `update-post.ejs`, `post-item.ejs` |
| 4 | Edit form me author dropdown + `author_id` UPDATE | `update-post.ejs`, `routes/blog.js` |
| 5 | Server-side validation (`validatePost`) + naya `views/400.ejs` | `routes/blog.js`, `400.ejs` |
| 6 | Delete pe `confirm()` popup | `post-item.ejs` |
| 7 | CDN versions pinned (React 18.3.1, Babel 7.26.0) | `post-detail.ejs`, `posts-list.ejs` |
| 8 | Optional `DB_SSL_CA` env: set karo to SSL certificate verify hoga, nahi to warning ke saath purana behaviour | `data/database.js` |
| 9 | package.json name/author saaf kiya | `package.json` |
| 10 | `schema.sql` add hui (asli Aiven `SHOW CREATE TABLE` se liya hua) | `schema.sql` |
| 11 | (2026-10-19) Auth/permissions add hue. Is se **#3 (like spam)** aur **#4 (author dropdown)** ka matlab badal gaya, section 12 dekho | poora project |

## 10. Abhi bhi pending (jaanboojh ke nahi kiye)

- ~~**Like spam (#3)**~~: **HO GAYA (2026-10-19)**. Login system aa gaya, aur `post_likes` ka PRIMARY KEY (user_id, post_id) ek user ko ek post ek hi baar like karne deta hai.
- **Pagination, search, timestamps (#11)**: ye naye features hain, bug fix nahi. DB me column bhi add karna padega.
- React ko Babel-in-browser se hata ke Vite/build step pe le jana (bada refactor).

## 11. Performance fixes (Lighthouse 76 -> improve karne ke liye, 2026-10-18)

Lighthouse performance score 76 aaya tha. Neeche wali cheezein slow kar rahi thi, unpe kaam hua. (Score dobara measure karna baaki hai.)

| # | Kya kiya | Aasan bhasha me | Kyu kiya | Kahan |
|---|---|---|---|---|
| P1 | **gzip compression** | Server ab HTML/CSS/JS ko zip karke bhejta hai, browser kholta hai. Jaise zip file bhejna, seedhi badi file nahi. | Chhoti file = kam download time = page jaldi dikhta hai. Lighthouse "enable text compression" flag karta hai. | `app.js` (`compression()`), `package.json` me `compression` package |
| P2 | **Google Fonts non-blocking** | Fonts ka CSS ab page ko rok nahi leta. Page pehle dikh jata hai, font aate hi apply ho jata hai. | Pehle browser font ka CSS aane tak page dikhana rok deta tha (render-blocking). Isse First Contentful Paint late hota tha. | `views/includes/head.ejs` (`media="print" onload="this.media='all'"` + `<noscript>` fallback) |
| P3 | **Loader se `visibility: hidden` hataya** | Loader ab bhi dikhta hai, par site ko chhupane ke bajay sirf upar se dhak leta hai. Site peeche chupchap load hoti rehti hai. | Site "hidden" thi to Lighthouse ko lagta tha ki content 1.4 sec baad aaya (LCP late). Look same hai, bas measurement sahi aur tez. | `public/styles/loader.css` |

### Jo try kiya par WAPAS (undo) kar diya, aur reason
- **Babel hatana (LikeButton ko plain JS me badalna):** Babel browser me ~3MB download hota hai aur JSX wahin compile karta hai, ye score ki sabse badi wajah hai. Maine `LikeButton.jsx` ko `React.createElement` wale plain JS me badla tha. Par aapne ye change wapas karwa diya, to abhi bhi Babel-in-browser use ho raha hai (`posts-list.ejs`, `post-detail.ejs`, `LikeButton.jsx` pehle jaise). Agar future me score badhana ho to ye sabse asardaar fix hai.
- **Static files ka 7 din ka browser cache (`maxAge`):** files me hash nahi hai, to CSS/JS badalne par returning visitors ko purana version dikh sakta tha. Isliye hata diya.

### Aage ke options (abhi nahi kiye)
- Loader ka `MIN_LOADER_TIME` (1.4 sec) kam karna, ya loader sirf pehli visit par dikhana.
- React ko unpkg CDN ke bajay khud serve karna.
- Babel hatana (upar dekho).

## 12. Authentication & Authorization (2026-10-19)

> Ye project ka sabse complex hissa hai. Isliye pehle basic concepts, phir poora flow, phir file-by-file detail diya hai.
> Kuch bhi tootne par pehle 12.13 ("Gotchas") dekho.

### 12.1 Pehle basic baatein (2 minute me)

- **Authentication** = "tum kaun ho?" (login). Email + password se saabit karte ho.
- **Authorization** = "tumhe ye karne ki ijazat hai?" Login ke baad bhi har action pe check hota hai (jaise: apni post delete kar sakte ho, dusre ki nahi).
- **Session** = server ko har request pe yaad rakhna ki ye wahi insaan hai jo pehle login hua tha. HTTP khud kuch yaad nahi rakhta, isliye browser ko ek **cookie** milti hai, aur wo har request ke saath wapas aati hai.
- **Hash** = password ka one-way "fingerprint". DB me password nahi, uska hash rehta hai. Hash se original password wapas nahi nikalta, to DB leak ho bhi jaye to passwords seedhe nahi milte.

### 12.2 Do tarah ke log (aur koi `roles` table nahi)

| | **Normal user** | **Admin** |
|---|---|---|
| DB table | `users` | `authors` (jo pehle se tha) |
| Login page | `/login` (signup: `/signup`) | `/admin/login` (**signup nahi**) |
| Session me type | `'user'` | `'admin'` |
| Account kaise bante hain | khud signup karke | pehle se `authors` me hain; password terminal script se set hota hai |

**Role kaise decide hota hai:** login kis page / table se hua, wahi `type` ban jata hai (`req.session.auth = { type, id }`). Alag `roles` table ya `role` column nahi hai. Ye jaanboojh ke simple rakha gaya hai.

Admin ka signup **isliye nahi hai** ki wahan koi bhi khud ko admin bana leta.

### 12.3 DB structure aur links

```
                        ┌─────────────┐
   (ADMIN)              │   authors   │  id, Name, Email (UNIQUE), password_hash
                        └──────┬──────┘
                               │ 1
                               │ N  posts.author_id   (admin ki post me set, warna NULL)
                        ┌──────▼──────┐
                        │    posts    │  id, title, summary, body, likes (counter)
                        │             │  author_id (NULL ok)   user_id (NULL ok)
                        └──┬───────┬──┘  CHECK: dono me se EXACTLY ek NULL ho
                      N    │       │ N   posts.user_id  (user ki post me set, warna NULL)
        post_likes.post_id │       │ 1
                           │  ┌────▼────────┐
                           │  │    users    │  id, email (UNIQUE), password_hash, display_name, created_at
                           │  └────┬────────┘   (NORMAL USER)
                           │       │ 1
                           │       │ N  post_likes.user_id
                        ┌──▼───────▼──┐
                        │ post_likes  │  PRIMARY KEY (user_id, post_id)
                        └─────────────┘
```

**Kyu aisa design (decisions):**
- **`users` aur `authors` alag rakhe**, link nahi kiya. Purane authors ke paas login nahi tha aur unka data toot nahi sakta tha. Admin ka password seedha `authors.password_hash` me hai, to ek insaan ka data do jagah duplicate nahi hota.
- **`posts.author_id` ko NULL-able banaya** (pehle `NOT NULL` tha), kyunki normal user ki post ka koi author nahi hota. Purani saari posts me `author_id` set hai, to wo sab valid rahin.
- **`CHECK ((author_id IS NULL) <> (user_id IS NULL))`**: DB level pe force karta hai ki post ka exactly ek owner ho. Code me bug aaye tab bhi "owner-less" ya "do owner wali" post ban hi nahi sakti. (MySQL 8.0.16+ me enforce hota hai.)
- **`posts.user_id` ka FK `ON DELETE` default (RESTRICT)** hai: jis user ki posts hain use delete karoge to error aayega, posts chupke se gayab nahi hongi. (MySQL CHECK wale column par CASCADE allow hi nahi karta.)
- **`post_likes` ka composite PRIMARY KEY (user_id, post_id)**: ek user ek post ko sirf ek baar like kar sakta hai, DB khud duplicate rok deta hai. `ON DELETE CASCADE`: user ya post delete ho to uske like-rows apne aap hat jati hain.
- **`posts.likes` counter bhi rakha** (sirf `post_likes` se `COUNT(*)` nahi): list page pe har post ke liye count join nahi karna padta. Dono ko ek transaction me sync rakhte hain (12.8).

Poora SQL aur comments `schema.sql` me hain. **PART 1** = naya DB, **PART 2** = purane live DB ka upgrade (dono me se sirf ek chalana).

### 12.4 Login ka poora safar

**Signup (`POST /signup`)**
```
form (+ _csrf token) → CSRF check ✓ → rate limit (10/ghanta/IP) ✓ → validateSignup (naam, email, password rules) ✓
  → bcrypt se password hash → INSERT INTO users (email UNIQUE: duplicate → 409 "pehle se account hai")
  → naya session banao { auth: {type:'user', id}, csrfToken } → redirect /posts (seedha login)
```

**Login (`POST /login` ya `POST /admin/login`)** — dono ek hi `createLoginHandler` factory se bane hain (`routes/auth.js`):
```
form → CSRF ✓ → validateLogin (email + password strings hain?) → rate limit check (blocked? → 429)
  → email se account dhundho (users ya authors)
  → bcrypt compare   [account na mile tab bhi dummy hash se compare chalta hai, taaki time se pata na chale]
  → galat? → counter badhao, 401 "Email ya password galat hai" (ek hi message dono galtiyon ke liye)
  → sahi? → counter reset → naya session → redirect (safe ?next= ya /posts)
```

**Har request pe (login ke baad)**
```
browser cookie bhejta hai → cookie-session signature verify (nakli cookie → guest)
  → loadCurrentUser: cookie ke (type, id) ko DB se confirm karta hai
      user: SELECT FROM users WHERE id=?
      admin: SELECT FROM authors WHERE id=? AND password_hash IS NOT NULL
    mila → req.currentUser = {type, id, name};  nahi mila → guest (cookie saaf)
  → route chalta hai, req.currentUser use karta hai
```
Is DB check ka fayda: user delete ho gaya ya admin ka `password_hash` NULL kar diya gaya (login band kiya) to uski purani cookie **turant** bekaar ho jati hai, 7 din tak nahi chalti.

**Logout (`POST /logout`)**: `req.session = null` → cookie hat jati hai. POST isliye ki GET link/image se koi bhi dusre ko logout nahi karwa sakta (CSRF token bhi lagta hai).

### 12.5 Permissions (kaun kya kar sakta hai)

| Action | Guest | Normal user | Admin |
|---|---|---|---|
| Posts padhna (`/posts`, `/posts/:id`) | ✅ | ✅ | ✅ |
| Post banana | ❌ → `/login` | ✅ (apne naam se) | ✅ (apne naam se) |
| Post edit / delete | ❌ → `/login` | ✅ **sirf `posts.user_id` = apni id** | ✅ **kisi ki bhi** |
| Like / unlike | ❌ (401 / login par bhejta hai) | ✅ | ❌ (403, sirf count dikhta hai) |

Saare rules **ek hi file** me hain: `utils/permissions.js`
- `canModifyPost(currentUser, post)`: admin → hamesha true; user → sirf jab `post.user_id === currentUser.id`.
- `ownerFilter(currentUser)`: UPDATE/DELETE ke `WHERE` me normal user ke liye `AND user_id = ?` jodta hai. Ye **defense in depth** hai: route pehle `canModifyPost` se check kar chuka hota hai, par check aur query ke beech kuch badal jaye tab bhi DB level pe user sirf apni hi row chhu paata hai.

**UI me button chhupana sirf suvidha hai, asli suraksha server pe hai.** Views me `canModify(post)` Edit/Delete button chhupata hai, par koi URL seedha khole (`/posts/5/edit`) ya curl se POST kare tab bhi `loadModifiablePost` (routes/blog.js) 403 deta hai. Test me ye verify hua.

Status codes: **401** = "tum kaun ho pata nahi" (login nahi; HTML requests ko login page par redirect, JSON ko 401), **403** = "tum ho, par tumhe permission nahi", **404** = post hai hi nahi / galat id.

### 12.6 Security features (kya, kyu, kahan)

| Cheez | Problem jo rokta hai | Kaise | Kahan |
|---|---|---|---|
| **bcrypt hash** (cost 12) | DB leak hone par passwords seedhe mil jana | one-way slow hash + random salt | `utils/password.js` |
| **Dummy hash compare** | Response time se pata chalna ki email registered hai (timing attack) | email na mile tab bhi bcrypt chalta hai | `utils/password.js`, `routes/auth.js` |
| **Ek hi error message** ("Email ya password galat") | Attacker ko registered emails ki list milna | "email galat" / "password galat" alag nahi batate | `routes/auth.js` |
| **Signed cookie** | Cookie me type/id badal ke admin ban jana | `SESSION_SECRET` se signature; badla to reject | `app.js` (cookie-session) |
| **httpOnly, sameSite=lax, secure(prod)** | JS se cookie chori (XSS), cross-site POST, HTTP pe cookie leak | cookie flags | `app.js` |
| **Naya session login pe** | Session fixation (attacker ka pehle se diya session) | login pe poora session object + CSRF token naya | `routes/auth.js` `startSession` |
| **CSRF token** | Dusri site se chhupe form se delete/like karwa dena | session ka random token, har POST pe match (timing-safe) | `middleware/csrf.js`, `includes/csrf-field.ejs`, `LikeButton.jsx` |
| **Rate limit** | Password baar-baar guess (brute force), fake signup spam | 5 galat/15 min per (IP+email), 20/15 min per IP, 10 signup/ghanta per IP | `middleware/rate-limit.js`, `routes/auth.js` |
| **Open redirect check** | `?next=https://evil.com` se login ke baad nakli site pe bhejna | sirf `/` se shuru hone wale apni site ke path | `utils/validation.js` `safeNextPath` |
| **Server-side validation** | Browser ke `required` bypass (curl), array/object bhej ke crash, bahut lamba input | har field type + length check, DB limits ke saath match | `utils/validation.js` |
| **`:id` check** | `/posts/abc`, `/posts/99999999999` se DB error / 500 | `router.param("id")` sirf valid int deta hai, warna 404 | `routes/blog.js`, `parseId` |
| **Parameterized queries** | SQL injection | hamesha `?` placeholders | sab queries |
| **EJS `<%= %>` escape** | XSS (naam me `<script>`) | EJS HTML escape karta hai (test me verify hua) | views |
| **Stale session revoke** | Delete hue user / band kiye admin ki cookie 7 din chalna | har request pe DB confirm | `middleware/auth.js` |
| **POST logout** | Image/link se zabardasti logout | GET route hai hi nahi | `routes/auth.js` |
| **Password 72 bytes limit** | bcrypt 72 bytes ke baad ignore karta hai (lamba password chupchap kat jata) | signup me reject | `utils/validation.js` |

### 12.7 INNER JOIN → LEFT JOIN kyu

Pehle posts query me `INNER JOIN authors` tha. INNER JOIN me match na mile to **poori row result se gayab** ho jati hai. Ab normal user ki post me `author_id` NULL hota hai, to wo `/posts` list me dikhti hi nahi aur `/posts/:id` pe 404 aata, bina kisi error ke.

Ab (`routes/blog.js` ka `POST_SELECT`):
```sql
SELECT posts.*,
       COALESCE(authors.Name, users.display_name) AS author_name,   -- jo non-NULL ho wahi naam
       authors.Email AS author_email,                               -- sirf admin ki post me (user ki email public nahi)
       EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = posts.id AND pl.user_id = ?) AS liked_by_me
FROM posts
LEFT JOIN authors ON posts.author_id = authors.id
LEFT JOIN users   ON posts.user_id   = users.id
```
`LEFT JOIN` me `posts` ki **har** row aati hai. Duplicate rows nahi aati, kyunki ek post ka `author_id` ya `user_id` sirf ek row se match hota hai (aur CHECK ki wajah se dono match nahi hote).

### 12.8 Likes kaise kaam karte hain

`POST /posts/:id/like` (`setLike` in `routes/blog.js`) ek **transaction** me:
1. Post hai? Nahi to 404.
2. **like**: `INSERT INTO post_likes` (duplicate → `ER_DUP_ENTRY`, matlab pehle se liked, kuch nahi badalna). **unlike**: `DELETE FROM post_likes` (1 row hati to hi aage badho).
3. Row sach me badli to hi `posts.likes` +1 / -1.
4. Naya count padh ke commit, JSON me `{ likes, liked }`.

Faide: double-click, do tabs, retry se count kabhi galat nahi hota (idempotent). Test me **15 parallel like requests = sirf +1**, aur 15 parallel unlike = wapas bilkul purana count.
- `COALESCE(likes, 0)`: purani rows me `likes` NULL ho sakta tha (6.2 dekho), `NULL + 1 = NULL` hota hai. Ab NULL ko 0 maan ke ginta hai.
- `GREATEST(..., 0)`: count kabhi negative nahi.
- **Purane likes** (jab user-wise record nahi tha) counter me as-is hain; naye likes unke upar jude. Un purane likes ko koi user "unlike" nahi kar sakta (`post_likes` me row hi nahi).

### 12.9 `.env` variables

| Variable | Zaruri? | Kaam |
|---|---|---|
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_PORT` | haan | MySQL connection (pehle jaisa) |
| `SESSION_SECRET` | **haan** (32+ characters) | Cookie ko sign karta hai. **Na ho to server start hi nahi hota.** Badal dene par sab log logout ho jate hain. Bana ne ke liye: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `TRUST_PROXY=1` | production me proxy ke peeche ho to | Asli client IP (rate limit) aur HTTPS (secure cookie) sahi pehchanne ke liye |
| `NODE_ENV=production` | production me | Cookie sirf HTTPS par jati hai |
| `DB_SSL_CA` | optional | Pehle jaisa (section 9, fix #8) |
| `LOG_FILE` | optional | Logs ko file me bhi likhna ho to path, jaise `logs/app.log`. Local par default yahi hai, production me default band (section 13) |
| `AI_DRAFTS_API_TOKEN` | AI generator ke liye | AI drafts API ka secret token (section 15.5). Na ho to API band rehta hai (503). Local `.env` + Render + GitHub Secrets teeno me **same** |
| `GEMINI_API_KEY` | sirf generator script ke liye | Google AI Studio ki free key (section 16). Local `.env` + GitHub Secrets. Render ko iski zaroorat nahi |
| `AI_DRAFTS_MAX_PENDING` | optional | Kitne pending drafts tak naye lena (default 10) |

### 12.10 Live DB par chalane ka checklist (ek baar)

1. **Backup / snapshot lo** (Aiven console se).
2. `schema.sql` ka **PART 2** upar se neeche order me chalao (SQL lines ka `--   ` hata ke; `-- ` (1 space) wali lines sirf explanation hain). Step 0 ka duplicate-email check pehle chalao, khali aana chahiye.
3. `.env` me `SESSION_SECRET` daalo (local `.env` me already daal diya gaya hai; Aiven/production host pe alag se set karna padega).
4. `npm install` (naye packages: `bcryptjs`, `cookie-session`).
5. Har admin ka password set karo:
   ```bash
   npm run set-admin-password                       # authors ki list + kiska password set hai
   npm run set-admin-password -- alice@example.com  # password type karo (screen pe nahi dikhta), 2 baar
   ```
   Script automation ke liye `echo "pw" | npm run set-admin-password -- email` bhi support karti hai. Jab tak password set nahi hota, wo author `/admin/login` se login nahi kar sakta.
6. `npm start`, `/admin/login` se login karke check karo.

### 12.11 File map (kaunsi file kya karti hai)

| File | Kaam |
|---|---|
| `app.js` | session + auth + CSRF middleware ka order, `SESSION_SECRET` check, 404 handler |
| `routes/auth.js` | signup / login / admin login / logout, rate limits, `startSession` |
| `routes/blog.js` | posts routes, `POST_SELECT` (LEFT JOIN), `loadModifiablePost`, `setLike` transaction |
| `middleware/auth.js` | `loadCurrentUser`, `requireLogin`, `requireNormalUser`, `requireAdmin` (section 15), `redirectIfLoggedIn` |
| `middleware/csrf.js` | token banana + har POST par verify |
| `middleware/rate-limit.js` | in-memory counter (`isBlocked`, `hit`, `reset`) |
| `utils/permissions.js` | `canModifyPost`, `ownerFilter` |
| `utils/validation.js` | `validatePost/Signup/Login`, `parseId`, `safeNextPath`, `checkPasswordRules` |
| `utils/password.js` | `hashPassword`, `verifyPassword`, `DUMMY_HASH` |
| `utils/async-handler.js` | async route ke error ko `next()` se 500 page tak pahunchata hai |
| `utils/logger.js` | `logger.info/warn/error`: console + (local par) `logs/app.log` (section 13) |
| `middleware/request-logger.js` | har request ki log line, 5xx = ERROR, 4xx = WARN (section 13) |
| `scripts/set-admin-password.js` | admin ka password set karne ki CLI |
| `views/login.ejs`, `signup.ejs`, `admin-login.ejs`, `403.ejs` | naye pages |
| `views/includes/like-widget.ejs`, `csrf-field.ejs`, `form-error.ejs` | naye reusable tukde |
| `views/includes/header.ejs` | login ki halat ke hisaab se navbar (Login/Sign up ya naam + Admin badge + Logout) |
| `public/react/LikeButton.jsx` | server se liked state, guest/admin modes, CSRF header |
| `public/styles/base.css, forms.css, posts.css` | navbar user area, logout button, form error/hint, disabled like |

### 12.12 Kya test hua (2026-10-19)

Local MySQL par fresh schema banake app chalayi aur 109 automated checks (curl, har role ka alag cookie jar) chalaye: **109 pass, 0 fail**, server log me koi error nahi. Covered:
- Guest: posts dikhte hain (LEFT JOIN), `/new-post` → login redirect, bina CSRF POST → 403, like → 401, galat id → 404.
- Signup validation: chhota password, mismatch, galat email, chhota naam, array/object injection, 72+ byte password, duplicate email (alag case me bhi) → 409; email lowercase me save, password bcrypt hash me.
- User: apni post create/edit/delete ✅, dusre user ki aur admin ki post par edit/delete/GET edit → 403; form me `author_id`/`user_id` bhejna ignore.
- Admin: kisi ki bhi post edit/delete ✅, owner badalta nahi, create par apna `author_id`, form ka `author` ignore, admin like → 403.
- Likes: idempotent like/unlike, `data-liked` sahi, post delete par likes cascade, 15 parallel requests.
- Session: nakli cookie → guest, logout (POST only, CSRF ke saath), delete hua user aur band kiya gaya admin → purani cookie bekaar, CSRF token login par badalta hai.
- `?next=` safe/unsafe, rate limit (6th galat attempt → 429), XSS (naam me `<b>` escaped).
- Browser (Chrome headless) me navbar desktop + mobile, form pages screenshot se dekhe.

### 12.13 Gotchas (aage kuch badalte waqt dhyan rakhna)

1. **Naya POST form banao to `<%- include('includes/csrf-field') %>` zaroor lagao**, warna 403 aayega. `fetch()` ho to header `x-csrf-token` bhejo (meta tag se).
2. **Naya route jo data badalta hai** to `requireLogin` lagao, aur kisi ki cheez badalta ho to permission check bhi (`canModifyPost` jaisa). Sirf view me button chhupana kaafi nahi.
3. **Posts ki naye query me `INNER JOIN authors` mat likhna**, `POST_SELECT` use karo ya `LEFT JOIN` rakho (12.7).
4. **Template me `locals.x`** likho agar `x` har render me nahi aata (`currentUser`, `csrfToken`, `message`, `error`), warna EJS "x is not defined" se crash hota hai.
5. **`SESSION_SECRET` badla to sab logout** ho jate hain (normal hai).
6. **Duplicate signup se auto-increment id "kha" jati hai** (InnoDB behaviour), `users.id` me gaps aa sakte hain. Normal hai, bug nahi.
7. **Nodemon restart par rate limit counters reset** hote hain (in-memory hain).
8. **Admin ka password hata do** (`UPDATE authors SET password_hash = NULL WHERE id = ?`) to uska login aur uski chalti hui session dono band.

### 12.14 Jaanboojh ke chhode hue limits / aage ke options

- **Forgot password / email verification nahi hai** (email bhejne ka system chahiye). Abhi user ka password bhoolne par admin DB me hi badal sakta hai.
- **Rate limiter in-memory hai**: server restart par reset, aur kai server instances ho to har ka apna counter. Bade scale par Redis chahiye.
- **cookie-session** me session server pe nahi, cookie me hai: "sab devices se logout" ya "password badalte hi purane sessions band" abhi nahi hai (sirf account delete / admin ka hash NULL karne se band hote hain). Agar ye chahiye to server-side session store (DB table) lagana padega.
- **Admin ke likes nahi**: `post_likes.user_id` sirf `users` ko point karta hai. Chahiye to `post_likes` me `author_id INT NULL` add karo, PK hata ke alag `id` PK lagao, aur `(user_id, post_id)` tatha `(author_id, post_id)` pe UNIQUE keys.
- **User delete / profile edit / password change page nahi hai.**
- **Security headers (CSP, helmet) nahi lagaye**: site CDN scripts (unpkg React/Babel) aur inline `onsubmit` use karti hai, strict CSP unhe tod deti. Babel hatane ke baad (section 11) CSP lagana asaan hoga.
- `npm audit` me **express/body-parser** ki purani warnings pehle se thi (is kaam se pehle ki). `npm audit fix` alag se karna chahiye, maine nahi chhua.

## 13. Logging & Health check (2026-11-23)

Senior ki salah thi: server par kuch toote to logs se turant pata chale ki **kya, kab, kis page par aur kyun** toota. Pehle error handler sirf `console.log(error)` karta tha: na URL pata chalta tha, na time, na ye ki server sahi start hua ya nahi.

### 13.1 Logs kahan jate hain

| Jagah | Kab | Kaise dekhein |
|---|---|---|
| **Console** (stdout/stderr) | **hamesha**, local aur Render dono par | Local: terminal. Render: Dashboard → service → **Logs** tab |
| **`logs/app.log` file** | sirf local par (default), ya jab `LOG_FILE` set ho | file kholo. `logs/` gitignored hai |

**Render par file kyu nahi?** Render ki disk har deploy / restart par saaf ho jati hai. File wale logs theek tab gayab ho jate jab unki sabse zyada zarurat hoti (crash ke baad). Render console ka output khud apne Logs tab me sambhal ke rakhta hai, isliye production ke liye console hi sahi jagah hai.

### 13.2 Kya-kya log hota hai

Har line ka format: `<time> <LEVEL> <message> {extra JSON}`

```
2026-11-23T14:44:52.839Z INFO  Server started {"port":3000,"env":"production"}
2026-11-23T14:44:52.852Z INFO  Database connection OK
2026-11-23T14:44:55.300Z INFO  GET /posts 200 42ms {"ip":"1.2.3.4","user":"user#3"}
2026-11-23T14:44:55.421Z WARN  GET /does-not-exist 404 2ms {"ip":"1.2.3.4","user":"guest"}
2026-11-23T14:44:55.397Z ERROR Request failed {"method":"GET","url":"/posts","error":{"code":"ECONNREFUSED","stack":"... routes/blog.js:93 ..."}}
2026-11-23T14:44:55.406Z ERROR GET /posts 500 12ms {"ip":"1.2.3.4","user":"guest"}
```

| Kya | Kahan se | Level |
|---|---|---|
| Server start (port, env) | `app.js` (`app.listen`) | INFO |
| Startup par database check (`SELECT 1`) | `app.js` | INFO / ERROR |
| Har page / API request (method, URL, status, ms, ip, user) | `middleware/request-logger.js` | 2xx/3xx = INFO, 4xx = WARN, 5xx = ERROR |
| Route crash (URL + poora stack trace) | `app.js` error handler | ERROR |
| `/health` fail | `app.js` | ERROR |
| Request ke bahar crash (`unhandledRejection`, `uncaughtException`) | `app.js` | ERROR |
| `SESSION_SECRET` missing | `app.js` | ERROR |

**Kya log NAHI hota (jaanboojh ke):** password, cookie, CSRF token, form ka data (request body), aur static files (CSS/JS/images, bahut shor hota).

### 13.3 `/health` endpoint

`https://<aapki-site>/health` kholo:
- `{"status":"ok","database":"ok","uptimeSeconds":123}` → server + DB dono theek.
- `{"status":"error","database":"unreachable"}` (status 503) → server chal raha hai par DB se connection nahi.

Session / CSRF se **pehle** mount hai, kyunki use inki zarurat nahi. Render Settings me **Health Check Path = `/health`** daal do to Render khud monitor karega.

### 13.4 Kuch toote to kya karein (debugging checklist)

1. Render → Logs tab kholo. `ERROR` search karo.
2. `Request failed` wali line me `url` (kaunsa page) aur `stack` (code ki kaunsi file + line) dekho.
3. `Database connection FAILED` ya `ECONNREFUSED` / `ER_ACCESS_DENIED_ERROR` → code nahi, DB settings (`.env` / Render environment) check karo.
4. `Server started` line hi nahi aayi → app start hote hi crash hua, uske upar ki lines padho (jaise `SESSION_SECRET` missing).
5. Shak ho ki site chal rahi hai ya nahi → `/health` kholo.

### 13.5 Aage ke options (abhi nahi kiye)
- Naye code me `console.log` ki jagah `const logger = require("../utils/logger")` aur `logger.info/warn/error` use karo, taaki sab logs ek format me rahein. (`data/database.js` ki SSL warning aur `scripts/set-admin-password.js` abhi bhi `console` use karte hain.)
- Render ke free plan par logs kuch hi din tak rehte hain. Lambe time ke liye log service (Better Stack, Papertrail etc.) jodi ja sakti hai.
- Bahut traffic ho to request logs zyada ho jayenge; tab `pino` jaisi library + log level setting lagana behtar.

## 14. Site ka text English me (2026-11-23)

Users ko dikhne wala saara text pehle kuch jagah Hinglish me tha (jaise "Naye ho? Account banao", "Email ya password galat hai."), jo professional nahi lagta. Ab sab English me hai. Sirf text badla, logic nahi.

| Kahan | Kya badla (example) |
|---|---|
| `views/login.ejs`, `signup.ejs`, `admin-login.ejs` | "New here? Create an account", "Already have an account? Log in", "At least 8 characters." |
| `views/post-detail.ejs`, `views/includes/post-item.ejs` | delete popup: "Are you sure you want to delete this post?" |
| `views/403.ejs` | "You do not have permission to perform this action." |
| `utils/validation.js` | form errors: "Invalid email or password.", "Passwords do not match.", "Title cannot exceed 255 characters." |
| `routes/auth.js` | "Too many failed attempts. Please try again in 15 minutes.", "An account with this email already exists. Please log in." |
| `middleware/auth.js`, `middleware/csrf.js` | like / security token ke errors: "Please log in.", "Admin accounts cannot like posts." |

**Dhyan rakhna:** code ke comments aur yeh `ARCHITECTURE.md` abhi bhi Hinglish me hain (ye users ko nahi dikhte). Naya text jo **site par dikhe** (page, error message, popup) wo English me hi likhna.

### 14.1 Pending: Render deploy aur `npm start`
- `package.json` me `"start": "nodemon app.js"` hai. `nodemon` devDependency hai; agar Render par `NODE_ENV=production` set ho to wo install nahi hota aur deploy fail ho jata hai (Render purana version hi chalata rehta hai). Production ke liye `"start": "node app.js"` aur `"dev": "nodemon app.js"` behtar hai. **Abhi badla nahi.**
- GitHub par push karne ke baad bhi site na badle to Render → Events/Deploys me deploy status, Auto-Deploy setting aur branch (`main`) check karo.

## 15. AI Posts: admin review portal (2026-11-24)

### 15.1 Seedhi baat (ek example se)

Socho ek **akhbaar (newspaper)** hai:
- **Reporter** khabar likh ke editor ki table pe rakh deta hai.
- **Editor** padhta hai. Achhi lagi to chhapne bhej deta hai, thodi galti ho to sudhaar deta hai, bekaar ho to fenk deta hai.
- Reporter khud kabhi akhbaar me kuch nahi chhaap sakta.

Hamari site me:
- **Reporter = AI** (section 16 ka generator). Wo post likh ke `ai_drafts` table me "pending" banake rakh deta hai.
- **Editor's table = `/admin/ai-posts` page.** Sirf admin ko dikhta hai.
- **Editor = tum (admin).** Approve karoge to post site pe tumhare naam se chhap jayegi. Reject karoge to kabhi nahi chhapegi.

**Sabse zaroori rule:** AI kabhi seedha site pe post nahi daal sakta. Har post admin ke Approve button se hi live hoti hai.

### 15.2 Poora safar (diagram)

```
AI generator (GitHub Actions)
      │  POST /api/ai-drafts  (secret token ke saath)
      ▼
ai_drafts table  →  status = "pending"
      │
      ▼
Admin: /admin/ai-posts  (navbar me "AI Posts 3" badge = 3 pending)
      │
      ├── [Review]  → poora preview, bilkul waisa jaisa site pe dikhega
      ├── [Edit]    → title / summary / content / sources sudhaaro (approve se pehle)
      ├── [Approve & publish] → posts table me nayi post, author = tum, ai_assisted = 1
      │                          ai_drafts.status = "approved"
      └── [Reject…] → reason likho (optional) → status = "rejected"
                      site pe kabhi nahi dikhegi, lekin record bacha rehta hai
```

### 15.3 `ai_drafts` table (migration `001-ai-drafts.sql`)

Ek row = AI ka ek draft. Example row:

| Column | Example value | Matlab |
|---|---|---|
| `id` | 7 | draft ka number |
| `title` | Finding Your Drive When You Feel Stuck | post ka title |
| `summary` | How to build lasting motivation… | chhota description |
| `body` | (poora article) | post ka text |
| `sources` | `What Was Really Behind My "Laziness" (Patrick Dahlstrom, Tiny Buddha): https://…` | ek line = ek source. Approve pe post ke end me "Sources:" list ban ke judta hai |
| `topic` | motivation | kis topic pe hai (AI aage same topic baar-baar na le) |
| `status` | `pending` / `approved` / `rejected` | abhi kis halat me hai |
| `reject_reason` | "Too generic" | reject ka reason (AI agli baar isse seekhta hai) |
| `reviewed_by` | 1 | kis admin ne approve/reject kiya (`authors.id`) |
| `reviewed_at` | 2026-11-24 10:15 | kab |
| `post_id` | 12 | approve hone pe jo post bani uska id |
| `created_at`, `updated_at` | | kab bana, kab badla |

**Posts me `status` column kyun nahi daala, alag table kyun?**
Agar drafts bhi `posts` me hote, to site ki **har** query (list, detail, likes…) me `WHERE status = 'published'` likhna padta. Ek jagah bhi bhool gaye, to unapproved post public ho jaati. Alag table me ye galti ho hi nahi sakti, aur purane `posts` code ko chhedna bhi nahi pada.

### 15.4 Pages aur buttons

| URL | Kya hai | Kaun |
|---|---|---|
| `GET /admin/ai-posts` | list. Tabs: Pending / Approved / Rejected (har tab me ginti) | sirf admin |
| `GET /admin/ai-posts/:id` | ek draft ka preview + buttons | sirf admin |
| `GET/POST /admin/ai-posts/:id/edit` | edit form (sirf pending draft) | sirf admin |
| `POST /admin/ai-posts/:id/approve` | publish (confirm popup ke baad) | sirf admin |
| `POST /admin/ai-posts/:id/reject` | reject (reason optional) | sirf admin |

- Normal user ye URL khole to **403**. Guest khole to **login page**.
- Approved ya rejected draft dobara approve/edit nahi hota (**409**). Approve ho chuki post badalni ho to normal post ki tarah `/posts/:id/edit` se badlo.

### 15.5 AI ke liye API (`routes/ai-drafts-api.js`)

Ye wo "darwaza" hai jahan se AI script draft andar bhejti hai. Browser ke liye nahi hai, script ke liye hai, isliye login/cookie nahi, **secret token** lagta hai. Token ko aise samjho jaise ghar ki chaabi: jiske paas token hai wahi andar draft rakh sakta hai.

| API | Kaam |
|---|---|
| `POST /api/ai-drafts` | naya draft "pending" banake rakhta hai. **Kabhi publish nahi karta.** |
| `GET /api/ai-drafts/context` | script ko batata hai: queue me jagah hai? pichle topics, sources, reject reasons |

Example (local pe test karne ke liye):
```bash
curl -X POST http://localhost:3000/api/ai-drafts \
  -H "Authorization: Bearer <AI_DRAFTS_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","summary":"Test summary","body":"Hello","sources":["https://example.com"]}'
# jawab: {"id":5,"status":"pending"}
```

Jawab ke codes:

| Code | Matlab |
|---|---|
| 201 | draft ban gaya |
| 400 | data galat (title/summary/body missing ya bahut lamba) |
| 401 | token galat ya nahi bheja |
| 429 | queue full (10 pending), ya galat token se bahut try (15 min block) |
| 503 | server pe `AI_DRAFTS_API_TOKEN` set hi nahi hai, isliye API band hai |

### 15.6 Suraksha (kya-kya socha gaya)

- **Admin check server pe:** har `/admin/ai-posts` route `requireLogin` + `requireAdmin` ke peeche hai. Sirf link chhupana kaafi nahi hota.
- **CSRF:** Approve/Reject/Edit forms me CSRF token hai (section 12.6). Koi nakli site tumhare naam se approve nahi kara sakti.
- **Double-click se do posts nahi bantein:** approve ek transaction me hota hai aur draft ki row `SELECT … FOR UPDATE` se lock hoti hai. Example: tumne Approve 2 baar jaldi-jaldi dabaya. Pehla click post banata hai, doosra wait karta hai, phir dekhta hai ki status "approved" ho chuka hai aur ruk jata hai.
- **Queue limit 10:** tum kuch din review na karo to bhi AI bekaar me drafts nahi banata rehta.
- **Links safe:** sources me sirf `http(s)://` wale links clickable bante hain. `javascript:…` jaisa text sirf text rehta hai.
- **Token:** galat token baar-baar (20 baar / 15 min) bhejne wala IP block hota hai, aur token compare karne ka tareeka timing attack se safe hai.

### 15.7 Files

| File | Kaam |
|---|---|
| `routes/admin-ai-drafts.js` | portal ke saare routes + navbar badge ka pending count (`loadAiPendingCount`) |
| `routes/ai-drafts-api.js` | `POST /api/ai-drafts`, `GET /api/ai-drafts/context` (session/CSRF se **pehle** mount, `app.js` dekho) |
| `utils/ai-drafts.js` | draft validation, sources ko body ke end me jodna, max pending |
| `middleware/auth.js` | `requireAdmin` |
| `views/admin-ai-posts.ejs`, `admin-ai-post-review.ejs`, `admin-ai-post-edit.ejs` | teen pages |
| `views/includes/header.ejs` | admin ke navbar me "AI Posts (n)" link |
| `public/styles/admin.css` | portal ki styling (dark mode bhi) |
| `migrations/001-ai-drafts.sql` | table banana (end me undo ka `DROP` bhi likha hai) |

## 16. AI post generator: har 12 ghante apne aap draft (2026-11-24)

### 16.1 Seedhi baat

Ek chhota **robot (script)** hai jo din me 2 baar (subah 5:47 aur shaam 5:47, IST) apne aap uthta hai aur:
1. Tumhari site se poochta hai: "Queue me jagah hai?"
2. Ek topic chunta hai (jaise *overthinking*).
3. Internet se **asli logon ke likhe articles** padhta hai (jaise Tiny Buddha pe logon ki apni kahaniyan).
4. **Google Gemini (AI)** se un sab ke experiences mila ke **apne shabdon me** ek nayi post likhwata hai.
5. Code se jaanchta hai ki copy-paste ya nakli quote to nahi.
6. Draft tumhare portal (section 15) me "pending" bhej deta hai.

Robot chalta hai **GitHub ke computer pe** (GitHub Actions), tumhare laptop pe nahi. Laptop band ho tab bhi chalega.

**Kharcha: ₹0.** Gemini ka free tier, RSS feeds free, GitHub Actions public repo ke liye free.

### 16.2 Free kaise hua (aur kya try karke chhoda)

| Socha tha | Kya hua | Kya kiya |
|---|---|---|
| Claude API | paid hai | chhoda (student budget) |
| Gemini + Google Search (AI khud search kare) | free tier me Gemini 3.x pe search **nahi** milta, aur Gemini 2.5 naye users ke liye band hai | search ki jagah **RSS** |
| **RSS feeds** se articles + Gemini sirf likhe | dono free, koi extra key nahi | ✅ ye chal raha hai |

**RSS kya hai?** Jaise YouTube pe kisi channel ko subscribe karo to naye videos ki list mil jaati hai, waise hi blogs ek **RSS feed** dete hain: naye posts ki list (title, author, link, aur kai blogs me poora text). Ye banaya hi isliye jata hai ki dusre programs padh sakein. Example: `https://tinybuddha.com/tag/overthinking/feed/` kholo, overthinking wale latest 10 posts dikhenge.

### 16.3 Ek run ka poora safar (asli log ke saath)

```
2026-11-24T08:05:51Z AI generator start. site=https://… dryRun=false
2026-11-24T08:05:51Z Queue: 0/10 pending                       ← 1) jagah hai
2026-11-24T08:05:51Z Topic: overthinking                       ← 2) topic chuna
2026-11-24T08:05:54Z Articles: 5 (Tiny Buddha ×4, James Clear)  ← 3) 5 alag logon ke articles
2026-11-24T08:06:08Z   gemini-3.8-flash busy (503), retrying in 20s   ← Gemini busy tha
2026-11-24T08:07:32Z Attempt 1: model=gemini-3.6-flash words=1215 ok=true   ← 4+5) likha, checks pass
2026-11-24T08:07:32Z Draft #3 sent (topic=overthinking, … sources=4)       ← 6) portal me pahunch gaya
```

Ek run me ~2 minute lagte hain.

### 16.4 Topics (`scripts/ai-generator/topics.js`)

6 topics: **habits, overthinking, motivation, productivity, relationships, confidence**.

**Agla topic kaise chunta hai:** pichle ~40 drafts me jo topic **sabse kam** aaya ho, wahi. Aur jo pichli baar likha tha wo turant dobara nahi.
Example: habits 3 baar, overthinking 3, motivation 2, baaki 2-2 → agla topic motivation/productivity/relationships/confidence me se koi ek (random).

Naya topic jodna ho to `TOPICS` list me ek line jod do (Tiny Buddha ka tag naam bhi dena hoga).

### 16.5 Research kahan se (`sources.js`)

| Source | Feed | Kya milta hai |
|---|---|---|
| **Tiny Buddha** | `tinybuddha.com/tag/<topic>/feed/` (+ page 2) | aam logon ki first-person kahaniyan, poora text (1000-1900 shabd) |
| **James Clear** | `jamesclear.com/?s=<topic>&feed=rss2` | habits/productivity pe articles |

**Article chunne ke rules:**
- kam se kam **400 shabd** (sirf teaser wale nahi)
- har article **alag author** ka (taaki ek hi insaan ki baat copy na ho, kai logon ke experiences mile)
- jo article pehle kisi draft me use ho chuka, wo dobara nahi
- Tiny Buddha se max 4, James Clear se max 1. Kul 3-5 articles. 3 se kam mile to run ruk jata hai.
- AI ko har article ke pehle 1200 shabd hi bheje jaate hain (free tier ke tokens bachane ke liye).

**robots.txt ka dhyan:** har site ek `robots.txt` file rakhti hai jisme likha hota hai ki bots kya padh sakte hain. Tiny Buddha ne apne **search** (`/?s=`) ko bots ke liye mana kiya hai, isliye hum search nahi, **tag feeds** use karte hain (wo allowed hain). James Clear sab allow karta hai.

### 16.6 AI se likhwana (`prompts.js` + Gemini)

**AI ko diye gaye rules (short me):**
- sab kuch **apne shabdon me**, kam se kam 3 sources ke ideas mila ke
- 2-4 **chhote quotes** (25 shabd tak), hubahu source se, naam ke saath. Example: `"Perfection as a destination is what causes procrastination." (Chris Wilson, Tiny Buddha)`
- koi nakli quote, naam, kahani ya number **nahi**
- medical/dawai ki salah nahi. Anxiety/depression jaisa topic ho to professional se baat karne ki salah
- plain text (site Markdown nahi dikhati), 900-1300 shabd
- pichle titles jaisa title nahi, aur admin ke reject reasons dhyan me rakhna

**Jawab ka format fix hai (JSON):** `{ title, summary, body, usedSources: [1, 3, 4] }`. Gemini ko schema diya jata hai, to format galat nahi aata.

**Models (sab free):** `gemini-3.8-flash` → `gemini-3.6-flash` → `gemini-3.5-flash-lite`. Free tier me ye aksar "high demand" (503) bolte hain, aur ye busy-pan kuch minute me aata-jaata hai. Isliye script **rounds** me try karti hai:

```
Round 1: 3.8 busy → 3.6 busy → lite busy → 30 sec ruko
Round 2: 3.8 busy → 3.6 ✅ post mil gayi
(nahi mili to: 1 min ruko → round 3 → 2 min → round 4 → 4 min → round 5)
```

- Ek request **2 minute** me jawab na de to kaat di jaati hai (ek baar ek request 4.5 minute latki rahi thi).
- Poore run me Gemini pe **max 15 minute**. Uske baad saaf error ke saath ruk jaati hai (workflow ki limit 25 min hai).
- 429 (free limit khatam) wala model us run me dobara try nahi hota. 400/401/403 (key galat) pe turant ruk jaati hai, kyunki wait karne se key theek nahi hogi.

**2026-11-24 ki ghatna:** haath se chalaya run laal (fail) hua. Wajah: teeno models ek saath 503 de rahe the, aur purana code har model ko sirf 1 retry deta tha. Isi ke baad rounds wala tareeka aaya.

### 16.7 Code se jaanch (`checks.js`)

AI pe aankh band karke bharosa nahi. Draft bhejne se pehle ye 3 check:

| Check | Kaise | Example |
|---|---|---|
| **Copy-paste** | quotes hata ke, post ka har **12 shabdon** ka tukda sources se milate hain | source me likha tha *"I spent years believing that if I just worked harder I would finally feel enough"* aur AI ne bina quotes ke wahi 12 shabd likh diye → **fail** |
| **Nakli quote** | har quote ke shabd lagaatar kisi source me hone chahiye | AI ne `"Kindness is the best medicine" (Jane, Tiny Buddha)` likha, par kisi source me ye line hai hi nahi → **fail** |
| **Format** | title 10-120 chars, summary 20-250, body 600-2200 shabd, quote 35 shabd se lamba nahi | 300 shabd ki post → **fail** |

Fail hua to AI ko galti batakar **ek baar dobara** likhwate hain. Doosri baar bhi fail → draft **nahi** bheja jata, run laal (failed) dikhta hai. Markdown ke `#`, `**` jaise nishaan apne aap saaf ho jaate hain.

### 16.8 "AI-assisted" label (migration `002-ai-assisted.sql`)

- `posts` me naya column `ai_assisted` (0/1). Approve karte hi 1 lagta hai.
- Post page pe title/author ke neeche: **"AI-assisted · Reviewed by Harsh Sharma"** (naam = jis admin ne approve kiya, post usi ke naam se banti hai).
- Normal posts (insaan ki likhi) pe 0, koi label nahi.
- Review page ke preview me bhi ye label dikhta hai, taaki approve se pehle pata ho.

### 16.9 GitHub Actions: robot ko kaun jagata hai (`.github/workflows/ai-post.yml`)

GitHub Actions = GitHub ka free computer jo tumhare bataye time pe tumhara code chala deta hai.

```yaml
cron: "17 0,12 * * *"
```
Is line ka matlab: **har din, 00:17 aur 12:17 baje (UTC)**. India UTC se 5:30 ghante aage hai, to **5:47 AM aur 5:47 PM IST**.
(Cron ke 5 hisse: minute, ghanta, din, mahina, hafte ka din. `17 0,12 * * *` = minute 17, ghanta 0 aur 12, har din, har mahina, har weekday.)

**Minute 17 kyun, 0 kyun nahi?** Ghante ki shuruaat (`:00`) pe duniya bhar ke scheduled jobs ek saath chalte hain, GitHub pe sabse zyada bheed hoti hai, aur runs late hote hain ya **chhoot jaate hain**. Pehle `0 0,12` tha, aur 2026-11-24 ka 5:30 PM wala run chala hi nahi. Isliye ek "ajeeb" minute rakha.

Har run me: code checkout → Node 22 → `npm ci` → `npm run generate-post` (secrets env me milte hain).

**Haath se chalana:** GitHub repo → **Actions** → **AI post generator** → **Run workflow**.

**Dhyan rakhna:**
- Schedule sirf `main` branch ki file se chalta hai.
- GitHub ke schedule kabhi-kabhi 10-60 minute late chalte hain, aur bheed me koi run **chhoot bhi sakta hai** (GitHub ki docs khud ye kehti hain). Ek run chhoote to agla 12 ghante baad aayega. Turant draft chahiye to **Run workflow** button se haath se chala do.
- **60 din ka rule:** public repo me 60 din tak koi commit na ho to GitHub scheduled workflows band kar deta hai. Actions tab me **Enable** dabana padega.
- **Public repo ke logs sab dekh sakte hain**, isliye script logs me sirf topic, draft id aur counts likhti hai, post ka content nahi. Secrets kabhi logs me nahi dikhte.
- Do run ek saath nahi chalte (`concurrency`).

### 16.10 Kaunsi setting kahan rakhi hai

Teen jagah hain, aur teeno alag computers ke liye hain:

| Setting | Laptop (`.env`) | Render (live site) → Environment | GitHub → Settings → Secrets → Actions |
|---|---|---|---|
| `AI_DRAFTS_API_TOKEN` | ✅ | ✅ (site token check karti hai) | ✅ (script token bhejti hai) |
| `GEMINI_API_KEY` | ✅ (local test ke liye) | ❌ zaroorat nahi | ✅ |
| `SITE_URL` | optional (default `http://localhost:3000`) | ❌ | ✅ live site ka link, end me `/` nahi |

**Yaad rakhne ka tareeka:** token = chaabi. Site (Render) ke paas taala hai, script (GitHub) ke paas chaabi. Dono me **same** token hona chahiye.

Token banana: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
Gemini key: aistudio.google.com → Get API key → Create.

### 16.11 Local pe kaise chalayein

```bash
DRY_RUN=1 npm run generate-post   # sirf terminal me post dikhata hai, kahin bhejta nahi (test ke liye best)
npm run generate-post             # asli draft banake SITE_URL (default localhost:3000) pe bhejta hai
```
Local server (`npm start`) chal raha hona chahiye, warna "Site unreachable" aayega.

### 16.12 Kuch toote to kya karein

GitHub → Actions → laal (failed) run kholo → "Generate draft" step ka log padho. Last line `FAILED: …` batayegi kya hua:

| Log me dikhe | Matlab | Kya karo |
|---|---|---|
| **Run hi nahi dikh raha** (Actions tab me us time ka "schedule" run nahi) | GitHub ne bheed me run late kiya ya chhod diya. Setup ki galti nahi | 1 ghanta ruko. Phir bhi nahi to **Run workflow** se haath se chalao. Har baar chhoote to workflow "active" hai ya nahi dekho (60 din wala rule) |
| `Queue is full … Skipping` | 10 drafts pending hain (ye error nahi, run green hi rehta hai) | portal pe drafts review karo |
| `Context request failed (401)` | GitHub ka token aur Render ka token alag hai | dono jagah same token daalo |
| `Context request failed (503)` | Render pe `AI_DRAFTS_API_TOKEN` set nahi | Render env me daalo, redeploy |
| `Site unreachable` | `SITE_URL` galat, ya site down | secret check karo, `/health` kholo |
| `All Gemini models failed … 429` | free limit khatam / Google ne free tier badla | thoda wait. Baar-baar ho to AI Studio me limits dekho |
| `All Gemini models failed … 503` | Gemini 15 minute tak lagaataar busy raha (script ne 5 rounds try kiye) | kuch nahi, agla run 12 ghante baad apne aap. Jaldi chahiye to 1-2 ghante baad **Run workflow** |
| `Gemini rejected the request (400/401/403)` | Gemini key galat / delete ho chuki | AI Studio me nayi key banao, GitHub Secret `GEMINI_API_KEY` badlo |
| `Only 2 usable articles` | feeds down ya saare articles pehle use ho chuke | thode din me naye articles aa jayenge. Bahut baar ho to `topics.js` / `sources.js` me naya source jodo |
| `Draft failed checks twice` | AI ne copy kiya / nakli quote | kuch nahi, agla run naye sirse try karega |
| Approve pe error (live site) | Aiven pe migration 002 nahi chali | `migrations/002-ai-assisted.sql` Aiven pe chalao |

### 16.13 Limits aur aage ke options

- **Free tier kabhi bhi badal sakta hai.** Google limits ya terms badle to script ruk sakti hai. Site pe koi asar nahi padega. Tab paid model (Gemini paid / Claude) pe switch karna `generate-post.js` me chhota sa badlav hai.
- Free tier me Google content ko apne AI sudharne me use kar sakta hai. Posts waise bhi public hain, isliye yahan dikkat nahi.
- Research sirf RSS se hai. Isliye utna gehra nahi jitna "AI khud web search kare" me hota. Naye source jodne ho to `sources.js` me feed URL jodo (pehle us site ka `robots.txt` check karna).
- Reddit/Quora jaan-boojh ke nahi: unki terms automated access pe rok lagati hain.
- **Gemini key rotate karna:** key kabhi chat/kahin aur likhi gayi ho to AI Studio me nayi key banao, `.env` + GitHub Secret me badlo, purani delete karo.

## 17. Local MySQL reset (2026-11-24)

**Kya hua tha:** `npm start` pe `Database connection FAILED … ECONNREFUSED` aa raha tha. Code me galti nahi thi, **MySQL hi band tha**.
**Kyun:** Homebrew ne MySQL ko 9.5 se 26.7 pe upgrade kar diya. 26.7 purane 9.5 ka data folder nahi khol sakta (`Cannot upgrade from 90500 to 260700`), isliye start hote hi band ho jata tha.
**Kya kiya:** local data sirf testing ka tha, to purana folder hata ke naya khali MySQL banaya, `schema.sql` se tables banaye, aur admin dobara banaya.

**Aage kabhi `ECONNREFUSED` aaye (laptop pe) to:**
1. `brew services list` → mysql `started` hai?
2. Nahi to MySQL ka log dekho: `ls -t /opt/homebrew/var/mysql/*.err | head -1 | xargs tail -20`
3. Usme `Cannot upgrade` dikhe → wahi upgrade wali problem. `brew upgrade` se pehle dhyan rakhna.

**Naya local DB setup (yaad ke liye):**
```bash
mysql -uroot -e "CREATE DATABASE blog"
mysql -uroot blog < schema.sql
mysql -uroot blog -e "INSERT INTO authors (Name, Email) VALUES ('Naam', 'email@example.com')"
npm run set-admin-password -- email@example.com
```

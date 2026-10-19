# MyBlog — Architecture & Reference Guide

> Future reference ke liye banaya gaya. Project ko dobara samajhna ho to yahin se shuru karo.
> Last updated: 2026-10-19 (login / signup / admin / permissions add hue, section 12 dekho)

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

## 3. Folder structure

```
myBlog/
├── app.js                  ← Entry point. Server yahin se start hota hai (session + CSRF middleware yahin lagte hain)
├── schema.sql              ← DB tables ka SQL (PART 1 = fresh DB, PART 2 = purane DB ka upgrade)
├── package.json            ← Dependencies + scripts ("npm start", "npm run set-admin-password")
├── .env                    ← DB credentials + SESSION_SECRET (gitignored, kabhi commit mat karna)
├── data/
│   └── database.js         ← MySQL connection pool
├── routes/
│   ├── blog.js             ← Posts ke routes (list/create/edit/delete/like) + DB queries
│   └── auth.js             ← signup, login, admin login, logout            [NAYA]
├── middleware/                                                              [NAYA FOLDER]
│   ├── auth.js             ← "kaun hai?" (loadCurrentUser) + login-required guards
│   ├── csrf.js             ← CSRF token check (har POST par)
│   └── rate-limit.js       ← galat password baar-baar daalne par rokta hai
├── utils/                                                                   [NAYA FOLDER]
│   ├── permissions.js      ← "kaun kya kar sakta hai" ke rules (ek hi jagah)
│   ├── validation.js       ← saare forms / :id ka server-side input check
│   ├── password.js         ← bcrypt hash / verify
│   └── async-handler.js    ← async route ke error ko 500 page pe bhejta hai (pehle blog.js me tha)
├── scripts/
│   └── set-admin-password.js ← admin ka password terminal se set karne ki script [NAYA]
├── views/                  ← EJS templates (HTML pages)
│   ├── posts-list.ejs      ← /posts  (saare posts)
│   ├── post-detail.ejs     ← /posts/:id (ek post poora)
│   ├── create-post.ejs     ← /new-post (form)
│   ├── update-post.ejs     ← /posts/:id/edit (form)
│   ├── login.ejs / signup.ejs / admin-login.ejs ← auth pages           [NAYE]
│   ├── 400.ejs / 403.ejs / 404.ejs / 500.ejs ← error pages (400 = validation fail, 403 = permission nahi)
│   └── includes/           ← reusable chhote tukde
│       ├── head.ejs        ← <head> (meta, fonts, base.css, title, csrf meta tag)
│       ├── header.ejs      ← top navbar (login ki halat ke hisaab se badalta hai)
│       ├── post-item.ejs   ← list me ek post ka card
│       ├── like-widget.ejs ← like button ka khali div (React isme mount hota hai) [NAYA]
│       ├── csrf-field.ejs  ← har form ka chhupa hua security token field         [NAYA]
│       └── form-error.ejs  ← form ke upar laal error box                          [NAYA]
└── public/                 ← browser ko seedha serve hota hai (static)
    ├── styles/             ← base.css (theme variables + header + buttons), forms.css, posts.css, loader.css
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
   4. `cookieSession` → login ki cookie padhta/likhta hai (`req.session`).
   5. `loadCurrentUser` → cookie se asli user DB se nikalta hai (`req.currentUser`).
   6. `csrfProtection` → har POST pe security token check.
5. `authRoutes` aur `blogRoutes` mount karta hai.
6. **404 handler**: koi route match na ho to `404.ejs` (pehle Express ka plain "Cannot GET" aata tha).
7. **Error handler** (4 arguments wala) — koi bhi route crash kare to `500.ejs` dikhata hai.
8. `PORT` (env) ya default `3000` pe listen karta hai. `x-powered-by` header band hai. Proxy ke peeche (Railway/Render etc.) `.env` me `TRUST_PROXY=1` daalo.

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

4 tables. **Purane `authors` aur `posts` me data nahi tootta**, naye tables add hue aur 3 chhote badlav hue.

| Table | Kaun hai | Columns |
|---|---|---|
| **`authors`** (purana) | **Admin** | `id` PK, `Name`, `Email` (ab **UNIQUE**), `password_hash` (**naya**, NULL = login band) |
| **`users`** (naya) | **Normal user** | `id` PK, `email` (UNIQUE), `password_hash`, `display_name`, `created_at` |
| **`posts`** (purana) | post | `id` PK, `title`, `summary`, `body`, `author_id` (ab **NULL ho sakta hai**, FK → authors), `user_id` (**naya**, NULL, FK → users), `likes` (counter) |
| **`post_likes`** (naya) | kisne kya like kiya | `user_id` FK → users, `post_id` FK → posts, `created_at`; **PRIMARY KEY (user_id, post_id)** |

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
| `middleware/auth.js` | `loadCurrentUser`, `requireLogin`, `requireNormalUser`, `redirectIfLoggedIn` |
| `middleware/csrf.js` | token banana + har POST par verify |
| `middleware/rate-limit.js` | in-memory counter (`isBlocked`, `hit`, `reset`) |
| `utils/permissions.js` | `canModifyPost`, `ownerFilter` |
| `utils/validation.js` | `validatePost/Signup/Login`, `parseId`, `safeNextPath`, `checkPasswordRules` |
| `utils/password.js` | `hashPassword`, `verifyPassword`, `DUMMY_HASH` |
| `utils/async-handler.js` | async route ke error ko `next()` se 500 page tak pahunchata hai |
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

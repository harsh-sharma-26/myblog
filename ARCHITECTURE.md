# MyBlog — Architecture & Reference Guide

> Future reference ke liye banaya gaya. Project ko dobara samajhna ho to yahin se shuru karo.
> Last updated: 2026-10-17

## 1. Ye project kya hai?

Ek simple **blog website**. Isme tum:
- saare posts dekh sakte ho,
- naya post bana sakte ho (author select karke),
- post edit / delete kar sakte ho,
- post ko **like / unlike** kar sakte ho (ye part React se bana hai).

Ye **CRUD** (Create, Read, Update, Delete) ka classic example hai.

## 2. Tech stack

| Cheez | Kya use hua | Kaam |
|---|---|---|
| Node.js + **Express 4** | backend server | URLs (routes) handle karta hai |
| **EJS** | template engine | HTML pages server pe banata hai (server-side rendering) |
| **MySQL** (Aiven cloud) via **mysql2/promise** | database | posts aur authors store karta hai |
| **dotenv** | config | `.env` se DB credentials load karta hai |
| **React 18 (CDN) + Babel standalone** | sirf Like button | build step ke bina browser me JSX chalta hai |
| Plain CSS | styling | `public/styles/` |
| nodemon | dev tool | `npm start` pe file change hote hi server restart |

## 3. Folder structure

```
myBlog/
├── app.js                  ← Entry point. Server yahin se start hota hai
├── schema.sql              ← DB tables ka SQL
├── package.json            ← Dependencies + "npm start" script (nodemon app.js)
├── .env                    ← DB credentials (gitignored, kabhi commit mat karna)
├── data/
│   └── database.js         ← MySQL connection pool
├── routes/
│   └── blog.js             ← SAARE routes (URLs) + DB queries
├── views/                  ← EJS templates (HTML pages)
│   ├── posts-list.ejs      ← /posts  (saare posts)
│   ├── post-detail.ejs     ← /posts/:id (ek post poora)
│   ├── create-post.ejs     ← /new-post (form)
│   ├── update-post.ejs     ← /posts/:id/edit (form)
│   ├── 400.ejs / 404.ejs / 500.ejs ← error pages (400 = validation fail)
│   └── includes/           ← reusable chhote tukde
│       ├── head.ejs        ← <head> (meta, fonts, base.css, title)
│       ├── header.ejs      ← top navbar
│       └── post-item.ejs   ← list me ek post ka card
└── public/                 ← browser ko seedha serve hota hai (static)
    ├── styles/             ← base.css (theme variables + header + buttons), forms.css, posts.css
    ├── scripts/theme.js    ← light/dark toggle + navbar active link
    └── react/LikeButton.jsx← React like-button component
```

## 4. Har file kya karti hai

### `app.js` — server ka dil
1. `dotenv` se `.env` load karta hai.
2. Express app banata hai, **EJS** ko view engine set karta hai (`views/` folder).
3. Middlewares:
   - `express.urlencoded` → HTML form ka data `req.body` me aata hai.
   - `express.static("public")` → `/styles/...` aur `/react/...` files seedha serve hoti hain.
4. `blogRoutes` mount karta hai.
5. **Error handler** (4 arguments wala) — koi bhi route crash kare to `500.ejs` dikhata hai.
6. `PORT` (env) ya default `3000` pe listen karta hai.

### `data/database.js` — DB connection
- `mysql.createPool(...)` → **connection pool** (har request pe naya connection nahi banta, pool se reuse hota hai — fast aur efficient).
- Host/user/password `.env` se. Variable names do tarah ke support hain: `MYSQLHOST` (Railway style) ya `DB_HOST` (current Aiven style) — pehla mila wahi use hota hai.
- `ssl: { rejectUnauthorized: false }` → cloud DB ke liye SSL on hai (certificate verify nahi karta).
- Pool export hota hai; `routes/blog.js` me `db.query(...)` se use hota hai.

### `routes/blog.js` — saare routes

| Method | URL | Kya hota hai | Response |
|---|---|---|---|
| GET | `/` | redirect | → `/posts` |
| GET | `/posts` | posts + author name (JOIN) fetch | `posts-list.ejs` |
| GET | `/new-post` | authors fetch (dropdown ke liye) | `create-post.ejs` |
| POST | `/posts` | naya post INSERT | redirect → `/posts` |
| GET | `/posts/:id` | ek post + author name/email | `post-detail.ejs` (nahi mila to 404) |
| GET | `/posts/:id/edit` | post fetch, form prefill | `update-post.ejs` (nahi mila to 404) |
| POST | `/posts/:id/edit` | title/summary/body UPDATE | redirect → `/posts` |
| POST | `/posts/:id/delete` | post DELETE | redirect → `/posts` |
| POST | `/posts/:id/like` | `likes = likes + 1` | JSON `{ likes }` |
| POST | `/posts/:id/unlike` | `likes = GREATEST(likes - 1, 0)` | JSON `{ likes }` |

Notes:
- `?` placeholders (parameterized queries) use hote hain → **SQL injection se bachav**.
- `const [posts] = await db.query(...)` → mysql2 `[rows, fields]` return karta hai, hum sirf rows lete hain.
- Like/unlike **JSON** return karte hain (page reload nahi hota), baaki routes HTML render/redirect karte hain.

### `views/` — EJS templates
- `<%= x %>` → value print (HTML-escape ke saath, safe). `<%- include(...) %>` → doosra template include.
- `head.ejs` ko `title` pass hota hai (`include('includes/head', { title: '...' })`).
- `posts-list.ejs` → loop chalata hai, har post ke liye `post-item.ejs` include karta hai. Posts na ho to "No posts found" message.
- `post-item.ejs` → card: title, author, summary, Delete (form POST), Edit link, View link, aur ek khali `<div class="like-widget" data-post-id data-likes>`.
- `post-detail.ejs` → poora post + author email (mailto) + like-widget.
- `create-post.ejs` / `update-post.ejs` → forms. Create me author dropdown hai, update me author change nahi hota.
- Jin pages pe like button hai (`posts-list`, `post-detail`) unke neeche React, ReactDOM, Babel CDN scripts + `LikeButton.jsx` load hoti hai.

### `public/react/LikeButton.jsx` — React like feature
Flow:
1. EJS server pe khali `<div class="like-widget" data-post-id="7" data-likes="12">` render karta hai.
2. Browser me Babel `LikeButton.jsx` ko compile karta hai; code har `.like-widget` dhundh ke uske andar alag React root mount karta hai.
3. Initial "liked" state **localStorage** (`likedPosts` key, ids ka array) se aati hai → refresh ke baad bhi heart red rehta hai.
4. Click pe **optimistic update**: UI turant badalta hai, phir background me `fetch POST /posts/:id/like|unlike`.
5. Server ka asli count aane pe sync; fail hone pe UI wapas undo.

Dhyan rahe: "liked" status sirf **us browser** ka hai (localStorage). Server pe koi user-wise record nahi hai, sirf total `likes` number.

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
   → data/database.js pool → MySQL: SELECT posts JOIN authors
   → res.render("posts-list", { posts })  (EJS HTML banata hai)
   → Browser ko HTML + CSS + React scripts milte hain
   → LikeButton.jsx har card ke like-widget me button mount karta hai
```

Form submit (create): `create-post.ejs` form → `POST /posts` → INSERT → `redirect /posts` (POST-redirect-GET pattern, refresh pe duplicate submit nahi hota).

## 6. Database (asli schema `schema.sql` me hai)

- **`authors`**: `id` (PK, auto increment), `Name`, `Email` (dono `varchar(255) NOT NULL`; capital N / E dhyan rakho)
- **`posts`**: `id` (PK), `title` (`varchar(255)`), `summary` (`varchar(255)`), `body` (`text`), `author_id` (`int NOT NULL`, foreign key → `authors.id`), `likes` (`int DEFAULT '0'`, **NULL ho sakta hai**)

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
# .env me ye daalo: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT
npm start        # nodemon app.js → http://localhost:3000
```

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

## 10. Abhi bhi pending (jaanboojh ke nahi kiye)

- **Like spam (#3)**: sahi fix ke liye login/user system chahiye. IP-based limit se ek hi WiFi ke log ek doosre ko block kar dete, isliye nahi kiya.
- **Pagination, search, timestamps (#11)**: ye naye features hain, bug fix nahi. DB me column bhi add karna padega.
- React ko Babel-in-browser se hata ke Vite/build step pe le jana (bada refactor).

// =====================================================================
// auth.js : "ye request kis ne bheji?" (authentication) aur "use andar aane dein?" (gatekeeping)
// ---------------------------------------------------------------------
// Login ke baad browser ko ek signed cookie milti hai (cookie-session, app.js dekho). Usme sirf ye hota hai:
//     req.session.auth = { type: 'user' | 'admin', id: 7 }
// type batata hai ki login kis table se hua:
//     'user'  -> users table  (normal user)
//     'admin' -> authors table (admin)
// Isi `type` se role decide hota hai. Alag `roles` table nahi hai.
//
// Is file me 4 middleware hain:
//   loadCurrentUser   : HAR request pe chalta hai, cookie se asli insaan DB se nikalta hai
//   requireLogin      : login ke bina aage nahi jaane deta
//   requireNormalUser : sirf normal user (like/unlike ke liye; admin like nahi karta)
//   redirectIfLoggedIn: login/signup page par pehle se logged-in insaan ko wapas bhejta hai
// =====================================================================

const db = require("../data/database");
const asyncHandler = require("../utils/async-handler");
const { canModifyPost } = require("../utils/permissions");

// ---------------------------------------------------------------------
// 1) loadCurrentUser
// Cookie me sirf (type, id) hai. Hum use seedha sach nahi maante, har request pe DB se confirm karte hain:
//   - user delete ho gaya ho to uski purani cookie ab kaam nahi karti,
//   - admin ka password_hash hata diya gaya ho (login band kiya gaya) to uski cookie bhi turant bekaar.
// Result:
//   req.currentUser        = { type, id, name } ya null (guest)
//   res.locals.currentUser = wahi, taaki EJS templates (header etc.) me use ho sake
//   res.locals.canModify   = function(post), taaki views me Edit/Delete button sirf permission walon ko dikhe
// ---------------------------------------------------------------------
const loadCurrentUser = asyncHandler(async (req, res, next) => {
  req.currentUser = null;

  const auth = req.session && req.session.auth;
  const hasValidShape =
    auth && (auth.type === "user" || auth.type === "admin") && Number.isInteger(auth.id);

  if (hasValidShape) {
    // Dono queries column ko alias deti hain (name) taaki aage ka code same rahe. Ye queries fixed hain,
    // user ka koi input inme string ban ke nahi judta (sirf ? placeholder me id jati hai).
    const [rows] =
      auth.type === "admin"
        ? await db.query(
            "SELECT id, Name AS name FROM authors WHERE id = ? AND password_hash IS NOT NULL",
            [auth.id],
          )
        : await db.query("SELECT id, display_name AS name FROM users WHERE id = ?", [auth.id]);

    if (rows.length === 1) {
      req.currentUser = { type: auth.type, id: rows[0].id, name: rows[0].name };
    } else {
      req.session.auth = null; // stale cookie (account ab exist nahi karta), saaf kar do
    }
  }

  res.locals.currentUser = req.currentUser;
  res.locals.canModify = (post) => canModifyPost(req.currentUser, post);
  next();
});

// JSON maangne wale requests (like button ka fetch, jo `Accept: application/json` bhejta hai) ko HTML redirect
// nahi, JSON error milna chahiye. Baaki (normal browser pages) ko redirect/page.
function wantsJson(req) {
  return req.accepts(["html", "json"]) === "json";
}

// ---------------------------------------------------------------------
// 2) requireLogin : koi bhi logged-in (user ya admin)
// Guest ko /login pe bhejta hai. GET request ho to ?next= me wahi page yaad rakhta hai, taaki login ke baad
// user wahin wapas aaye jahan jaana chahta tha. POST ke liye next nahi rakhte (POST ko GET bana ke dohrana galat hoga).
// ---------------------------------------------------------------------
function requireLogin(req, res, next) {
  if (req.currentUser) return next();

  if (wantsJson(req)) {
    return res.status(401).json({ error: "Please login karo.", loginUrl: "/login" });
  }
  const target = req.method === "GET" ? `/login?next=${encodeURIComponent(req.originalUrl)}` : "/login";
  res.redirect(target);
}

// ---------------------------------------------------------------------
// 3) requireNormalUser : sirf 'user' type. (requireLogin ke BAAD lagana hai.)
// Likes sirf normal users ke hain (post_likes.user_id -> users.id). Admin ke likes ka table me jagah hi nahi hai.
// ---------------------------------------------------------------------
function requireNormalUser(req, res, next) {
  if (req.currentUser && req.currentUser.type === "user") return next();

  if (wantsJson(req)) {
    return res.status(403).json({ error: "Admin accounts post like nahi kar sakte." });
  }
  res.status(403).render("403");
}

// ---------------------------------------------------------------------
// 4) redirectIfLoggedIn : login / signup page pe pehle se logged-in insaan ka kaam nahi
// ---------------------------------------------------------------------
function redirectIfLoggedIn(req, res, next) {
  if (req.currentUser) return res.redirect("/posts");
  next();
}

module.exports = { loadCurrentUser, requireLogin, requireNormalUser, redirectIfLoggedIn };

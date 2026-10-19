// =====================================================================
// routes/auth.js : signup, login, admin login, logout
// ---------------------------------------------------------------------
// Do ALAG login "duniya" (realm) hain, dono ke apne page aur apna table:
//
//   Normal user : GET/POST /signup, /login        -> users table   (session type = 'user')
//   Admin       : GET/POST /admin/login           -> authors table (session type = 'admin')
//   Dono ke liye: POST /logout
//
// Admin ka signup JAAN-BUJHKAR nahi hai (warna koi bhi khud ko admin bana leta). Admin ka password
// `npm run set-admin-password` script se set hota hai (scripts/set-admin-password.js).
// =====================================================================

const express = require("express");

const db = require("../data/database");
const asyncHandler = require("../utils/async-handler");
const { hashPassword, verifyPassword, DUMMY_HASH } = require("../utils/password");
const { validateSignup, validateLogin, safeNextPath } = require("../utils/validation");
const { redirectIfLoggedIn } = require("../middleware/auth");
const { newCsrfToken } = require("../middleware/csrf");
const { createLimiter } = require("../middleware/rate-limit");

const router = express.Router();

// ---------------------------------------------------------------------
// Rate limits (brute-force rokne ke liye, middleware/rate-limit.js dekho)
//   loginAttempts : galat password ki koshishein. Do alag key par ginte hain:
//        "IP + email"  -> 5 galat koshish ke baad us email pe is IP se 15 min ke liye band
//        "sirf IP"     -> 20 galat koshish ke baad us IP se koi bhi email 15 min ke liye band
//                         (attacker email badal-badal ke guess na kar sake)
//   signupAttempts: ek IP se 1 ghante me 10 signup tak (fake accounts ka spam rokne ke liye)
// ---------------------------------------------------------------------
const loginAttempts = createLimiter({ max: 5, windowMs: 15 * 60 * 1000 });
const loginAttemptsByIp = createLimiter({ max: 20, windowMs: 15 * 60 * 1000 });
const signupAttempts = createLimiter({ max: 10, windowMs: 60 * 60 * 1000 });

// ---------------------------------------------------------------------
// Login hote hi naya session banate hain. Purana session object poora fenk dete hain, aur naya CSRF token bhi.
// [SESSION FIXATION se bachav]: agar attacker ne pehle se koi session/token user ke browser me daal diya ho,
// to login ke baad wo bekaar ho jata hai.
// ---------------------------------------------------------------------
function startSession(req, auth) {
  req.session = { auth, csrfToken: newCsrfToken() };
}

// ---------------------------------------------------------------------
// Normal user ke liye: /signup
// ---------------------------------------------------------------------
router.get("/signup", redirectIfLoggedIn, (req, res) => {
  res.render("signup", { error: null, values: { displayName: "", email: "" } });
});

router.post(
  "/signup",
  redirectIfLoggedIn,
  asyncHandler(async (req, res) => {
    const rateKey = `signup|${req.ip}`;
    if (signupAttempts.isBlocked(rateKey)) {
      return res.status(429).render("signup", {
        error: "Bahut zyada signup koshishein hui hain. Thodi der baad try karo.",
        values: { displayName: "", email: "" },
      });
    }
    signupAttempts.hit(rateKey); // har koshish gini jati hai (sahi ho ya galat)

    const { error, values } = validateSignup(req.body);
    if (error) {
      return res.status(400).render("signup", { error, values });
    }

    const passwordHash = await hashPassword(values.password);

    let result;
    try {
      [result] = await db.query(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
        [values.email, passwordHash, values.displayName],
      );
    } catch (dbError) {
      // users.email UNIQUE hai. "Pehle check phir insert" me race condition ban sakti hai (do log ek saath),
      // isliye seedha insert karke DB ke duplicate error ko pakadte hain. Ye hamesha sahi tarike se kaam karta hai.
      if (dbError.code === "ER_DUP_ENTRY") {
        return res.status(409).render("signup", {
          error: "Is email se account pehle se bana hua hai. Login karo.",
          values: { displayName: values.displayName, email: values.email },
        });
      }
      throw dbError;
    }

    startSession(req, { type: "user", id: result.insertId }); // signup ke baad seedha login
    res.redirect("/posts");
  }),
);

// ---------------------------------------------------------------------
// Login ka common handler. /login (users) aur /admin/login (authors) mein sirf 3 cheezein alag hain,
// isliye ek factory se dono handlers banate hain (code duplicate nahi hota):
//   realm        : 'user' ya 'admin'. Session type, rate-limit key aur error pages me kaam aata hai.
//   view         : kaunsa EJS page dikhana hai
//   findAccount  : email se account dhundhta hai -> { id, passwordHash } ya null
// ---------------------------------------------------------------------
function createLoginHandler({ realm, view, findAccount, afterLoginPath }) {
  return asyncHandler(async (req, res) => {
    const next = safeNextPath(req.body.next); // sirf apni site ka path, warna null

    const { error, values } = validateLogin(req.body);
    if (error) {
      return res.status(400).render(view, { error, email: values.email, next });
    }

    const emailKey = `${realm}|${req.ip}|${values.email}`;
    const ipKey = `${realm}|${req.ip}`;
    if (loginAttempts.isBlocked(emailKey) || loginAttemptsByIp.isBlocked(ipKey)) {
      return res.status(429).render(view, {
        error: "Bahut zyada galat koshishein hui hain. 15 minute baad try karo.",
        email: values.email,
        next,
      });
    }

    const account = await findAccount(values.email);

    // Account na mile tab bhi bcrypt chalate hain (DUMMY_HASH se), taaki response time se
    // pata na chale ki email registered hai ya nahi (utils/password.js me detail).
    const passwordMatches = await verifyPassword(
      values.password,
      account ? account.passwordHash : DUMMY_HASH,
    );

    if (!account || !passwordMatches) {
      loginAttempts.hit(emailKey);
      loginAttemptsByIp.hit(ipKey);
      // Jaanbujhkar ek hi message: "email galat" aur "password galat" alag batane se attacker ko
      // pata chal jata ki kaunse emails registered hain.
      return res.status(401).render(view, {
        error: "Email ya password galat hai.",
        email: values.email,
        next,
      });
    }

    loginAttempts.reset(emailKey); // sahi login hua, us email ka counter saaf (IP wala nahi)
    startSession(req, { type: realm, id: account.id });
    res.redirect(next || afterLoginPath);
  });
}

// ---------------------------------------------------------------------
// Normal user ke liye: /login
// ---------------------------------------------------------------------
router.get("/login", redirectIfLoggedIn, (req, res) => {
  res.render("login", { error: null, email: "", next: safeNextPath(req.query.next) });
});

router.post(
  "/login",
  redirectIfLoggedIn,
  createLoginHandler({
    realm: "user",
    view: "login",
    afterLoginPath: "/posts",
    findAccount: async (email) => {
      const [rows] = await db.query("SELECT id, password_hash FROM users WHERE email = ?", [email]);
      return rows.length === 1 ? { id: rows[0].id, passwordHash: rows[0].password_hash } : null;
    },
  }),
);

// ---------------------------------------------------------------------
// Admin ke liye: /admin/login  (aur /admin us par redirect)
// Admin = authors table ki row. password_hash NULL hai to uska login band hai
// (matlab abhi tak set-admin-password script se password set nahi hua), isliye usse account hi na maano.
// ---------------------------------------------------------------------
router.get("/admin", (req, res) => {
  res.redirect("/admin/login");
});

router.get("/admin/login", redirectIfLoggedIn, (req, res) => {
  res.render("admin-login", { error: null, email: "", next: safeNextPath(req.query.next) });
});

router.post(
  "/admin/login",
  redirectIfLoggedIn,
  createLoginHandler({
    realm: "admin",
    view: "admin-login",
    afterLoginPath: "/posts",
    findAccount: async (email) => {
      const [rows] = await db.query(
        "SELECT id, password_hash FROM authors WHERE Email = ? AND password_hash IS NOT NULL",
        [email],
      );
      return rows.length === 1 ? { id: rows[0].id, passwordHash: rows[0].password_hash } : null;
    },
  }),
);

// ---------------------------------------------------------------------
// Logout (POST, GET nahi): GET se logout rakhte to koi bhi <img src="/logout"> laga ke user ko logout karwa deta.
// CSRF token app.js ke global middleware se already check ho chuka hota hai.
// `req.session = null` cookie ko hata deta hai.
// ---------------------------------------------------------------------
router.post("/logout", (req, res) => {
  req.session = null;
  res.redirect("/posts");
});

module.exports = router;

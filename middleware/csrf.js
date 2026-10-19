// =====================================================================
// csrf.js : CSRF (Cross-Site Request Forgery) se bachav
// ---------------------------------------------------------------------
// Problem: user hamari site pe logged-in hai. Wo kisi nakli site evil.com par jaata hai. Us page me chhupa hua
// form hamari site ke /posts/5/delete par POST bhej deta hai. Browser hamari cookie khud laga deta hai,
// to server ko lagta hai "user ne khud delete kiya". Yehi CSRF hai.
//
// Hal: har session ko ek random secret token milta hai (req.session.csrfToken). Hamare apne forms me wo token
// chhupe field (`_csrf`) me hota hai. evil.com ko wo token pata nahi chal sakta, isliye uski fake request
// me token nahi hoga (ya galat hoga) aur hum use reject kar dete hain.
//
// Kaise use hota hai:
//   - Har form me:  <%- include('includes/csrf-field') %>   (chhupa hua input _csrf banata hai)
//   - fetch() (like button) me: header `x-csrf-token`, jo <meta name="csrf-token"> se padha jata hai (head.ejs)
//   - POST/PUT/PATCH/DELETE par token match na ho to 403.  GET/HEAD/OPTIONS safe maane jate hain (kuch badalte nahi).
// Extra suraksha: cookie ka sameSite=lax bhi hai (app.js), jo cross-site POST me cookie hi nahi bhejti.
// =====================================================================

const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function newCsrfToken() {
  return crypto.randomBytes(32).toString("hex"); // 64 hex characters
}

// Do strings barabar hain ya nahi, timingSafeEqual se. Normal === se compare karne par jaldi mismatch pe jaldi return
// hota hai, jisse (bahut mushkil se) token ka andaza lagaya ja sakta hai. Isme time hamesha barabar lagta hai.
function tokensMatch(expected, received) {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function csrfProtection(req, res, next) {
  // Session me token na ho (pehli visit / naya session) to bana do. Ye cookie me save hota hai.
  if (!req.session.csrfToken) {
    req.session.csrfToken = newCsrfToken();
  }
  // Templates (head.ejs meta tag + csrf-field.ejs) isi se token uthate hain
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();

  // Form se `_csrf` field, ya fetch se `x-csrf-token` header
  const received = (req.body && req.body._csrf) || req.get("x-csrf-token");
  if (tokensMatch(req.session.csrfToken, received)) return next();

  if (req.accepts(["html", "json"]) === "json") {
    return res.status(403).json({ error: "Invalid ya expired security token. Page refresh karke dobara try karo." });
  }
  res.status(403).render("403", {
    message: "Security token invalid ya expire ho gaya. Page refresh karke dobara try karo.",
  });
}

module.exports = { csrfProtection, newCsrfToken };

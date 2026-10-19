require("dotenv").config(); // Load environment variables from .env file, It looks a little unusual cause it is not assigned to a variable, but it is correct. We are immediately invoking the function returned by require("dotenv").config() to load the environment variables into process.env.
const path = require("path");

const express = require("express");
const compression = require("compression");
const cookieSession = require("cookie-session");

const blogRoutes = require("./routes/blog");
const authRoutes = require("./routes/auth");
const { loadCurrentUser } = require("./middleware/auth");
const { csrfProtection } = require("./middleware/csrf");

// [AUTH] Session cookie ko sign karne ke liye secret zaruri hai. Bina secret ke koi bhi nakli cookie bana ke
// kisi ka bhi account ban sakta tha, isliye secret na ho to server start hi nahi hone dete (chupchap insecure chalne se behtar).
// .env me SESSION_SECRET=<lamba random string> daalo. Bana ne ka tarika: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("SESSION_SECRET .env me set nahi hai (ya 32 characters se chhota hai). Server start nahi ho sakta.");
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";

const app = express();

app.disable("x-powered-by"); // response header "X-Powered-By: Express" band: attacker ko framework ka pata nahi chalta

// Heroku / Railway / Render jaise hosts reverse proxy ke peeche chalte hain. Wahan .env me TRUST_PROXY=1 daalo, tab Express
// asli client IP (rate limiting ke liye) aur HTTPS (secure cookie ke liye) sahi pehchanta hai.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// Activate EJS view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//middlewares: (ORDER matter karta hai, upar se neeche ek ke baad ek chalte hain)
app.use(express.urlencoded({ extended: true })); // Parse incoming request bodies
app.use(compression()); // [PERF] gzip HTML/CSS/JS responses
app.use(express.static("public")); // Serve static files (e.g. CSS files)
// Static files ke BAAD isliye: CSS/JS/image ki request pe session aur DB lookup ki zaroorat nahi, wo upar hi khatam ho jati hain.

// [AUTH] 1) Session: login ki yaad browser ki cookie me rehti hai (server pe alag session table nahi).
// Cookie signed hai (keys se), isliye user usme type/id badal nahi sakta; badlega to signature galat hoke cookie reject ho jayegi.
// Cookie me sirf { auth: { type, id }, csrfToken } hota hai, password ya personal data nahi.
app.use(
  cookieSession({
    name: "blog_session",
    keys: [process.env.SESSION_SECRET],
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 din baad dobara login
    httpOnly: true, // JavaScript (document.cookie) cookie padh nahi sakta: XSS se chori mushkil
    sameSite: "lax", // doosri site se aayi POST request ke saath cookie nahi jati: CSRF se extra bachav
    secure: isProduction, // production (HTTPS) me cookie sirf HTTPS par jaye
  }),
);
// [AUTH] 2) Cookie se asli user nikalo (req.currentUser / res.locals.currentUser)
app.use(loadCurrentUser);
// [AUTH] 3) Har POST par CSRF token check (middleware/csrf.js)
app.use(csrfProtection);

app.use(authRoutes);
app.use(blogRoutes);

// Koi bhi route match nahi hua to 404 page (pehle Express ka default plain-text "Cannot GET" aata tha)
app.use(function (req, res) {
  res.status(404).render("404");
});

app.use(function (error, req, res, next) {
  // Default error handling function
  // Will become active whenever any route / middleware crashes
  console.log(error);
  res.status(500).render("500");
});

app.listen(process.env.PORT || 3000);

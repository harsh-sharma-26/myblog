require("dotenv").config(); // Load environment variables from .env file, It looks a little unusual cause it is not assigned to a variable, but it is correct. We are immediately invoking the function returned by require("dotenv").config() to load the environment variables into process.env.
const path = require("path");

const express = require("express");
const compression = require("compression");
const cookieSession = require("cookie-session");

const blogRoutes = require("./routes/blog");
const authRoutes = require("./routes/auth");
const aiDraftsApiRoutes = require("./routes/ai-drafts-api"); // [AI DRAFTS]
const { router: adminAiDraftRoutes, loadAiPendingCount } = require("./routes/admin-ai-drafts"); // [AI DRAFTS]
const { loadCurrentUser } = require("./middleware/auth");
const { csrfProtection } = require("./middleware/csrf");
const { requestLogger } = require("./middleware/request-logger");
const logger = require("./utils/logger");
const db = require("./data/database");

// [LOGGING] Last-resort handlers: log crashes that happen outside any request before the process dies,
// so the cause shows up in the logs instead of the server just silently restarting.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { error: reason instanceof Error ? reason : new Error(String(reason)) });
});
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception, shutting down", { error });
  process.exit(1);
});

// [AUTH] Session cookie ko sign karne ke liye secret zaruri hai. Bina secret ke koi bhi nakli cookie bana ke
// kisi ka bhi account ban sakta tha, isliye secret na ho to server start hi nahi hone dete (chupchap insecure chalne se behtar).
// .env me SESSION_SECRET=<lamba random string> daalo. Bana ne ka tarika: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  logger.error("SESSION_SECRET is missing or shorter than 32 characters. Server cannot start.");
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

// [LOGGING] One log line per page / API request (static files above are skipped on purpose)
app.use(requestLogger);

// [LOGGING] Health check: tells you (or Render's health check) whether the server AND the database are up.
// Placed before sessions / CSRF because it needs neither.
app.get("/health", async function (req, res) {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "ok", uptimeSeconds: Math.round(process.uptime()) });
  } catch (error) {
    logger.error("Health check failed: database unreachable", { error });
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

// [AI DRAFTS] AI pipeline ka API (POST /api/ai-drafts). Session / CSRF se PEHLE, kyunki ise browser nahi, script call
// karti hai jo secret token (Authorization header) bhejti hai. Ye sirf "pending" draft banata hai, publish kabhi nahi.
app.use(aiDraftsApiRoutes);

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
// [AI DRAFTS] Admin ke navbar me "AI Posts (n)" badge ke liye pending count
app.use(loadAiPendingCount);

app.use(authRoutes);
app.use(blogRoutes);
app.use(adminAiDraftRoutes); // [AI DRAFTS] /admin/ai-posts review portal (sirf admin)

// Koi bhi route match nahi hua to 404 page (pehle Express ka default plain-text "Cannot GET" aata tha)
app.use(function (req, res) {
  res.status(404).render("404");
});

app.use(function (error, req, res, next) {
  // Default error handling function
  // Will become active whenever any route / middleware crashes
  // [LOGGING] Full stack trace + which request caused it, so you can find what broke
  logger.error("Request failed", { method: req.method, url: req.originalUrl, error });
  res.status(500).render("500");
});

const port = process.env.PORT || 3000;
app.listen(port, async function () {
  logger.info("Server started", { port: Number(port), env: process.env.NODE_ENV || "development" });
  // [LOGGING] Check the database once at startup, so a wrong DB password / host shows up immediately
  try {
    await db.query("SELECT 1");
    logger.info("Database connection OK");
  } catch (error) {
    logger.error("Database connection FAILED at startup", { error });
  }
});

// =====================================================================
// [AI DRAFTS] ai-drafts-api.js : AI pipeline yahan naya draft bhejta hai
// ---------------------------------------------------------------------
//   POST /api/ai-drafts
//   Header : Authorization: Bearer <AI_DRAFTS_API_TOKEN>
//   Body   : JSON { title, summary, body, sources?: [..] ya "line\nline", topic? }
//   Result : 201 { id, status: "pending" }   -> admin /admin/ai-posts pe dekhega
//
// Ye endpoint kabhi seedha post PUBLISH nahi karta. Sirf ai_drafts me "pending" draft banata hai.
// Publish sirf admin ke Approve button se hota hai.
//
// Login/session/CSRF yahan nahi lagta (ye browser nahi, script call karti hai), isliye app.js me ise
// cookieSession aur csrfProtection se PEHLE mount kiya hai. Suraksha secret token se hai:
//   - .env me AI_DRAFTS_API_TOKEN=<kam se kam 32 characters ka random string>
//     Banane ka tarika: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//   - Token set nahi hai (ya chhota hai) to endpoint band rehta hai (503). Bina token ke kabhi khula nahi.
// =====================================================================

const crypto = require("crypto");
const express = require("express");
const db = require("../data/database");
const asyncHandler = require("../utils/async-handler");
const logger = require("../utils/logger");
const { createLimiter } = require("../middleware/rate-limit");
const { validateDraft, MAX_PENDING } = require("../utils/ai-drafts");

const router = express.Router();

// Galat token se andaza lagane (brute force) se bachav: ek IP se 15 minute me 20 galat try ke baad block
const badTokenLimiter = createLimiter({ max: 20, windowMs: 15 * 60 * 1000 });

function tokensMatch(expected, received) {
  // Dono ka SHA-256 compare: length alag ho tab bhi timingSafeEqual chalta hai aur time barabar lagta hai
  const a = crypto.createHash("sha256").update(expected).digest();
  const b = crypto.createHash("sha256").update(received).digest();
  return crypto.timingSafeEqual(a, b);
}

function requireApiToken(req, res, next) {
  const expected = process.env.AI_DRAFTS_API_TOKEN;
  if (!expected || expected.length < 32) {
    return res.status(503).json({ error: "AI drafts API is disabled (AI_DRAFTS_API_TOKEN not configured)." });
  }

  const ipKey = `ai-api:${req.ip}`;
  if (badTokenLimiter.isBlocked(ipKey)) {
    return res.status(429).json({ error: "Too many failed attempts. Try again later." });
  }

  const header = req.get("authorization") || "";
  const received = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!received || !tokensMatch(expected, received)) {
    badTokenLimiter.hit(ipKey);
    logger.warn("AI drafts API: invalid token", { ip: req.ip });
    return res.status(401).json({ error: "Invalid API token." });
  }
  next();
}

router.post(
  "/api/ai-drafts",
  requireApiToken,
  // JSON body sirf is route ke liye parse hota hai. 200kb kaafi hai (body ki limit 64KB hai).
  express.json({ limit: "200kb" }),
  asyncHandler(async (req, res) => {
    const { error, values } = validateDraft(req.body || {});
    if (error) {
      return res.status(400).json({ error });
    }

    // Queue full ho to naya draft mat lo (admin ne kaafi din review nahi kiya)
    const [countRows] = await db.query("SELECT COUNT(*) AS total FROM ai_drafts WHERE status = 'pending'");
    if (countRows[0].total >= MAX_PENDING) {
      logger.warn("AI drafts API: pending queue full, draft refused", { pending: countRows[0].total });
      return res.status(429).json({ error: `Pending queue is full (${MAX_PENDING}). Review existing drafts first.` });
    }

    const [result] = await db.query(
      "INSERT INTO ai_drafts (title, summary, body, sources, topic) VALUES (?, ?, ?, ?, ?)",
      [values.title, values.summary, values.content, values.sources, values.topic],
    );
    logger.info("AI draft received", { draftId: result.insertId, topic: values.topic });
    res.status(201).json({ id: result.insertId, status: "pending" });
  }),
);

// Is router ke JSON errors (jaise galat JSON body) HTML 500 page nahi, JSON me jaye
// eslint-disable-next-line no-unused-vars
router.use("/api/ai-drafts", (error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Body must be valid JSON." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "Body too large." });
  }
  logger.error("AI drafts API failed", { error });
  res.status(500).json({ error: "Server error." });
});

module.exports = router;

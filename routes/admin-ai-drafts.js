// =====================================================================
// [AI DRAFTS] admin-ai-drafts.js : admin ka AI posts review portal
// ---------------------------------------------------------------------
//   GET  /admin/ai-posts                 : list (tabs: pending / approved / rejected)
//   GET  /admin/ai-posts/:draftId        : poora preview + Approve / Reject / Edit
//   GET  /admin/ai-posts/:draftId/edit   : edit form (sirf pending draft)
//   POST /admin/ai-posts/:draftId/edit   : edit save
//   POST /admin/ai-posts/:draftId/approve: posts me admin ke naam se publish
//   POST /admin/ai-posts/:draftId/reject : reject (optional reason)
//
// Sab routes requireLogin + requireAdmin ke peeche hain. CSRF token app.js ka global middleware check karta hai.
// Sirf "pending" draft hi edit/approve/reject hota hai. Approved/rejected ek baar ho gaya to final hai
// (approved post ko badalna ho to normal post ki tarah /posts/:id/edit se karo).
// =====================================================================

const express = require("express");
const db = require("../data/database");
const asyncHandler = require("../utils/async-handler");
const logger = require("../utils/logger");
const { parseId } = require("../utils/validation");
const { requireLogin, requireAdmin } = require("../middleware/auth");
const { validateDraft, buildPublishedBody, normalizeRejectReason } = require("../utils/ai-drafts");

const router = express.Router();

const STATUSES = ["pending", "approved", "rejected"];
const MAX_BODY_BYTES = 65535; // posts.body TEXT column ki limit (utils/validation.js jaisi)

// Is router ke har route pe admin hona zaroori
router.use("/admin/ai-posts", requireLogin, requireAdmin);

// :draftId sirf positive number. Galat ho to 404 (DB tak jaata hi nahi).
router.param("draftId", (req, res, next, value) => {
  const id = parseId(value);
  if (id === null) return res.status(404).render("404");
  req.params.draftId = id;
  next();
});

// Draft + reviewer ka naam + (approved ho to) bani post ka id. Na mile to 404.
const loadDraft = asyncHandler(async (req, res, next) => {
  const [rows] = await db.query(
    `SELECT ai_drafts.*, authors.Name AS reviewer_name
     FROM ai_drafts
     LEFT JOIN authors ON ai_drafts.reviewed_by = authors.id
     WHERE ai_drafts.id = ?`,
    [req.params.draftId],
  );
  if (rows.length === 0) return res.status(404).render("404");
  req.draft = rows[0];
  next();
});

// Sirf pending draft pe action. Warna wapas review page pe, message ke saath.
function requirePending(req, res, next) {
  if (req.draft.status === "pending") return next();
  res.status(409).render("admin-ai-post-review", {
    draft: req.draft,
    error: `This draft is already ${req.draft.status}. Only pending drafts can be changed.`,
  });
}

// ---------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------
router.get(
  "/admin/ai-posts",
  asyncHandler(async (req, res) => {
    const status = STATUSES.includes(req.query.status) ? req.query.status : "pending";

    // Pending: purane pehle (jo pehle aaya wo pehle review ho). Approved/rejected: naye pehle.
    const order = status === "pending" ? "ASC" : "DESC";
    const [drafts] = await db.query(
      `SELECT ai_drafts.id, ai_drafts.title, ai_drafts.summary, ai_drafts.topic, ai_drafts.status,
              ai_drafts.created_at, ai_drafts.reviewed_at, ai_drafts.post_id, ai_drafts.reject_reason,
              authors.Name AS reviewer_name
       FROM ai_drafts
       LEFT JOIN authors ON ai_drafts.reviewed_by = authors.id
       WHERE ai_drafts.status = ?
       ORDER BY ai_drafts.created_at ${order}, ai_drafts.id ${order}
       LIMIT 100`,
      [status],
    );

    const [countRows] = await db.query("SELECT status, COUNT(*) AS total FROM ai_drafts GROUP BY status");
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const row of countRows) counts[row.status] = row.total;

    res.render("admin-ai-posts", { drafts, status, counts, notice: noticeFrom(req.query.done) });
  }),
);

// Action ke baad redirect me ?done=approved|rejected aata hai, uska chhota message
function noticeFrom(done) {
  if (done === "rejected") return "Draft rejected. It will never appear on the site.";
  return null;
}

// ---------------------------------------------------------------------
// REVIEW (preview)
// ---------------------------------------------------------------------
router.get("/admin/ai-posts/:draftId", loadDraft, (req, res) => {
  res.render("admin-ai-post-review", {
    draft: req.draft,
    error: null,
    notice: req.query.done === "saved" ? "Changes saved." : null,
  });
});

// ---------------------------------------------------------------------
// EDIT (approve se pehle chhote sudhaar)
// ---------------------------------------------------------------------
router.get("/admin/ai-posts/:draftId/edit", loadDraft, requirePending, (req, res) => {
  res.render("admin-ai-post-edit", { draft: req.draft, error: null });
});

router.post(
  "/admin/ai-posts/:draftId/edit",
  loadDraft,
  requirePending,
  asyncHandler(async (req, res) => {
    const { error, values } = validateDraft(req.body);
    if (error) {
      // Jo admin ne likha tha wo form me wapas dikhao, kho na jaye
      const typed = { ...req.draft, title: req.body.title, summary: req.body.summary, body: req.body.content, sources: req.body.sources };
      return res.status(400).render("admin-ai-post-edit", { draft: typed, error });
    }

    // `AND status = 'pending'`: beech me kisi aur admin ne approve/reject kar diya ho to edit na ho
    const [result] = await db.query(
      `UPDATE ai_drafts SET title = ?, summary = ?, body = ?, sources = ? WHERE id = ? AND status = 'pending'`,
      [values.title, values.summary, values.content, values.sources, req.draft.id],
    );
    if (result.affectedRows === 0) {
      return res.redirect(`/admin/ai-posts/${req.draft.id}`);
    }
    res.redirect(`/admin/ai-posts/${req.draft.id}?done=saved`);
  }),
);

// ---------------------------------------------------------------------
// APPROVE -> posts me admin ke naam se publish
// Transaction: post INSERT aur draft UPDATE dono ek saath hote hain, ya dono nahi.
// `SELECT ... FOR UPDATE` draft ki row lock karta hai, taaki do admin (ya double-click) ek draft ko do baar
// publish na kar dein. Doosra wait karega, phir status 'approved' dekh ke ruk jayega.
// ---------------------------------------------------------------------
router.post(
  "/admin/ai-posts/:draftId/approve",
  loadDraft,
  requirePending,
  asyncHandler(async (req, res) => {
    const connection = await db.getConnection();
    let postId;
    try {
      await connection.beginTransaction();

      const [rows] = await connection.query("SELECT * FROM ai_drafts WHERE id = ? FOR UPDATE", [req.draft.id]);
      const draft = rows[0];
      if (!draft || draft.status !== "pending") {
        await connection.rollback();
        return res.redirect(`/admin/ai-posts/${req.draft.id}`);
      }

      const body = buildPublishedBody(draft);
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        await connection.rollback();
        return res.status(400).render("admin-ai-post-review", {
          draft: req.draft,
          error: "Post plus sources is too long to publish. Edit the draft and shorten it.",
        });
      }

      // Normal admin post jaisa hi: author_id = approve karne wala admin, user_id NULL (posts_one_owner_chk)
      const [insert] = await connection.query(
        // ai_assisted = 1: post page pe "AI-assisted · Reviewed by <admin>" label (migrations/002-ai-assisted.sql)
        "INSERT INTO posts (title, summary, body, author_id, ai_assisted) VALUES (?, ?, ?, ?, 1)",
        [draft.title, draft.summary, body, req.currentUser.id],
      );
      postId = insert.insertId;

      await connection.query(
        `UPDATE ai_drafts SET status = 'approved', post_id = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [postId, req.currentUser.id, draft.id],
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }

    logger.info("AI draft approved and published", { draftId: req.draft.id, postId, adminId: req.currentUser.id });
    res.redirect(`/posts/${postId}`);
  }),
);

// ---------------------------------------------------------------------
// REJECT (delete nahi hota, sirf status badalta hai)
// ---------------------------------------------------------------------
router.post(
  "/admin/ai-posts/:draftId/reject",
  loadDraft,
  requirePending,
  asyncHandler(async (req, res) => {
    const reason = normalizeRejectReason(req.body.reason);
    await db.query(
      `UPDATE ai_drafts SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
      [reason, req.currentUser.id, req.draft.id],
    );
    logger.info("AI draft rejected", { draftId: req.draft.id, adminId: req.currentUser.id });
    res.redirect("/admin/ai-posts?done=rejected");
  }),
);

// ---------------------------------------------------------------------
// Navbar ke "AI Posts (3)" badge ke liye: sirf admin ke request pe pending count.
// ai_drafts table abhi bani hi na ho (migration nahi chala) to site na toote, bas badge na dikhe.
// ---------------------------------------------------------------------
const loadAiPendingCount = asyncHandler(async (req, res, next) => {
  res.locals.aiPendingCount = null;
  if (req.currentUser && req.currentUser.type === "admin" && req.method === "GET") {
    try {
      const [rows] = await db.query("SELECT COUNT(*) AS total FROM ai_drafts WHERE status = 'pending'");
      res.locals.aiPendingCount = rows[0].total;
    } catch (error) {
      if (error.code !== "ER_NO_SUCH_TABLE") {
        logger.error("Could not load AI pending count", { error });
      }
    }
  }
  next();
});

module.exports = { router, loadAiPendingCount };

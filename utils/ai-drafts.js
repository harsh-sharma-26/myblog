// =====================================================================
// [AI DRAFTS] ai-drafts.js : AI drafts ke chhote helpers (validation + sources ko body me jodna)
// ---------------------------------------------------------------------
// Poora flow:
//   1) AI (Phase 2, GitHub Actions) -> POST /api/ai-drafts  -> ai_drafts me "pending"   (routes/ai-drafts-api.js)
//   2) Admin /admin/ai-posts pe padhta / edit karta hai                                  (routes/admin-ai-drafts.js)
//   3) Approve -> posts me admin ke naam se nayi post.  Reject -> "rejected", site pe kabhi nahi.
// =====================================================================

const { asString, validatePost } = require("./validation");

const MAX_SOURCES_CHARS = 5000;
const MAX_TOPIC = 255;
const MAX_REJECT_REASON = 500;
// Pending drafts isse zyada ho jaye to API naye drafts lena band kar deta hai (429). Admin kuch din review na kare
// to bhi AI ka kharcha bekaar nahi jata. .env me AI_DRAFTS_MAX_PENDING se badal sakte ho.
const MAX_PENDING = Number(process.env.AI_DRAFTS_MAX_PENDING) || 10;

// sources array (API se) ya multi-line text (edit form se) dono chalte hain. Har line ek source.
// Khali lines hata dete hain. Kuch na bache to null (DB me NULL).
function normalizeSources(value) {
  const lines = Array.isArray(value) ? value.map(asString) : asString(value).split(/\r?\n/);
  const cleaned = lines.map((line) => line.trim()).filter(Boolean);
  return cleaned.length ? cleaned.join("\n") : null;
}

// Draft ke fields check karo. Form ka field `content` hai (create/update post jaisa), API me `body` bhi chalega.
// Title/summary/body ke rules wahi hain jo normal post ke (validatePost), taaki approve ke waqt fail na ho.
function validateDraft(input) {
  const { error, values } = validatePost({
    title: input.title,
    summary: input.summary,
    content: input.content !== undefined ? input.content : input.body,
  });
  if (error) return { error, values: null };

  const sources = normalizeSources(input.sources);
  if (sources && sources.length > MAX_SOURCES_CHARS) {
    return { error: `Sources cannot exceed ${MAX_SOURCES_CHARS} characters.`, values: null };
  }

  const topic = asString(input.topic).trim() || null;
  if (topic && topic.length > MAX_TOPIC) {
    return { error: `Topic cannot exceed ${MAX_TOPIC} characters.`, values: null };
  }

  return { error: null, values: { ...values, sources, topic } };
}

// Approve pe post ki body = draft ki body + end me "Sources" list (agar sources hain).
// posts table me alag sources column nahi hai, aur detail page body ko `white-space: pre-wrap` se dikhata hai,
// to plain text list theek dikhti hai.
function buildPublishedBody(draft) {
  if (!draft.sources) return draft.body;
  const list = draft.sources
    .split("\n")
    .map((line) => `- ${line}`)
    .join("\n");
  return `${draft.body}\n\nSources:\n${list}`;
}

function normalizeRejectReason(value) {
  const reason = asString(value).trim();
  return reason ? reason.slice(0, MAX_REJECT_REASON) : null;
}

module.exports = {
  MAX_PENDING,
  MAX_REJECT_REASON,
  validateDraft,
  buildPublishedBody,
  normalizeRejectReason,
};

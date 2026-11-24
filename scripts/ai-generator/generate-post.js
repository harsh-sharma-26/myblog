// =====================================================================
// [AI GENERATOR] generate-post.js : ek AI draft banake site ki review queue me bhejna
// ---------------------------------------------------------------------
// GitHub Actions ise har 12 ghante chalata hai (.github/workflows/ai-post.yml). Local pe bhi chala sakte ho:
//   npm run generate-post                 -> asli draft banake SITE_URL pe bhejta hai
//   DRY_RUN=1 npm run generate-post       -> draft sirf terminal me dikhata hai, kahin bhejta nahi
//
// Steps:
//   1) Site se context: queue me jagah hai? pichle topics / sources / reject reasons   (GET /api/ai-drafts/context)
//   2) Topic chuno (sabse kam likha gaya)                                              (topics.js)
//   3) RSS se 3-5 asli logon ke articles, jo pehle use nahi hue                         (sources.js)
//   4) Gemini (free tier) se apne shabdon me post likhwao, JSON format me               (prompts.js)
//   5) Code se jaancho: format, copy-paste, nakli quotes. Fail -> ek baar dobara          (checks.js)
//   6) Draft bhejo -> admin portal me "pending"                                         (POST /api/ai-drafts)
//
// Env (local: .env, GitHub: repo Secrets):
//   GEMINI_API_KEY        aistudio.google.com ki free key
//   AI_DRAFTS_API_TOKEN   site ke .env / Render env wala same token
//   SITE_URL              jaise https://myblog.onrender.com  (default http://localhost:3000)
//   GEMINI_MODELS         optional, comma list. Pehla busy/limit pe ho to agla try hota hai.
//
// GitHub public repo ke logs sab dekh sakte hain, isliye yahan sirf topic / draft id / counts log hote hain,
// post ka content nahi (DRY_RUN me hi content print hota hai).
// =====================================================================

require("dotenv").config({ quiet: true });
const { GoogleGenAI } = require("@google/genai");
const { pickTopic } = require("./topics");
const { collectArticles } = require("./sources");
const { SYSTEM_INSTRUCTION, buildPrompt, RESPONSE_SCHEMA } = require("./prompts");
const { checkDraft } = require("./checks");

const SITE_URL = (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const API_TOKEN = process.env.AI_DRAFTS_API_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DRY_RUN = process.env.DRY_RUN === "1";
// Free tier pe: 3.8/3.6 Flash kabhi-kabhi "high demand" (503) dete hain, flash-lite sabse available hai.
const MODELS = (process.env.GEMINI_MODELS || "gemini-3.8-flash,gemini-3.6-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const MIN_ARTICLES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => console.log(new Date().toISOString(), ...args);

function requireEnv() {
  const missing = [];
  if (!GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (!API_TOKEN) missing.push("AI_DRAFTS_API_TOKEN");
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
}

// ---------------------------------------------------------------------
// Site API. Render ka free server so jaata hai, pehli request pe jaagne me ~1 minute lagta hai,
// isliye network error / 502 / 503 pe kuch baar ruk ke dobara try.
// ---------------------------------------------------------------------
async function siteRequest(path, options = {}) {
  const attempts = 6;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${SITE_URL}${path}`, {
        ...options,
        headers: { Authorization: `Bearer ${API_TOKEN}`, Accept: "application/json", ...(options.headers || {}) },
        signal: AbortSignal.timeout(60000),
      });
      if ([502, 503, 504].includes(response.status) && attempt < attempts) {
        log(`  site returned ${response.status}, waiting for it to wake up (${attempt}/${attempts})`);
        await sleep(15000);
        continue;
      }
      const body = await response.json().catch(() => ({}));
      return { status: response.status, body };
    } catch (error) {
      if (attempt === attempts) throw new Error(`Site unreachable at ${SITE_URL}: ${error.message}`);
      log(`  site not reachable yet (${error.message}), retrying (${attempt}/${attempts})`);
      await sleep(15000);
    }
  }
  throw new Error("unreachable");
}

// ---------------------------------------------------------------------
// Gemini: models ek-ek karke. 503 (busy) -> thoda ruk ke wahi model ek baar aur. 429 (free limit) / 404 -> agla model.
// ---------------------------------------------------------------------
async function generateWithGemini(ai, prompt) {
  const errors = [];
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            responseJsonSchema: RESPONSE_SCHEMA,
            maxOutputTokens: 8192,
          },
        });
        const text = response.text || "";
        try {
          return { model, draft: JSON.parse(text) };
        } catch {
          errors.push(`${model}: response was not valid JSON`);
          break;
        }
      } catch (error) {
        const status = error.status || 0;
        errors.push(`${model}: ${status} ${String(error.message).slice(0, 120)}`);
        if ((status === 503 || status === 500) && attempt === 1) {
          log(`  ${model} busy (${status}), retrying in 20s`);
          await sleep(20000);
          continue;
        }
        break; // 429 / 404 / dusra error -> agla model
      }
    }
  }
  throw new Error(`All Gemini models failed:\n  ${errors.join("\n  ")}`);
}

async function main() {
  requireEnv();
  log(`AI generator start. site=${SITE_URL} dryRun=${DRY_RUN}`);

  // 1) Context
  const context = await siteRequest("/api/ai-drafts/context");
  if (context.status !== 200) {
    throw new Error(`Context request failed (${context.status}): ${context.body.error || "unknown error"}`);
  }
  const { pending, maxPending, canAccept, recent } = context.body;
  log(`Queue: ${pending}/${maxPending} pending`);
  if (!canAccept && !DRY_RUN) {
    log("Queue is full. Review pending drafts on /admin/ai-posts. Skipping this run (no AI call made).");
    return;
  }

  // 2) Topic
  const topic = pickTopic(recent);
  log(`Topic: ${topic.key}`);

  // 3) Research
  const usedUrls = recent.flatMap((draft) => draft.sources.map((line) => (line.match(/https?:\/\/\S+/) || [""])[0]));
  const articles = await collectArticles(topic, usedUrls.filter(Boolean), log);
  log(`Articles: ${articles.length} (${articles.map((a) => a.site).join(", ")})`);
  if (articles.length < MIN_ARTICLES) {
    throw new Error(`Only ${articles.length} usable articles for "${topic.key}" (need ${MIN_ARTICLES}). Feeds may be down.`);
  }

  // 4 + 5) Likho aur jaancho (ek retry, pichli galti batakar)
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const sameTopic = recent.filter((d) => d.topic === topic.key);
  const avoidTitles = recent.slice(0, 15).map((d) => d.title);
  const rejectReasons = recent.filter((d) => d.status === "rejected" && d.rejectReason).slice(0, 5).map((d) => d.rejectReason);
  log(`Context for prompt: ${sameTopic.length} earlier drafts on this topic, ${rejectReasons.length} reject reasons`);

  let result;
  let model;
  let extraNote = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const prompt = buildPrompt({ topic, articles, avoidTitles, rejectReasons, extraNote });
    const generated = await generateWithGemini(ai, prompt);
    model = generated.model;
    result = checkDraft(generated.draft, articles);
    log(`Attempt ${attempt}: model=${model} words=${result.words} ok=${result.ok}${result.ok ? "" : ` problems=[${result.problems.join("; ")}]`}`);
    if (result.ok) break;
    extraNote = `Your previous attempt had these problems, fix them: ${result.problems.join("; ")}. Remember: quotes must be copied exactly from the sources, and everything outside quotes must be in your own words.`;
  }
  if (!result.ok) {
    throw new Error(`Draft failed checks twice, not sending it: ${result.problems.join("; ")}`);
  }

  const payload = { ...result.draft, topic: topic.key };

  if (DRY_RUN) {
    log("DRY_RUN: draft below was NOT sent.\n");
    console.log(`TITLE: ${payload.title}\nSUMMARY: ${payload.summary}\n\n${payload.body}\n\nSOURCES:\n${payload.sources.join("\n")}`);
    return;
  }

  // 6) Bhejo
  const sent = await siteRequest("/api/ai-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (sent.status !== 201) {
    throw new Error(`Sending draft failed (${sent.status}): ${sent.body.error || "unknown error"}`);
  }
  log(`Draft #${sent.body.id} sent (topic=${topic.key}, model=${model}, words=${result.words}, sources=${payload.sources.length}). Review it at ${SITE_URL}/admin/ai-posts`);
}

main().catch((error) => {
  log(`FAILED: ${error.message}`);
  process.exitCode = 1;
});

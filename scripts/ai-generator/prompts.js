// =====================================================================
// [AI GENERATOR] prompts.js : AI ko kya aur kaise likhna hai (rules)
// ---------------------------------------------------------------------
// Rules ka matlab: AI kai logon ke experiences padh ke APNE SHABDON me ek nayi post likhe.
//   - copy-paste nahi (checks.js isko code se bhi check karta hai)
//   - quotes chhote, sirf wahi jo source me sach me likha hai, naam ke saath
//   - medical advice / diagnosis nahi
// Admin ke reject reasons yahan prompt me jaate hain, taaki agla draft unse seekhe.
// =====================================================================

const SYSTEM_INSTRUCTION = `You write warm, practical self-help articles for a personal blog.
You are given several real articles written by different people about one topic. Your job is to read their
experiences and write ONE new, original article that brings their lessons together.

Hard rules:
- Write everything in your own words. Never copy or lightly reword sentences from the sources.
- Use ideas and experiences from at least 3 different sources, not just one.
- Include 2 to 4 short direct quotes (each 25 words or fewer). A quote must be copied exactly, word for word,
  from the source text you were given, inside straight double quotes "like this", followed by who said it,
  for example: "quote text" (Jane Doe, Tiny Buddha). Never invent quotes, names, stories, studies or numbers.
- Do not give medical, psychiatric or medication advice and do not diagnose. If the topic touches anxiety,
  depression or trauma, gently suggest talking to a qualified professional.
- Plain text only. No Markdown: no #, no *, no bullet symbols. Separate paragraphs with one blank line.
  You may use 2 to 4 short subheadings, each on its own line.
- Length: 900 to 1300 words. Friendly, honest, concrete, with practical takeaways. No clickbait.`;

function formatSources(articles) {
  return articles
    .map(
      (article, index) =>
        `SOURCE [${index + 1}]\nTitle: ${article.title}\nAuthor: ${article.author} (${article.site})\nURL: ${article.url}\nText:\n${article.text}`,
    )
    .join("\n\n----------\n\n");
}

function buildPrompt({ topic, articles, avoidTitles, rejectReasons, extraNote }) {
  const parts = [`Topic: ${topic.label}`, "", formatSources(articles), ""];

  if (avoidTitles.length) {
    parts.push(`Recent titles on this blog (do not repeat them or write something too similar):\n- ${avoidTitles.join("\n- ")}`, "");
  }
  if (rejectReasons.length) {
    parts.push(`The editor rejected earlier drafts for these reasons. Avoid these problems:\n- ${rejectReasons.join("\n- ")}`, "");
  }
  if (extraNote) parts.push(extraNote, "");

  parts.push(
    `Return JSON with:
- title: a clear, specific title (at most 90 characters)
- summary: 1 or 2 sentences (at most 200 characters)
- body: the full article as plain text
- usedSources: the numbers of the sources you actually drew from, e.g. [1, 3, 4]`,
  );
  return parts.join("\n");
}

// Gemini ko JSON isi shape me dena hai (responseJsonSchema). Format galat ho hi nahi sakta.
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    body: { type: "string" },
    usedSources: { type: "array", items: { type: "integer" } },
  },
  required: ["title", "summary", "body", "usedSources"],
};

module.exports = { SYSTEM_INSTRUCTION, buildPrompt, RESPONSE_SCHEMA };

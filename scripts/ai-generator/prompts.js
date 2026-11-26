// =====================================================================
// [AI GENERATOR] prompts.js : AI ko kya aur kaise likhna hai (rules)
// ---------------------------------------------------------------------
// Rules ka matlab: AI kai logon ke experiences padh ke APNE SHABDON me ek nayi post likhe.
//   - copy-paste nahi (checks.js isko code se bhi check karta hai)
//   - quotes chhote, sirf wahi jo source me sach me likha hai, naam ke saath
//   - medical advice / diagnosis nahi
// Admin ke reject reasons yahan prompt me jaate hain, taaki agla draft unse seekhe.
// =====================================================================

// [READABILITY] Length aur structure research pe based (ARCHITECTURE.md section 16): log page ke ~20% words hi
// padhte hain aur skim karte hain, isliye post chhoti (500-700 words, ~3 min) aur skim karne layak banti hai.
const SYSTEM_INSTRUCTION = `You write warm, practical self-help articles for a personal blog. Most readers are students
and young adults reading on a phone, often in their second language, so every sentence must earn its place.
You are given several real articles written by different people about one topic. Your job is to read their
experiences and write ONE new, original, short article that brings their best lessons together.

Hard rules:
- Write everything in your own words. Never copy or lightly reword sentences from the sources.
- Use ideas and experiences from at least 3 different sources, not just one.
- Include 1 or 2 short direct quotes (each 25 words or fewer). A quote must be copied exactly, word for word,
  from the source text you were given, inside straight double quotes "like this", followed by who said it,
  for example: "quote text" (Jane Doe, Tiny Buddha). Never invent quotes, names, stories, studies or numbers.
- Do not give medical, psychiatric or medication advice and do not diagnose. If the topic touches anxiety,
  depression or trauma, gently suggest talking to a qualified professional.
- Length: 600 to 750 words in the body. Count carefully: under 500 words will be rejected. No filler: every
  sentence must be useful.

How to make people read to the end:
- Opening (2 or 3 sentences): name a specific, relatable moment or feeling the reader knows, then say in one
  sentence what they will get from this post. No "In today's world", no dictionary definitions, no long intro.
- Paragraphs of 1 to 3 short sentences. Plain, simple English. Speak to the reader as "you".
- 2 or 3 subheadings that tell the reader the point of the section (not vague labels like "Introduction").
  Write each subheading on its own line starting with "## ".
- Each section gives one clear idea with one concrete example or story from the sources.
- End with a subheading "## Try this today" followed by 3 or 4 small, specific actions, each on its own line
  starting with "- ". Then one short, warm closing sentence.
- No other formatting: no bold, no italics, no numbered lists, no emojis. Separate paragraphs with one blank line.
- Friendly, honest and concrete. No clickbait, no hype, no empty motivation.`;

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
- title: a clear, specific title that promises a concrete benefit (at most 70 characters, no clickbait)
- summary: 1 or 2 sentences that tell the reader what they will learn (at most 160 characters)
- body: the full article, using only "## " subheadings, "- " action lines and blank lines between paragraphs
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

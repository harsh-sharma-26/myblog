// =====================================================================
// [AI GENERATOR] checks.js : AI ki post ko code se jaanchna (admin tak pahunchne se pehle)
// ---------------------------------------------------------------------
//   1) Format  : title/summary/body ki length, Markdown ke nishaan saaf
//   2) Copy    : quotes ke bahar koi 12+ shabdon ka hissa kisi source se hubahu to nahi (copy-paste)
//   3) Quotes  : har quote sach me kisi source me likha hai ya AI ne ghad liya (nakli quote)
// Fail ho to generate-post.js ek baar dobara likhwata hai, phir bhi fail to draft nahi bhejta.
// =====================================================================

const COPY_RUN_WORDS = 12; // itne shabd lagaatar same = copy maana jayega
const MIN_QUOTE_WORDS = 4; // isse chhote "quotes" (jaise "self-care") check nahi karte

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(words, size) {
  const set = new Set();
  for (let i = 0; i + size <= words.length; i += 1) set.add(words.slice(i, i + size).join(" "));
  return set;
}

// "..." aur “...” dono tarah ke quotes
function extractQuotes(text) {
  const quotes = [];
  const pattern = /"([^"\n]{3,400})"|“([^”\n]{3,400})”/g;
  let match;
  while ((match = pattern.exec(text))) quotes.push(match[1] || match[2]);
  return quotes;
}

function removeQuotes(text) {
  return text.replace(/"[^"\n]{3,400}"|“[^”\n]{3,400}”/g, " ");
}

// Markdown ke chhote nishaan hata do (site body ko plain text dikhati hai)
function cleanBody(body) {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function checkDraft(draft, articles) {
  const problems = [];
  const title = String(draft.title || "").trim().replace(/^["“]|["”]$/g, "");
  const summary = String(draft.summary || "").trim();
  const body = cleanBody(String(draft.body || ""));
  const words = body.split(/\s+/).filter(Boolean).length;

  if (title.length < 10 || title.length > 120) problems.push(`title length ${title.length} (needs 10-120 characters)`);
  if (summary.length < 20 || summary.length > 250) problems.push(`summary length ${summary.length} (needs 20-250 characters)`);
  if (words < 600 || words > 2200) problems.push(`body has ${words} words (needs 600-2200)`);

  // Copy check: quotes hata ke, body ke har 12-shabd tukde ko sources ke tukdon se milao
  const sourceShingles = new Set();
  for (const article of articles) {
    for (const s of shingles(normalizeWords(article.text), COPY_RUN_WORDS)) sourceShingles.add(s);
  }
  const copied = [...shingles(normalizeWords(removeQuotes(body)), COPY_RUN_WORDS)].filter((s) => sourceShingles.has(s));
  if (copied.length) problems.push(`${copied.length} passage(s) copied word for word from a source outside quotes`);

  // Quote check: quote ke shabd lagaatar kisi source me hone chahiye
  const sourceTexts = articles.map((article) => ` ${normalizeWords(article.text).join(" ")} `);
  const fakeQuotes = extractQuotes(body).filter((quote) => {
    const quoteWords = normalizeWords(quote);
    if (quoteWords.length < MIN_QUOTE_WORDS) return false;
    const needle = ` ${quoteWords.join(" ")} `;
    return !sourceTexts.some((text) => text.includes(needle));
  });
  if (fakeQuotes.length) problems.push(`${fakeQuotes.length} quote(s) not found word for word in any source`);
  const longQuotes = extractQuotes(body).filter((quote) => normalizeWords(quote).length > 35);
  if (longQuotes.length) problems.push(`${longQuotes.length} quote(s) longer than 35 words`);

  // Sources: AI ne jo numbers bataye unke links; galat number ignore. Kam se kam 2 chahiye.
  const used = [...new Set((draft.usedSources || []).filter((n) => Number.isInteger(n) && n >= 1 && n <= articles.length))];
  // "Title (Author, Site): link". Author aur site ek hi ho (jaise James Clear) to naam ek hi baar.
  const sourceList = (used.length >= 2 ? used.map((n) => articles[n - 1]) : articles).map((article) => {
    const byline = article.author === article.site ? article.author : `${article.author}, ${article.site}`;
    return `${article.title.replace(/\s+/g, " ")} (${byline}): ${article.url}`;
  });

  return { ok: problems.length === 0, problems, draft: { title, summary, body, sources: sourceList }, words };
}

module.exports = { checkDraft, cleanBody, extractQuotes, normalizeWords };

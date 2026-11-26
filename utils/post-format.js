// =====================================================================
// [READABILITY] post-format.js : post ka body padhne layak dikhana + "X min read"
// ---------------------------------------------------------------------
// Body database me plain text hi rehta hai. Yahan sirf usko hisson (blocks) me baanta jata hai:
//   "## Kuch heading"      -> chhoti heading
//   "- kuch point"         -> list ka ek point
//   khaali line            -> naya paragraph
// Ye blocks EJS me <%= %> se dikhte hain (escape hoke), to koi HTML/script body se page me nahi ghus sakta.
// Normal users ki purani posts pe bhi chalta hai: unme ye nishaan nahi hain to wo bas paragraphs ban jaati hain.
// =====================================================================

const WORDS_PER_MINUTE = 200; // aam adult ~238 padhta hai; humare zyada readers ki English doosri bhasha hai
// Link ke end ka . , ) ? jaisa punctuation link me nahi gina jata ("dekho https://x.com." me "." bahar)
const URL_PATTERN = /(https?:\/\/[^\s<>"]*[^\s<>".,;:!?)'\]])/i;

// AI posts ke end me "Sources:" list judti hai (utils/ai-drafts.js). Reading time me usko nahi gin-te.
function mainText(body) {
  const text = String(body || "");
  const index = text.search(/\n\s*Sources:\s*\n/);
  return index === -1 ? text : text.slice(0, index);
}

function readingMinutes(body) {
  const words = mainText(body).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// Ek line ko text + link tukdon me todo, taaki EJS link ko <a> bana sake aur baaki ko escape kare
function splitLinks(line) {
  return line
    .split(URL_PATTERN)
    .filter((part) => part !== "")
    .map((part) => (/^https?:\/\//i.test(part) ? { link: part } : { text: part }));
}

function parseBody(body) {
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "p", parts: splitLinks(paragraph.join("\n")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const rawLine of String(body || "").replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    // "Sources:" (AI posts ke end me) bhi heading jaisa dikhe
    const heading = line.match(/^#{1,6}\s+(.+)$/) || line.match(/^(Sources):$/);
    const item = line.match(/^[-•*]\s+(.+)$/);

    if (!line) {
      flushParagraph();
      flushList();
    } else if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h", text: heading[1] });
    } else if (item) {
      flushParagraph();
      if (!list) list = { type: "ul", items: [] };
      list.items.push(splitLinks(item[1]));
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

module.exports = { parseBody, readingMinutes, WORDS_PER_MINUTE };

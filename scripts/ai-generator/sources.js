// =====================================================================
// [AI GENERATOR] sources.js : RSS feeds se asli logon ke articles laana (research)
// ---------------------------------------------------------------------
// Koi search API nahi (wo free me nahi milti). Iski jagah blogs ke RSS feeds padhte hain: RSS bana hi
// isliye hai ki dusre programs use padhein. Har article ke saath title, author ka naam aur link aata hai,
// jo post ke end me "Sources" me jaata hai.
//
// Extra npm package nahi: RSS ka simple XML regex se padhte hain (sirf <item> ke title/link/creator/content).
// =====================================================================

const USER_AGENT = "MyBlogBot/1.0 (personal blog research; reads public RSS feeds)";
const FETCH_TIMEOUT_MS = 20000;
const MIN_WORDS = 400; // isse chhota article (sirf teaser) kaam ka nahi
const MAX_WORDS_PER_ARTICLE = 1200; // AI ko itna hi bhejo (free tier ke tokens bachane ke liye)
const MAX_ARTICLES = 5;
const MAX_PER_SITE = { "tinybuddha.com": 4, "jamesclear.com": 1 };

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", hellip: "…", mdash: "—", ndash: "–",
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const number = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

function stripCdata(text) {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

// Article ke HTML ko saaf text me: paragraph -> nayi line, baaki tags hata do
function htmlToText(html) {
  const text = html
    .replace(/<(script|style|figure|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    // WordPress feed ke end ki "The post X appeared first on Y" line hatao
    .filter((line) => line && !/appeared first on/i.test(line))
    .join("\n\n");
}

function tag(itemXml, name) {
  const match = itemXml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? stripCdata(match[1]).trim() : "";
}

function parseRss(xml, siteName) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  return items.map((itemXml) => {
    const html = tag(itemXml, "content:encoded") || decodeEntities(tag(itemXml, "description"));
    const text = htmlToText(html);
    return {
      site: siteName,
      title: decodeEntities(tag(itemXml, "title")),
      url: tag(itemXml, "link"),
      author: decodeEntities(tag(itemXml, "dc:creator")) || siteName,
      text,
      words: text.split(/\s+/).filter(Boolean).length,
    };
  });
}

function truncateWords(text, maxWords) {
  const words = text.split(/(\s+)/);
  let count = 0;
  let out = "";
  for (const piece of words) {
    if (/\S/.test(piece)) count += 1;
    if (count > maxWords) return `${out.trim()} …`;
    out += piece;
  }
  return out;
}

function siteFeeds(topic) {
  return [
    { site: "tinybuddha.com", name: "Tiny Buddha", url: `https://tinybuddha.com/tag/${encodeURIComponent(topic.tinyBuddhaTag)}/feed/` },
    { site: "tinybuddha.com", name: "Tiny Buddha", url: `https://tinybuddha.com/tag/${encodeURIComponent(topic.tinyBuddhaTag)}/feed/?paged=2` },
    { site: "jamesclear.com", name: "James Clear", url: `https://jamesclear.com/?s=${encodeURIComponent(topic.jamesClearQuery)}&feed=rss2` },
  ];
}

// Topic ke liye 3-5 articles: pehle kabhi use na hue, kaafi lambe, aur har article alag author ka
// (taaki ek hi insaan ki baat copy na ho, kai logon ke experiences mile).
async function collectArticles(topic, usedUrls, log = console.log) {
  const used = new Set(usedUrls);
  const all = [];
  for (const feed of siteFeeds(topic)) {
    try {
      const xml = await fetchText(feed.url);
      all.push(...parseRss(xml, feed.name).map((article) => ({ ...article, siteKey: feed.site })));
    } catch (error) {
      log(`  feed skipped (${feed.url}): ${error.message}`);
    }
  }

  const picked = [];
  const authors = new Set();
  const perSite = {};
  for (const article of all) {
    if (picked.length >= MAX_ARTICLES) break;
    if (!article.url || used.has(article.url) || article.words < MIN_WORDS) continue;
    if (authors.has(article.author.toLowerCase())) continue;
    if ((perSite[article.siteKey] || 0) >= (MAX_PER_SITE[article.siteKey] || 1)) continue;
    if (picked.some((p) => p.url === article.url)) continue;

    authors.add(article.author.toLowerCase());
    perSite[article.siteKey] = (perSite[article.siteKey] || 0) + 1;
    picked.push({ ...article, text: truncateWords(article.text, MAX_WORDS_PER_ARTICLE) });
  }
  return picked;
}

module.exports = { collectArticles, parseRss, htmlToText, decodeEntities, USER_AGENT };

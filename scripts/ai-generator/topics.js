// =====================================================================
// [AI GENERATOR] topics.js : kin topics pe posts banengi, aur har topic ka research kahan se hoga
// ---------------------------------------------------------------------
// Naya topic jodna ho to yahan ek object aur jod do. Har topic ke liye:
//   key             : ai_drafts.topic me yahi save hota hai (aage duplicate topic rokne ke kaam aata hai)
//   label           : AI ko batane ke liye topic ka naam
//   tinyBuddhaTag   : https://tinybuddha.com/tag/<tag>/feed/  (asli logon ki first-person kahaniyan)
//   jamesClearQuery : https://jamesclear.com/?s=<query>&feed=rss2  (habits / productivity pe articles)
//
// Kyun ye do sites: dono RSS me POORA article deti hain (free, koi key nahi), aur dono ke robots.txt
// in URLs ko allow karte hain. Tiny Buddha ka search (/?s=) robots.txt me disallowed hai, isliye
// wahan search nahi, tag feed use hota hai.
// =====================================================================

const TOPICS = [
  { key: "habits", label: "building better habits", tinyBuddhaTag: "habits", jamesClearQuery: "habits" },
  { key: "overthinking", label: "overthinking", tinyBuddhaTag: "overthinking", jamesClearQuery: "overthinking" },
  { key: "motivation", label: "motivation", tinyBuddhaTag: "motivation", jamesClearQuery: "motivation" },
  { key: "productivity", label: "productivity", tinyBuddhaTag: "productivity", jamesClearQuery: "productivity" },
  { key: "relationships", label: "relationships", tinyBuddhaTag: "relationships", jamesClearQuery: "relationships" },
  { key: "confidence", label: "confidence", tinyBuddhaTag: "confidence", jamesClearQuery: "confidence" },
];

// Sabse kam likha gaya topic chuno (pichle ~40 drafts me). Barabar ho to random, lekin pichla topic dobara nahi.
function pickTopic(recentDrafts, random = Math.random) {
  const counts = new Map(TOPICS.map((topic) => [topic.key, 0]));
  for (const draft of recentDrafts) {
    if (counts.has(draft.topic)) counts.set(draft.topic, counts.get(draft.topic) + 1);
  }
  const lastTopic = recentDrafts.length ? recentDrafts[0].topic : null;
  const candidates = TOPICS.length > 1 ? TOPICS.filter((topic) => topic.key !== lastTopic) : TOPICS;
  const fewest = Math.min(...candidates.map((topic) => counts.get(topic.key)));
  const least = candidates.filter((topic) => counts.get(topic.key) === fewest);
  return least[Math.floor(random() * least.length)];
}

module.exports = { TOPICS, pickTopic };

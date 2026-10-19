// =====================================================================
// rate-limit.js : brute-force (baar-baar password guess karna) rokne ke liye
// ---------------------------------------------------------------------
// Ek chhota in-memory counter. Kisi "key" (jaise IP+email) ke liye ginta hai ki WINDOW ke andar kitni baar
// koshish hui. MAX se zyada hone par us key ko WINDOW khatam hone tak block kar deta hai.
//
// Limitations (jaanboojh ke simple rakha hai):
//   - Memory me hai: server restart par counters reset ho jate hain.
//   - Agar app ek se zyada server instances pe chale, har instance ka apna counter hoga.
//   Bade scale par Redis jaisa shared store lagta hai. Is blog ke liye ye kaafi hai.
//   - Proxy (Railway/Heroku...) ke peeche req.ip sab ka same dikhta hai jab tak TRUST_PROXY=1 set na ho (app.js).
// =====================================================================

function createLimiter({ max, windowMs }) {
  const entries = new Map(); // key -> { count, resetAt }

  // Purani entries hatate rehte hain, warna Map badhta jayega (memory leak).
  // .unref() ka matlab: sirf ye timer bacha ho to bhi process band hone se na roke (script/test me hang nahi hoga).
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }, 60 * 1000).unref();

  function getActive(key) {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.resetAt <= Date.now()) {
      entries.delete(key);
      return null;
    }
    return entry;
  }

  return {
    // Kya ye key abhi block hai?
    isBlocked(key) {
      const entry = getActive(key);
      return !!entry && entry.count >= max;
    },
    // Ek koshish (ya failure) gino
    hit(key) {
      const entry = getActive(key);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(key, { count: 1, resetAt: Date.now() + windowMs });
      }
    },
    // Sahi login hone par us key ka counter saaf
    reset(key) {
      entries.delete(key);
    },
  };
}

module.exports = { createLimiter };

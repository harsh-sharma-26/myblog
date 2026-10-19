// =====================================================================
// validation.js : form / URL se aaya har input yahan check hota hai
// ---------------------------------------------------------------------
// Browser ka HTML `required` / `maxlength` sirf suvidha hai, koi bhi curl/Postman se seedha request bhej sakta hai.
// Isliye asli check hamesha server pe hota hai (yahan). Sab functions `{ error, values }` return karte hain:
//   error  = null (sab theek) ya message (string)
//   values = saaf kiya hua (trim / lowercase) data, jo aage DB me jata hai
// Messages usi Hinglish style me hain jo pehle se project me tha.
// =====================================================================

const { MAX_PASSWORD_BYTES } = require("./password");

// Express `extended: true` ke saath ek hi naam ke do fields aa jaye (title=a&title=b) to value ARRAY ban jati hai,
// ya title[x]=1 se OBJECT. Bina check ke .trim() chalate hi server crash ho jata. Isliye sirf string maante hain.
function asString(value) {
  return typeof value === "string" ? value : "";
}

// DB column limits (schema.sql se match): title/summary = varchar(255), body = TEXT (max 65535 BYTES)
const MAX_TITLE = 255;
const MAX_SUMMARY = 255;
const MAX_BODY_BYTES = 65535;

const MAX_EMAIL = 255;
const MAX_NAME = 100;
const MIN_NAME = 2;
const MIN_PASSWORD = 8;

// Simple email shape: "kuch@kuch.kuch", bina space ke. (Poori RFC validation overkill hai;
// asli proof ye hota hai ki us email pe mail bheji jaye, jo abhi scope me nahi hai.)
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value) {
  return asString(value).trim().toLowerCase();
}

// ---------------------------------------------------------------------
// POST (create + edit dono me same rules)
// Form me content ka field naam "content" hai, DB me column "body" hai.
// ---------------------------------------------------------------------
function validatePost(body) {
  const title = asString(body.title).trim();
  const summary = asString(body.summary).trim();
  const content = asString(body.content).trim();

  if (!title || !summary || !content) {
    return { error: "Title, summary aur content teeno zaruri hain.", values: null };
  }
  if (title.length > MAX_TITLE) {
    return { error: `Title ${MAX_TITLE} characters se zyada nahi ho sakta.`, values: null };
  }
  if (summary.length > MAX_SUMMARY) {
    return { error: `Summary ${MAX_SUMMARY} characters se zyada nahi ho sakti.`, values: null };
  }
  // TEXT column ki limit BYTES me hoti hai (emoji / Hindi letters 1 se zyada byte lete hain), isliye length nahi byteLength.
  if (Buffer.byteLength(content, "utf8") > MAX_BODY_BYTES) {
    return { error: "Content bahut bada hai, thoda chhota karo.", values: null };
  }
  return { error: null, values: { title, summary, content } };
}

// ---------------------------------------------------------------------
// SIGNUP (normal user)
// `values` galti hone par bhi wapas milta hai taaki form dobara dikhate waqt naam/email bhare rahe
// (password kabhi wapas nahi bhejte).
// ---------------------------------------------------------------------
function validateSignup(body) {
  const displayName = asString(body.displayName).trim();
  const email = normalizeEmail(body.email);
  const password = asString(body.password); // password trim NAHI karte: space bhi password ka hissa ho sakta hai
  const confirmPassword = asString(body.confirmPassword);
  const values = { displayName, email };

  if (displayName.length < MIN_NAME || displayName.length > MAX_NAME) {
    return { error: `Naam ${MIN_NAME} se ${MAX_NAME} characters ke beech hona chahiye.`, values };
  }
  if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    return { error: "Please ek valid email daalo.", values };
  }
  const passwordError = checkPasswordRules(password);
  if (passwordError) {
    return { error: passwordError, values };
  }
  if (password !== confirmPassword) {
    return { error: "Dono password match nahi kar rahe.", values };
  }
  return { error: null, values: { ...values, password } };
}

// Login me sirf itna dekhte hain ki dono cheezein string me aayi. Password ke rules (8 char etc.) yahan
// jaan-bujhkar nahi lagaye: warna galat login pe ye pata chal jata ki "password ka format kya hota hai".
function validateLogin(body) {
  const email = normalizeEmail(body.email);
  const password = asString(body.password);

  if (!email || !password || email.length > MAX_EMAIL) {
    return { error: "Email aur password dono daalo.", values: { email } };
  }
  // 72 bytes se lamba password sahi ho hi nahi sakta (signup me allow nahi), bcrypt ko bhejne ki zaroorat nahi.
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return { error: "Email ya password galat hai.", values: { email } };
  }
  return { error: null, values: { email, password } };
}

// Signup aur admin password script, dono yahi rules use karte hain.
function checkPasswordRules(password) {
  if (password.length < MIN_PASSWORD) {
    return `Password kam se kam ${MIN_PASSWORD} characters ka hona chahiye.`;
  }
  if (Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES) {
    return `Password ${MAX_PASSWORD_BYTES} bytes se lamba nahi ho sakta.`;
  }
  return null;
}

// ---------------------------------------------------------------------
// URL ka :id. Sirf 1 se 2147483647 tak ki poori digits (MySQL `int` ki limit) maante hain.
// "abc", "1abc", "-5", "1.5", bahut lambe numbers sab null return karte hain (route 404 de deta hai).
// ---------------------------------------------------------------------
function parseId(value) {
  if (!/^\d{1,10}$/.test(String(value))) return null;
  const id = Number(value);
  return id >= 1 && id <= 2147483647 ? id : null;
}

// ---------------------------------------------------------------------
// Login ke baad "wapas kahan bhejein" (?next=/posts/5). [OPEN REDIRECT se bachav]
// Agar koi ?next=https://evil.com bhej de aur hum bina check ke redirect kar de, to user login ke baad
// nakli site pe pahunch jata. Isliye sirf apni site ka path (/ se shuru, // ya \ ke bina) allow hai.
// ---------------------------------------------------------------------
function safeNextPath(value) {
  const next = asString(value);
  const looksLocal =
    next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !/[\r\n]/.test(next);
  return looksLocal ? next : null;
}

module.exports = {
  asString,
  validatePost,
  validateSignup,
  validateLogin,
  checkPasswordRules,
  normalizeEmail,
  parseId,
  safeNextPath,
};

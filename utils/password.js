// =====================================================================
// password.js : password hash karna aur verify karna (bcrypt)
// ---------------------------------------------------------------------
// Password ko DB me kabhi plain text me save nahi karte. bcrypt ek "one-way" hash banata hai:
//   - hash se original password wapas nahi nikal sakte,
//   - har baar naya random "salt" judta hai, to same password ka hash alag aata hai,
//   - jaan-bujhkar slow hai (COST se control hota hai), taaki attacker lakhon guess/second na laga sake.
// `bcryptjs` pure JavaScript hai (native build nahi chahiye), isliye Mac/Linux/cloud sab jagah install ho jata hai.
// =====================================================================

const bcrypt = require("bcryptjs");

// 12 = lagbhag 2^12 rounds. Laptop pe ~200-300ms lagta hai: user ko pata nahi chalta,
// par attacker ke liye brute-force bahut mehnga ho jata hai. Hardware tez ho to isse badha sakte ho.
const COST = 12;

// bcrypt sirf password ke pehle 72 BYTES padhta hai, usse aage ka hissa ignore hota hai.
// Isliye validation me 72 bytes se lamba password reject karte hain (utils/validation.js).
const MAX_PASSWORD_BYTES = 72;

function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, COST);
}

function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

// [TIMING ATTACK se bachav] Login me agar email DB me nahi milta to hum bcrypt chalate hi nahi the,
// to wo response BAHUT jaldi aata (kuch ms) jabki sahi email + galat password pe ~250ms lagte.
// Attacker is farak se jaan leta ki "ye email registered hai". Isliye email na mile tab bhi
// ek dummy hash ke saath compare chalate hain, taaki dono case me time lagbhag barabar rahe.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", COST);

module.exports = { hashPassword, verifyPassword, DUMMY_HASH, MAX_PASSWORD_BYTES };

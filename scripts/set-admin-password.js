// =====================================================================
// set-admin-password.js : admin (authors table wale) ka login password set karne ki script
// ---------------------------------------------------------------------
// Admin ke liye website pe signup nahi hai (koi bhi khud ko admin na bana sake). Isliye har author ka password
// yahan se, server ke terminal se set hota hai. Ye script password ko bcrypt se hash karke
// authors.password_hash me save karti hai. Plain password kahin store nahi hota.
//
// Use:
//   npm run set-admin-password                     -> sab authors ki list dikhati hai (kiska password set hai, kiska nahi)
//   npm run set-admin-password -- admin@x.com      -> us author ka password set / badal deti hai (typing chhupi rehti hai)
//   echo "mera-password" | npm run set-admin-password -- admin@x.com    -> script/automation ke liye (stdin se)
//
// Pehle schema.sql ka PART 2 (ya fresh DB ka PART 1) chala hona chahiye, warna password_hash column nahi milega.
// Password ke wahi rules hain jo signup me hain (utils/validation.js).
// =====================================================================

require("dotenv").config();
const readline = require("readline");

const db = require("../data/database");
const { hashPassword } = require("../utils/password");
const { checkPasswordRules, normalizeEmail } = require("../utils/validation");

// Terminal me password type karte waqt characters screen pe nahi dikhte.
// (rl._writeToOutput readline ka internal function hai, isi ko khali karke typing chhupate hain; ye common trick hai.)
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    rl._writeToOutput = () => {}; // question likhne ke baad ka sab output (typed characters) band
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

// Pipe se aaya ho (echo "pw" | ...) to terminal nahi hota, stdin ki pehli line padh lo.
function readFirstLineFromStdin() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    // resolve(line) PEHLE, rl.close() BAAD me: close() turant "close" event chala deta hai jo resolve("") kar deta,
    // aur promise pehli resolve wali value hi leta hai.
    rl.once("line", (line) => {
      resolve(line);
      rl.close();
    });
    rl.once("close", () => resolve("")); // input bina line ke khatam hua (khali stdin)
  });
}

async function listAuthors() {
  const [rows] = await db.query("SELECT id, Name, Email, password_hash IS NOT NULL AS has_password FROM authors");
  if (rows.length === 0) {
    console.log("authors table khali hai.");
    return;
  }
  console.log("Authors (admins):");
  for (const row of rows) {
    console.log(`  #${row.id}  ${row.Name}  <${row.Email}>  ${row.has_password ? "password SET" : "password NOT SET (login band)"}`);
  }
  console.log('\nPassword set karne ke liye: npm run set-admin-password -- <email>');
}

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg) {
    await listAuthors();
    return;
  }

  const email = normalizeEmail(emailArg);

  // Pipe wala password DB query SE PEHLE padhna zaruri hai. Query ke intezar (await) ke dauran stdin ka data aa ke
  // khatam ho jata hai; tab tak koi sun nahi raha hota to wo kho jata hai aur baad me readline ko kuch nahi milta.
  const pipedPassword = process.stdin.isTTY ? null : await readFirstLineFromStdin();

  const [rows] = await db.query("SELECT id, Name FROM authors WHERE Email = ?", [email]);
  if (rows.length === 0) {
    throw new Error(`"${email}" email ka koi author nahi mila. Bina argument ke chalao to list dikhegi.`);
  }

  let password;
  let confirm;
  if (process.stdin.isTTY) {
    password = await askHidden(`New password for ${rows[0].Name} <${email}>: `);
    confirm = await askHidden("Confirm password: ");
  } else {
    password = confirm = pipedPassword;
  }

  if (password !== confirm) throw new Error("Dono password match nahi kar rahe.");
  const ruleError = checkPasswordRules(password);
  if (ruleError) throw new Error(ruleError);

  const passwordHash = await hashPassword(password);
  await db.query("UPDATE authors SET password_hash = ? WHERE id = ?", [passwordHash, rows[0].id]);
  console.log(`Done: ${rows[0].Name} ka password set ho gaya. Ab /admin/login se login kar sakte hain.`);
}

main()
  .catch((error) => {
    console.error("Error:", error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end()); // pool band karo, warna script terminal me atki rehti hai

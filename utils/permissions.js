// =====================================================================
// permissions.js : "kaun kya kar sakta hai" ka SAARA logic ek hi jagah
// ---------------------------------------------------------------------
// Do tarah ke log hain (currentUser.type):
//   'admin' = authors table wala insaan. Kisi bhi post par create / read / update / delete.
//   'user'  = users table wala normal insaan. Sirf APNI banayi post par update / delete.
//
// Post ka owner DB me ye batata hai:
//   posts.author_id set  -> admin ki post
//   posts.user_id   set  -> normal user ki post
// (dono me se exactly ek set hota hai, schema.sql ka CHECK constraint ye force karta hai)
//
// Ye rules routes me jagah-jagah copy na ho, isliye sab yahin hain. Views bhi inhi ko use karte hain
// (res.locals.canModify) taaki "Edit/Delete" button sirf unhe dikhe jinhe permission hai.
// NOTE: view me button chhupana sirf UI hai, asli suraksha server pe check karne se hai (routes/blog.js).
// =====================================================================

// Kya ye currentUser is post ko edit/delete kar sakta hai?
function canModifyPost(currentUser, post) {
  if (!currentUser || !post) return false;
  if (currentUser.type === "admin") return true; // admin = har post
  // Normal user: sirf jahan post.user_id uski apni id ho. (admin ki post me user_id NULL hota hai, to false)
  return currentUser.type === "user" && post.user_id === currentUser.id;
}

// UPDATE / DELETE query ke WHERE me jodne ke liye extra shart. Ye "defense in depth" hai:
// route pehle hi canModifyPost se check kar chuka hota hai, par check aur query ke beech ke
// chhote se time me kuch badal jaye (race condition) tab bhi normal user DB level pe sirf apni hi row chhu paye.
// Admin ke liye koi extra shart nahi (wo har post badal sakta hai).
function ownerFilter(currentUser) {
  if (currentUser.type === "admin") return { sql: "", params: [] };
  return { sql: " AND user_id = ?", params: [currentUser.id] };
}

module.exports = { canModifyPost, ownerFilter };

const express = require("express");
const db = require("../data/database");
const asyncHandler = require("../utils/async-handler");
const { validatePost, parseId } = require("../utils/validation");
const { canModifyPost, ownerFilter } = require("../utils/permissions");
const { requireLogin, requireNormalUser } = require("../middleware/auth");

const router = express.Router(); //returns a new router object that can be used to define routes and middleware for the application. It allows us to modularize our route definitions and keep them organized in separate files.

// =====================================================================
// WHO CAN DO WHAT (poora logic utils/permissions.js me hai)
//   Guest (login nahi)  : sirf posts padh sakta hai
//   Normal user         : padh sakta hai, post bana sakta hai, APNI post edit/delete kar sakta hai, like/unlike kar sakta hai
//   Admin (authors)     : sab kuch, kisi ki bhi post par. (like/unlike nahi: post_likes sirf users ke liye hai)
// =====================================================================

// ---------------------------------------------------------------------
// [AUTH - LEFT JOIN] Posts ka owner ab do jagah se aa sakta hai:
//   posts.author_id set -> admin ki post (authors table)
//   posts.user_id   set -> normal user ki post (users table)
// Pehle yahan `INNER JOIN authors` tha. INNER JOIN me match na mile to poori row gayab ho jati hai, aur user ki
// post ka author_id NULL hota hai, to wo /posts list se gayab ho jati aur /posts/:id pe 404 aata.
// LEFT JOIN me `posts` ki har row aati hai, aur jis table me match nahi mila uske columns NULL aate hain.
// COALESCE(a, b) pehli non-NULL value deta hai: admin ki post me authors.Name, user ki post me users.display_name.
//
// authors.Email sirf admin ki post me aata hai (user ki post me NULL), user ki email kabhi public nahi dikhti.
//
// liked_by_me: kya CURRENT user ne ye post like kiya hai (1 ya 0). Pehle ye browser ke localStorage me yaad rehta
// tha (sirf usi browser me), ab server (post_likes table) se aata hai, to kisi bhi device pe sahi dikhta hai.
// Query me ek `?` hai (pl.user_id = ?): usme current user ki id jati hai, guest/admin ke liye null jata hai
// (`user_id = NULL` kabhi true nahi hota, to liked_by_me = 0 aata hai).
// ---------------------------------------------------------------------
const POST_SELECT = `
  SELECT posts.*,
         COALESCE(authors.Name, users.display_name) AS author_name,
         authors.Email AS author_email,
         EXISTS (
           SELECT 1 FROM post_likes pl WHERE pl.post_id = posts.id AND pl.user_id = ?
         ) AS liked_by_me
  FROM posts
  LEFT JOIN authors ON posts.author_id = authors.id
  LEFT JOIN users ON posts.user_id = users.id
`;

// post_likes sirf normal users ke hain, isliye admin ke liye null (liked_by_me hamesha 0).
function likerIdOf(currentUser) {
  return currentUser && currentUser.type === "user" ? currentUser.id : null;
}

// ---------------------------------------------------------------------
// [VALIDATION] URL me :id aaye to pehle check karo ki wo sahi number hai ("/posts/abc" ya "/posts/99999999999" nahi).
// Galat ho to seedha 404, DB tak jaate hi nahi. Sahi ho to req.params.id ko string se Number bana dete hain.
// router.param ek baar likhne se is router ke har ":id" wale route par apne aap chalta hai.
// ---------------------------------------------------------------------
router.param("id", (req, res, next, value) => {
  const id = parseId(value);
  if (id === null) {
    if (req.accepts(["html", "json"]) === "json") {
      return res.status(404).json({ error: "Post not found" });
    }
    return res.status(404).render("404");
  }
  req.params.id = id;
  next();
});

// ---------------------------------------------------------------------
// [AUTH] Edit / delete se pehle: post dhundo (nahi mili -> 404), aur check karo ki current user ko iski permission
// hai (nahi -> 403). Dono edit routes aur delete route ye middleware use karte hain, to check ek hi jagah hai.
// requireLogin iske PEHLE lagta hai, to yahan req.currentUser hamesha maujood hota hai.
// Post req.post me rakh dete hain taaki route ko dobara DB se na padhna pade.
// ---------------------------------------------------------------------
const loadModifiablePost = asyncHandler(async (req, res, next) => {
  const [posts] = await db.query("SELECT * FROM posts WHERE id = ?", [req.params.id]);

  if (posts.length === 0) {
    return res.status(404).render("404");
  }
  if (!canModifyPost(req.currentUser, posts[0])) {
    return res.status(403).render("403");
  }
  req.post = posts[0];
  next();
});

router.get("/", (req, res) => {
  res.redirect("/posts"); //request ayi thi sirf localhost:3000/ pe, to redirect kar diya localhost:3000/posts pe.
});

router.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const [posts] = await db.query(POST_SELECT, [likerIdOf(req.currentUser)]); //[posts] is array destructuring.
    res.render("posts-list", { posts: posts });
  }),
);

// [AUTH] Post banane ke liye login zaruri hai. Pehle yahan authors ka dropdown tha (koi bhi kisi bhi author ke naam
// se post bana sakta tha). Ab dropdown nahi hai: post hamesha logged-in insaan ke apne naam se jati hai.
router.get("/new-post", requireLogin, (req, res) => {
  res.render("create-post");
});

router.post(
  "/posts",
  requireLogin,
  asyncHandler(async (req, res) => {
    // [FIX #5] Pehle data check karo, galat ho to DB tak jaane hi mat do
    const { error, values } = validatePost(req.body);
    if (error) {
      res.status(400).render("400", { message: error });
      return;
    }

    // Owner SERVER decide karta hai (session se), form se kabhi nahi. Form me author/user_id bhejne wala field hai hi
    // nahi, aur bhej bhi de to ignore hota hai. Isse koi dusre ke naam se post nahi bana sakta.
    //   admin -> posts.author_id = uski authors.id   (user_id NULL rehta hai)
    //   user  -> posts.user_id   = uski users.id     (author_id NULL rehta hai)
    // Column ka naam yahan fixed 2 options me se aata hai (user input se nahi), isliye query me jodna safe hai.
    const ownerColumn = req.currentUser.type === "admin" ? "author_id" : "user_id";

    await db.query(`INSERT INTO posts (title, summary, body, ${ownerColumn}) VALUES (?, ?, ?, ?)`, [
      values.title,
      values.summary,
      values.content,
      req.currentUser.id,
    ]);
    res.redirect("/posts");
  }),
);

//:id is a dynamic parameter that represents the unique identifier of a specific post. When a request is made to a URL like /posts/1, the value 1 will be captured as req.params.id. This allows us to retrieve and manipulate data for that specific post based on its ID.
router.get(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const [posts] = await db.query(`${POST_SELECT} WHERE posts.id = ?`, [
      likerIdOf(req.currentUser),
      req.params.id,
    ]);

    if (!posts || posts.length === 0) {
      res.status(404).render("404");
      return;
    }

    res.render("post-detail", { post: posts[0] });
  }),
);

router.get("/posts/:id/edit", requireLogin, loadModifiablePost, (req, res) => {
  // Author dropdown hata diya: post ka owner edit se kabhi nahi badalta (admin kisi ki post edit kare tab bhi
  // post usi ki rehti hai jisne banayi thi).
  res.render("update-post", { post: req.post });
});

router.post(
  "/posts/:id/edit",
  requireLogin,
  loadModifiablePost,
  asyncHandler(async (req, res) => {
    // [FIX #5] Edit pe bhi same validation
    const { error, values } = validatePost(req.body);
    if (error) {
      res.status(400).render("400", { message: error });
      return;
    }

    // ownerFilter: normal user ke liye WHERE me "AND user_id = ?" jod deta hai (permissions.js dekho), yaani
    // loadModifiablePost ke check ke baad bhi DB level pe wo sirf apni hi row badal sakta hai.
    const filter = ownerFilter(req.currentUser);
    await db.query(`UPDATE posts SET title = ?, summary = ?, body = ? WHERE id = ?${filter.sql}`, [
      values.title,
      values.summary,
      values.content,
      req.params.id,
      ...filter.params,
    ]);
    res.redirect("/posts");
  }),
);

router.post(
  "/posts/:id/delete",
  requireLogin,
  loadModifiablePost,
  asyncHandler(async (req, res) => {
    // post_likes me is post ki rows apne aap hat jati hain (FK ON DELETE CASCADE, schema.sql dekho)
    const filter = ownerFilter(req.currentUser);
    await db.query(`DELETE FROM posts WHERE id = ?${filter.sql}`, [req.params.id, ...filter.params]);
    res.redirect("/posts");
  }),
);

// ---------------------------------------------------------------------
// LIKE / UNLIKE
// Pehle: sirf `posts.likes` badhta/ghatta tha, koi nahi jaanta tha kisne kiya (ek hi insaan 100 baar like kar sakta tha).
// Ab: post_likes table me (user_id, post_id) ki ek row banti/hatti hai, aur uske saath posts.likes counter badalta hai.
// Dono kaam EK transaction me hote hain: ya dono ho ya dono nahi. Warna beech me crash hone par counter aur
// post_likes ka hisab alag ho jata.
//
// Idempotent: dobara like karo (ya jo like hi nahi tha use unlike karo) to counter dobara nahi badalta, kyunki
//   - like   : post_likes ka PRIMARY KEY (user_id, post_id) duplicate insert ko rok deta hai (ER_DUP_ENTRY)
//   - unlike : DELETE ne 1 row hatayi tabhi counter ghatate hain (affectedRows === 1)
// Isse double-click / do tabs / retry se count kabhi galat nahi hota.
//
// COALESCE(likes, 0): purani rows me likes NULL ho sakta hai (schema.sql ka comment dekho), NULL + 1 = NULL hota
// hai aur like kabhi badhta nahi tha. COALESCE se NULL ko 0 maan ke ginte hain.
// GREATEST(..., 0): count kabhi negative nahi hota (purane likes jinka user-wise record nahi, unke saath bhi safe).
// ---------------------------------------------------------------------
async function setLike(req, res, shouldLike) {
  const postId = req.params.id;
  const userId = req.currentUser.id;

  const connection = await db.getConnection(); // transaction ek hi connection par chalta hai, pool se ek alag le lete hain
  try {
    await connection.beginTransaction();

    const [posts] = await connection.query("SELECT id FROM posts WHERE id = ?", [postId]);
    if (posts.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Post not found" });
    }

    let changed;
    if (shouldLike) {
      try {
        await connection.query("INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)", [userId, postId]);
        changed = true;
      } catch (dbError) {
        if (dbError.code !== "ER_DUP_ENTRY") throw dbError;
        changed = false; // pehle se liked tha, kuch nahi badalna
      }
    } else {
      const [result] = await connection.query(
        "DELETE FROM post_likes WHERE user_id = ? AND post_id = ?",
        [userId, postId],
      );
      changed = result.affectedRows === 1;
    }

    if (changed) {
      await connection.query(
        shouldLike
          ? "UPDATE posts SET likes = COALESCE(likes, 0) + 1 WHERE id = ?"
          : "UPDATE posts SET likes = GREATEST(COALESCE(likes, 0) - 1, 0) WHERE id = ?",
        [postId],
      );
    }

    const [rows] = await connection.query("SELECT COALESCE(likes, 0) AS likes FROM posts WHERE id = ?", [postId]);
    await connection.commit();

    res.json({ likes: rows[0].likes, liked: shouldLike });
  } catch (error) {
    await connection.rollback().catch(() => {}); // rollback khud fail ho to original error chhupana nahi chahte
    // Insert aur post delete ke beech race: kisi ne usi pal post delete kar di to FK error aata hai -> 404
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({ error: "Post not found" });
    }
    throw error;
  } finally {
    connection.release(); // connection pool ko wapas, nahi to pool khatam ho jayega
  }
}

// requireLogin -> guest ko 401 JSON; requireNormalUser -> admin ko 403 JSON (auth.js dekho)
router.post(
  "/posts/:id/like",
  requireLogin,
  requireNormalUser,
  asyncHandler((req, res) => setLike(req, res, true)),
);

router.post(
  "/posts/:id/unlike",
  requireLogin,
  requireNormalUser,
  asyncHandler((req, res) => setLike(req, res, false)),
);

module.exports = router;

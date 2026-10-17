const express = require("express");
const db = require("../data/database");

const router = express.Router(); //returns a new router object that can be used to define routes and middleware for the application. It allows us to modularize our route definitions and keep them organized in separate files.

// [FIX #1 - Async errors] Express 4 async route ke andar aaye error ko khud nahi pakadta,
// to DB fail hone pe request hang ho jati thi. Ye chhota helper har route ko wrap karta hai:
// agar route ke andar koi error aaye to wo `next(error)` ko chala deta hai, aur app.js ka
// error handler 500 page dikha deta hai. Ab har route me alag try/catch likhne ki zarurat nahi.
function asyncHandler(routeFunction) {
  return function (req, res, next) {
    Promise.resolve(routeFunction(req, res, next)).catch(next);
  };
}

// [FIX #5 - Server side validation] Pehle sirf HTML ka `required` tha, jo browser se bypass ho sakta hai.
// Ye function form ka data check karta hai aur galti ho to error message (string) return karta hai,
// sab theek ho to `null` return karta hai.
function validatePost(body, { needsAuthor }) {
  const title = (body.title || "").trim();
  const summary = (body.summary || "").trim();
  const content = (body.content || "").trim();

  if (!title || !summary || !content) {
    return "Title, summary aur content teeno zaruri hain.";
  }
  if (summary.length > 255) {
    return "Summary 255 characters se zyada nahi ho sakti.";
  }
  // Author sirf naya post banate waqt chahiye, edit me ab bhi bhej sakte hain (FIX #4)
  if (needsAuthor && !/^\d+$/.test(String(body.author || ""))) {
    return "Please ek valid author select karo.";
  }
  return null;
}

router.get("/", (req, res) => {
  res.redirect("/posts"); //request ayi thi sirf localhost:3000/ pe, to redirect kar diya localhost:3000/posts pe.
});

router.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const query = `
    SELECT posts.*, authors.Name AS author_name FROM posts
    INNER JOIN authors ON posts.author_id = authors.id
  `;
    const [posts] = await db.query(query); //[posts] is array destructuring.
    res.render("posts-list", { posts: posts });
  }),
);

//we use async/await here because we are performing asynchronous database operations. The await keyword is used to wait for the result of the database query before proceeding to render the view. This ensures that we have the necessary data (authors) available before rendering the "create-post" view, which requires this data to populate a dropdown or selection list for authors.

router.get(
  "/new-post",
  asyncHandler(async (req, res) => {
    //we use array destructuring to extract the first element of the array returned by db.query(). The query returns an array where the first element contains the rows of the result set (in this case, the authors), and the second element contains metadata about the query execution. By using [authors], we directly get the rows we need for rendering the view.

    const [authors] = await db.query("SELECT * FROM authors"); //this is an asynchronous operation, so we use await to wait for the result before proceeding. The query retrieves all authors from the database, which will be used to populate a dropdown in the new post form.

    res.render("create-post", { authors: authors });
  }),
);

router.post(
  "/posts",
  asyncHandler(async (req, res) => {
    // [FIX #5] Pehle data check karo, galat ho to DB tak jaane hi mat do
    const error = validatePost(req.body, { needsAuthor: true });
    if (error) {
      res.status(400).render("400", { message: error });
      return;
    }

    const data = [
      req.body.title.trim(),
      req.body.summary.trim(),
      req.body.content.trim(),
      req.body.author,
    ];
    await db.query(
      "INSERT INTO posts (title, summary, body, author_id) VALUES (?)",
      [data],
    );
    res.redirect("/posts");
  }),
);

//:id is a dynamic parameter that represents the unique identifier of a specific post. When a request is made to a URL like /posts/1, the value 1 will be captured as req.params.id. This allows us to retrieve and manipulate data for that specific post based on its ID.
router.get(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const query = `
    SELECT posts.*, authors.Name AS author_name, authors.Email AS author_email FROM posts
    INNER JOIN authors ON posts.author_id = authors.id
    WHERE posts.id = ?
  `;

    const [posts] = await db.query(query, [req.params.id]);

    if (!posts || posts.length === 0) {
      res.status(404).render("404");
      return;
    }

    res.render("post-detail", { post: posts[0] });
  }),
);

router.get(
  "/posts/:id/edit",
  asyncHandler(async (req, res) => {
    const query = `
    SELECT * FROM posts WHERE id = ?
  `;
    const [posts] = await db.query(query, [req.params.id]);

    if (!posts || posts.length === 0) {
      res.status(404).render("404");
      return;
    }

    // [FIX #4 - Author change] Edit form me author dropdown dikhane ke liye saare authors bhi bhejte hain
    const [authors] = await db.query("SELECT * FROM authors");

    res.render("update-post", { post: posts[0], authors: authors });
  }),
);

router.post(
  "/posts/:id/edit",
  asyncHandler(async (req, res) => {
    // [FIX #5] Edit pe bhi same validation (author ab edit me bhi aata hai - FIX #4)
    const error = validatePost(req.body, { needsAuthor: true });
    if (error) {
      res.status(400).render("400", { message: error });
      return;
    }

    // [FIX #4] author_id bhi update hota hai ab, pehle sirf title/summary/body hota tha
    const query = `
    UPDATE posts SET title = ?, summary = ?, body = ?, author_id = ?
    WHERE id = ?
  `;
    await db.query(query, [
      req.body.title.trim(),
      req.body.summary.trim(),
      req.body.content.trim(),
      req.body.author,
      req.params.id,
    ]);
    res.redirect("/posts");
  }),
);

router.post(
  "/posts/:id/delete",
  asyncHandler(async (req, res) => {
    await db.query("DELETE FROM posts WHERE id = ?", [req.params.id]);
    res.redirect("/posts");
  }),
);

router.post(
  "/posts/:id/like",
  asyncHandler(async (req, res) => {
    await db.query("UPDATE posts SET likes = likes + 1 WHERE id = ?", [
      req.params.id,
    ]);
    const [rows] = await db.query("SELECT likes FROM posts WHERE id = ?", [
      req.params.id,
    ]);
    // [FIX #1] Agar post exist hi nahi karta to rows[0] undefined hota aur server crash hota.
    // Ab 404 JSON bhejte hain.
    if (rows.length === 0) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json({ likes: rows[0].likes });
  }),
);

router.post(
  "/posts/:id/unlike",
  asyncHandler(async (req, res) => {
    // GREATEST(likes - 1, 0) ensures the count never goes below 0
    // (e.g. agar koi race condition ho jaaye, negative likes na dikhein)
    await db.query(
      "UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?",
      [req.params.id],
    );
    const [rows] = await db.query("SELECT likes FROM posts WHERE id = ?", [
      req.params.id,
    ]);
    // [FIX #1] Same: post na mile to crash ki jagah 404
    if (rows.length === 0) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json({ likes: rows[0].likes });
  }),
);

module.exports = router;

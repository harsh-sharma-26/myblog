const express = require("express");
const db = require("../data/database");

const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/posts"); //request ayi thi sirf localhost:3000/ pe, to redirect kar diya localhost:3000/posts pe.
});

router.get("/posts", async (req, res) => {
  const query = `
    SELECT posts.*, authors.Name AS author_name FROM posts
    INNER JOIN authors ON posts.author_id = authors.id
  `;
  const [posts] = await db.query(query); //[posts] is array destructuring.
  res.render("posts-list", { posts: posts });
});

//we use async/await here because we are performing asynchronous database operations. The await keyword is used to wait for the result of the database query before proceeding to render the view. This ensures that we have the necessary data (authors) available before rendering the "create-post" view, which requires this data to populate a dropdown or selection list for authors.

router.get("/new-post", async (req, res) => {
  //we use array destructuring to extract the first element of the array returned by db.query(). The query returns an array where the first element contains the rows of the result set (in this case, the authors), and the second element contains metadata about the query execution. By using [authors], we directly get the rows we need for rendering the view.

  const [authors] = await db.query("SELECT * FROM authors"); //this is an asynchronous operation, so we use await to wait for the result before proceeding. The query retrieves all authors from the database, which will be used to populate a dropdown in the new post form.

  res.render("create-post", { authors: authors });
});

router.post("/posts", async (req, res) => {
  const data = [
    req.body.title,
    req.body.summary,
    req.body.content,
    req.body.author,
  ];
  await db.query(
    "INSERT INTO posts (title, summary, body, author_id) VALUES (?)",
    [data],
  );
  res.redirect("/posts");
});

//:id is a dynamic parameter that represents the unique identifier of a specific post. When a request is made to a URL like /posts/1, the value 1 will be captured as req.params.id. This allows us to retrieve and manipulate data for that specific post based on its ID.
router.get("/posts/:id", async (req, res) => {
  const query = `
    SELECT posts.*, authors.Name AS author_name, authors.Email AS author_email FROM posts
    INNER JOIN authors ON posts.author_id = authors.id
    WHERE posts.id = ?
  `;

  const [posts] = await db.query(query, [req.params.id]);

  if (!posts || posts.length === 0) {
    res.statusCode(404).render("404");
    return;
  }

  res.render("post-detail", { post: posts[0] });
});

router.get("/posts/:id/edit", async (req, res) => {
  const query = `
    SELECT * FROM posts WHERE id = ?
  `;
  const [posts] = await db.query(query, [req.params.id]);

  if (!posts || posts.length === 0) {
    res.statusCode(404).render("404");
    return;
  }

  res.render("update-post", { post: posts[0] });
});

router.post("/posts/:id/edit", async (req, res) => {
  const query = `
    UPDATE posts SET title = ?, summary = ?, body = ?
    WHERE id = ?
  `;
  await db.query(query, [
    req.body.title,
    req.body.summary,
    req.body.content,
    req.params.id,
  ]);
  res.redirect("/posts");
});

router.post("/posts/:id/delete", async (req, res) => {
  await db.query("DELETE FROM posts WHERE id = ?", [req.params.id]);
  res.redirect("/posts");
});

router.post("/posts/:id/like", async (req, res) => {
  await db.query("UPDATE posts SET likes = likes + 1 WHERE id = ?", [
    req.params.id,
  ]);
  const [rows] = await db.query("SELECT likes FROM posts WHERE id = ?", [
    req.params.id,
  ]);
  res.json({ likes: rows[0].likes });
});

router.post("/posts/:id/unlike", async (req, res) => {
  // GREATEST(likes - 1, 0) ensures the count never goes below 0
  // (e.g. agar koi race condition ho jaaye, negative likes na dikhein)
  await db.query(
    "UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?",
    [req.params.id],
  );
  const [rows] = await db.query("SELECT likes FROM posts WHERE id = ?", [
    req.params.id,
  ]);
  res.json({ likes: rows[0].likes });
});

module.exports = router;

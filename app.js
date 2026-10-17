require("dotenv").config(); // Load environment variables from .env file, It looks a little unusual cause it is not assigned to a variable, but it is correct. We are immediately invoking the function returned by require("dotenv").config() to load the environment variables into process.env.
const path = require("path");

const express = require("express");
const compression = require("compression");

const blogRoutes = require("./routes/blog");

const app = express();

// Activate EJS view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

//middlewares:
app.use(express.urlencoded({ extended: true })); // Parse incoming request bodies
app.use(compression()); // [PERF] gzip HTML/CSS/JS responses
app.use(express.static("public")); // Serve static files (e.g. CSS files)

app.use(blogRoutes);

app.use(function (error, req, res, next) {
  // Default error handling function
  // Will become active whenever any route / middleware crashes
  console.log(error);
  res.status(500).render("500");
});

app.listen(process.env.PORT || 3000);

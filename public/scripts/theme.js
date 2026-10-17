// =====================================================================
// theme.js : Light / Dark mode ka toggle + navbar ka active link
// ---------------------------------------------------------------------
// Ye file head.ejs me load hoti hai (bina defer ke), taaki page dikhne se PEHLE
// saved theme lag jaye. Warna dark mode wale user ko ek second ke liye white flash dikhta.
//
// Kaise kaam karta hai:
// - <html data-theme="dark"> ya data-theme="light" lagate hain, CSS (base.css) isi attribute ko dekhti hai.
// - User ki choice localStorage me "theme" key me save hoti hai, to refresh ke baad bhi yaad rehti hai.
// - Agar user ne kabhi choose hi nahi kiya, to attribute lagta hi nahi aur
//   CSS khud phone/computer ki setting (prefers-color-scheme) follow karti hai.
// =====================================================================

(function () {
  var STORAGE_KEY = "theme";
  var root = document.documentElement; // <html> tag

  // localStorage kabhi kabhi blocked hota hai (private mode), isliye try/catch me
  function getSavedTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function saveTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // save nahi hua to koi baat nahi, bas refresh pe reset ho jayega
    }
  }

  // Page load hote hi, agar pehle se saved theme hai to turant laga do
  var saved = getSavedTheme();
  if (saved === "light" || saved === "dark") {
    root.setAttribute("data-theme", saved);
  }

  // Abhi screen pe asli me kaun sa theme dikh raha hai (saved ya system ka)
  function getCurrentTheme() {
    var attr = root.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  // Button ka label update karo (screen reader users ke liye)
  function updateToggleLabel(button) {
    var isDark = getCurrentTheme() === "dark";
    button.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  }

  // Baaki kaam tab jab HTML poora load ho jaye (button tabhi milega)
  document.addEventListener("DOMContentLoaded", function () {
    // ---- Theme toggle button ----
    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      updateToggleLabel(toggle);
      toggle.addEventListener("click", function () {
        var next = getCurrentTheme() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        saveTheme(next);
        updateToggleLabel(toggle);
      });
    }

    // ---- Navbar me current page ka link highlight ----
    // "/posts" aur "/posts/4" dono pe "All Posts" active dikhega, "/new-post" pe "Create Post".
    var path = window.location.pathname;
    document.querySelectorAll("#main-header nav a").forEach(function (link) {
      var href = link.getAttribute("href");
      var isActive =
        href === path || (href === "/posts" && path.indexOf("/posts") === 0);
      if (isActive) {
        link.classList.add("active");
        link.setAttribute("aria-current", "page");
      }
    });
  });
})();

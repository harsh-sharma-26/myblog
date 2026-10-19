// This is a React component — but notice there is NO import/export here,
// and no npm/webpack/vite build step involved.
// It works because post-detail.ejs and posts-list.ejs load React + ReactDOM + Babel
// straight from a CDN, and the browser itself compiles this JSX on the fly
// using <script type="text/babel">. This is the simplest possible way to drop
// React into an existing server-rendered EJS app without restructuring anything.

const { useState } = React;

// [AUTH] Pehle "kaunse posts is browser ne like kiye" localStorage me save hota tha. Wo sirf usi browser me
// yaad rehta tha aur koi bhi localStorage badal ke jitni baar chahe like kar sakta tha.
// Ab ye sach DB (post_likes table) me hai. Server har widget ke div me `data-liked` bhejta hai,
// to kisi bhi browser / device me login karo, heart sahi dikhta hai. localStorage ka koi kaam nahi bacha.

// Server CSRF token <meta name="csrf-token"> me deta hai (views/includes/head.ejs).
// fetch() form nahi hai, isliye token hum header me khud bhejte hain (middleware/csrf.js check karta hai).
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute("content") : "";
}

// mode (server decide karta hai, views/includes/like-widget.ejs):
//   "user"  -> normal user, like/unlike chalega
//   "guest" -> login nahi, click par login page par bhejte hain (login ke baad wapas isi page par aayega)
//   "admin" -> admin like nahi karta (post_likes sirf users ke liye hai), button disabled, sirf count dikhta hai
function LikeButton({ postId, initialLikes, initialLiked, mode }) {
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikes);
  const [isAnimating, setIsAnimating] = useState(false);

  async function handleToggleLike() {
    if (mode === "guest") {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?next=${next}`;
      return;
    }

    // Decide upfront what we're doing, since "liked" is about to flip
    const isCurrentlyLiked = liked;
    const nextLiked = !isCurrentlyLiked;
    const endpoint = nextLiked ? "like" : "unlike";

    // Optimistic UI update — flip immediately, don't wait for the server.
    //    This is what makes Instagram/Twitter likes feel instant.
    setLiked(nextLiked);
    setLikes((current) => (nextLiked ? current + 1 : Math.max(current - 1, 0)));
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // Tell the real Express/MySQL backend which action happened, in the background
    try {
      const response = await fetch(`/posts/${postId}/${endpoint}`, {
        method: "POST",
        headers: {
          // "json" maangne se server login/permission fail par redirect HTML ki jagah JSON error deta hai
          Accept: "application/json",
          "x-csrf-token": getCsrfToken(),
        },
      });

      if (response.status === 401) {
        // Session expire ho gaya (ya doosre tab me logout hua): login par bhej do
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!response.ok) {
        throw new Error("Server rejected the request");
      }

      const data = await response.json();
      // Sync with the real count + real liked state from the database (in case of any drift)
      setLikes(data.likes);
      setLiked(data.liked);
    } catch (error) {
      // If the request failed, undo the optimistic update so the UI stays honest
      console.error("Could not update like:", error);
      setLiked(isCurrentlyLiked);
      setLikes((current) => (nextLiked ? Math.max(current - 1, 0) : current + 1));
    }
  }

  const isAdmin = mode === "admin";

  return (
    <button
      type="button"
      className={"like-button" + (liked ? " liked" : "")}
      onClick={handleToggleLike}
      disabled={isAdmin}
      aria-pressed={liked}
      aria-label={
        isAdmin ? "Admins cannot like posts" : liked ? "Unlike this post" : "Like this post"
      }
      title={isAdmin ? "Admins cannot like posts" : mode === "guest" ? "Login to like" : undefined}
    >
      <span className={"heart-icon" + (isAnimating ? " pop" : "")}>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M12 21s-6.7-4.35-9.33-8.2C1.1 10.6 1.4 7.4 3.9 5.6c2.1-1.5 4.7-1 6.1 0.9L12 8.4l2-1.9c1.4-1.9 4-2.4 6.1-0.9 2.5 1.8 2.8 5 1.23 7.2C18.7 16.65 12 21 12 21z" />
        </svg>
      </span>
      <span className="like-count">{likes}</span>
    </button>
  );
}

// Mount a <LikeButton /> into every element with class "like-widget" found on the page.
// Each post-item.ejs / post-detail.ejs renders (via includes/like-widget.ejs) an empty <div class="like-widget">
// with the post's id, like count, liked state and mode stored as data-attributes — React reads
// those and takes over from there.
document.querySelectorAll(".like-widget").forEach((el) => {
  const postId = el.dataset.postId; // "7" (string)
  const initialLikes = parseInt(el.dataset.likes, 10) || 0; // 12 (number)
  const initialLiked = el.dataset.liked === "true"; // dataset values hamesha string hoti hain, isliye boolean me badla
  const mode = el.dataset.mode; // "user" | "guest" | "admin"

  const root = ReactDOM.createRoot(el); // every like-widget div is a root for a React component tree, every like-widget has its own react tree.
  root.render(
    <LikeButton postId={postId} initialLikes={initialLikes} initialLiked={initialLiked} mode={mode} />,
  );
});

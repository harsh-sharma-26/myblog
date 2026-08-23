// This is a React component — but notice there is NO import/export here,
// and no npm/webpack/vite build step involved.
// It works because post-detail.ejs and posts-list.ejs load React + ReactDOM + Babel
// straight from a CDN, and the browser itself compiles this JSX on the fly
// using <script type="text/babel">. This is the simplest possible way to drop
// React into an existing server-rendered EJS app without restructuring anything.

const { useState } = React;

// Helper functions to read/write the list of post ids this browser has
// already liked. We store a simple array of ids under one key, e.g.
// localStorage item "likedPosts" = ["3", "7", "12"]
function getLikedPostIds() {
  try {
    const raw = localStorage.getItem("likedPosts");
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    // If localStorage is unavailable or the saved data is corrupted,
    // fail safely by pretending nothing has been liked yet.
    return [];
  }
}

function markPostAsLiked(postId) {
  const likedIds = getLikedPostIds();
  if (!likedIds.includes(postId)) {
    likedIds.push(postId);
    localStorage.setItem("likedPosts", JSON.stringify(likedIds));
  }
}

function unmarkPostAsLiked(postId) {
  const likedIds = getLikedPostIds();
  const updated = likedIds.filter((id) => id !== postId);
  localStorage.setItem("likedPosts", JSON.stringify(updated));
}

function LikeButton({ postId, initialLikes }) {
  // Instead of always starting as false, check localStorage FIRST.
  // useState(() => ...) runs this function only once, when the component
  // first mounts — this is called "lazy initial state" in React.
  const [liked, setLiked] = useState(() => getLikedPostIds().includes(postId));
  const [likes, setLikes] = useState(initialLikes);
  const [isAnimating, setIsAnimating] = useState(false);

  async function handleToggleLike() {
    // Decide upfront what we're doing, since "liked" is about to flip
    const isCurrentlyLiked = liked;
    const nextLiked = !isCurrentlyLiked;
    const endpoint = nextLiked ? "like" : "unlike";

    // 1. Optimistic UI update — flip immediately, don't wait for the server.
    //    This is what makes Instagram/Twitter likes feel instant.
    setLiked(nextLiked);
    setLikes((current) => (nextLiked ? current + 1 : current - 1));
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // 2. Tell the real Express/MySQL backend which action happened, in the background
    try {
      const response = await fetch(`/posts/${postId}/${endpoint}`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Server rejected the request");
      }

      const data = await response.json();
      // 3. Sync with the real count from the database (in case of any drift)
      setLikes(data.likes);

      // 4. Keep localStorage in sync with the new state, so a page refresh
      //    remembers whether this browser liked the post or not.
      if (nextLiked) {
        markPostAsLiked(postId);
      } else {
        unmarkPostAsLiked(postId);
      }
    } catch (error) {
      // 5. If the request failed, undo the optimistic update so the UI stays honest
      console.error("Could not update like:", error);
      setLiked(isCurrentlyLiked);
      setLikes((current) => (nextLiked ? current - 1 : current + 1));
    }
  }

  return (
    <button
      type="button"
      className={"like-button" + (liked ? " liked" : "")}
      onClick={handleToggleLike}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this post" : "Like this post"}
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
// Each post-item.ejs / post-detail.ejs simply renders an empty <div class="like-widget">
// with the post's id and current like count stored as data-attributes — React reads
// those and takes over from there.
document.querySelectorAll(".like-widget").forEach((el) => {
  const postId = el.dataset.postId;
  const initialLikes = parseInt(el.dataset.likes, 10) || 0;

  const root = ReactDOM.createRoot(el);
  root.render(<LikeButton postId={postId} initialLikes={initialLikes} />);
});

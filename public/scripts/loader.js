// =====================================================================
// loader.js : site khulne se pehle loader dikhata hai, phir site ko slide-in karata hai
// ---------------------------------------------------------------------
// Ye file head.ejs me bina defer ke load hoti hai (theme.js ke baad), taaki page ke
// pehle paint se hi site chhupi rahe aur beech me content ki jhalak na dikhe.
//
// Flow:
// 1. Turant <html> pe "is-loading" class lagti hai  -> loader.css loader dikhati hai, site chhupati hai.
// 2. setTimeout se kam se kam MIN_LOADER_TIME tak loader rukta hai
//    (aur page ke poori tarah load hone ka bhi intezar karta hai).
// 3. Phir "is-loading" hat ke "is-ready" lagti hai -> loader upar slide hoke jata hai
//    aur header/content slide-in animation ke saath aata hai (base.css + posts.css me).
// =====================================================================

(function () {
  // ---- Settings (yahan se time badal sakte ho) ----
  var MIN_LOADER_TIME = 1400; // loader kam se kam itni millisecond (1.4 sec) dikhega
  var MAX_LOADER_TIME = 4000; // safety: net slow ho tab bhi 4 sec baad site khul jayegi, atakegi nahi
  var EXIT_TIME = 900; // loader ki slide-up animation khatam hone ke baad usse page se hata dene ka time

  var root = document.documentElement; // <html> tag

  // Jin users ne phone/computer me "animations kam karo" on kiya hai unke liye loader skip,
  // seedha site dikhao (unhe animation se takleef ho sakti hai)
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var startTime = Date.now();
  var finished = false; // taaki finish() do baar na chal jaye

  // CSS ko batao ki progress bar kitni der me bharni hai (loader.css me var(--loader-time))
  root.style.setProperty("--loader-time", MIN_LOADER_TIME + "ms");

  // Step 1: loader dikhao aur site chhupao
  root.classList.add("is-loading");

  // Step 3: loader hatao, site dikhao
  function finish() {
    if (finished) return;
    finished = true;

    var loader = document.getElementById("page-loader");

    root.classList.remove("is-loading");
    root.classList.add("is-ready"); // isi class se site ki slide-in animations shuru hoti hain

    if (loader) {
      loader.classList.add("hide"); // loader upar slide hota hai
      // Animation khatam hone ke baad loader ko poori tarah delete kar do
      setTimeout(function () {
        loader.remove();
      }, EXIT_TIME);
    }
  }

  // Page load hone ke baad, bacha hua minimum time pura hone tak ruko, phir finish()
  function waitForMinTime() {
    var elapsed = Date.now() - startTime;
    var remaining = Math.max(0, MIN_LOADER_TIME - elapsed);
    setTimeout(finish, remaining); // <-- yahi wo setTimeout hai jo site ko roke rakhta hai
  }

  if (document.readyState === "complete") {
    waitForMinTime();
  } else {
    window.addEventListener("load", waitForMinTime);
  }

  // Safety net: kisi wajah se "load" event bahut late aaye (jaise CDN slow) to bhi site khul jaye
  setTimeout(finish, MAX_LOADER_TIME);
})();

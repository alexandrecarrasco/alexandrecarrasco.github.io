// ac theme: small enhancements. The site works without JavaScript; each part checks that its elements exist.
(function () {
  "use strict";
  var root = document.documentElement;

  // Light/dark toggle: flips the theme the page is showing now and remembers the choice.
  var toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener("click", function () {
      var dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) { /* storage blocked: choice lasts for this page only */ }
    });
  }

  // Copy buttons on code blocks.
  document.querySelectorAll(".code").forEach(function (block) {
    var button = block.querySelector(".code__copy");
    var code = block.querySelector("pre code") || block.querySelector("pre");
    if (!button || !code || !navigator.clipboard) return;
    button.hidden = false;
    button.setAttribute("aria-label", "Copy code to clipboard");
    button.addEventListener("click", function () {
      navigator.clipboard.writeText(code.innerText.replace(/\n$/, "")).then(function () {
        button.textContent = "Copied";
        setTimeout(function () { button.textContent = "Copy"; }, 1500);
      });
    });
  });

  // Reading progress bar.
  var bar = document.querySelector(".progress__bar");
  var article = document.querySelector(".post-body");
  if (bar && article) {
    var ticking = false;
    var update = function () {
      var start = article.offsetTop;
      var end = start + article.offsetHeight - window.innerHeight;
      var p = end > start ? (window.scrollY - start) / (end - start) : 1;
      bar.style.width = Math.max(0, Math.min(1, p)) * 100 + "%";
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // "On this page": mark the section being read.
  var tocLinks = document.querySelectorAll(".toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) { byId[decodeURIComponent(a.hash.slice(1))] = a; });
    var headings = Array.prototype.filter.call(
      document.querySelectorAll(".post-body h2[id], .post-body h3[id]"),
      function (h) { return byId[h.id]; }
    );
    var setCurrent = function (id) {
      tocLinks.forEach(function (a) { a.removeAttribute("aria-current"); });
      if (byId[id]) byId[id].setAttribute("aria-current", "location");
    };
    var observer = new IntersectionObserver(function () {
      // The current section is the last heading above the top third of the screen.
      var current = headings[0];
      var line = window.innerHeight / 3;
      headings.forEach(function (h) { if (h.getBoundingClientRect().top <= line) current = h; });
      if (current) setCurrent(current.id);
    }, { rootMargin: "0px 0px -66% 0px", threshold: [0, 1] });
    headings.forEach(function (h) { observer.observe(h); });
  }

  // On small screens the table of contents starts closed.
  var tocDetails = document.querySelector(".toc__details");
  if (tocDetails && window.matchMedia("(max-width: 999px)").matches) tocDetails.open = false;

  // Search on the Posts page. The index (index.json) is fetched on first use.
  var search = document.getElementById("search");
  var input = document.getElementById("search-input");
  if (search && input) {
    search.hidden = false;
    var results = document.querySelector(".search-results");
    var title = results.querySelector(".search-results__title");
    var list = results.querySelector(".search-results__list");
    var listings = document.querySelectorAll(".listing");
    var index = null;
    var loading = null;

    var load = function () {
      if (!loading) {
        loading = fetch(input.dataset.index)
          .then(function (r) { return r.json(); })
          .then(function (data) { index = data; });
      }
      return loading;
    };

    var render = function () {
      var q = input.value.trim().toLowerCase();
      if (!q) {
        results.hidden = true;
        listings.forEach(function (l) { l.hidden = false; });
        return;
      }
      var words = q.split(/\s+/);
      var hits = index.filter(function (p) {
        var hay = (p.title + " " + p.summary + " " + p.tags.join(" ") + " " + p.text).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) !== -1; });
      });
      list.textContent = "";
      hits.forEach(function (p) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.className = "row-link";
        a.href = p.url;
        var t = document.createElement("span");
        t.className = "row-link__title";
        t.textContent = p.title;
        var m = document.createElement("span");
        m.className = "meta";
        m.textContent = p.minutes + " min read";
        a.appendChild(t);
        a.appendChild(m);
        li.appendChild(a);
        list.appendChild(li);
      });
      title.textContent = hits.length + (hits.length === 1 ? " post matches " : " posts match ") + "“" + input.value.trim() + "”";
      results.hidden = false;
      listings.forEach(function (l) { l.hidden = true; });
    };

    input.addEventListener("focus", load, { once: true });
    input.addEventListener("input", function () { load().then(render); });
    if (location.hash === "#search") input.focus();
  }
})();

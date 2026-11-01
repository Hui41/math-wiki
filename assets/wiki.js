/*
 * Personal Math Wiki
 *
 * Features:
 * - Light / Dark mode
 * - Automatic section numbering
 * - Automatic sidebar table of contents
 * - Wiki search
 * - GitHub Pages path compatibility
 */

(() => {
  "use strict";

  // ==========================================
  // 1. Site base path
  // ==========================================

  const script = document.currentScript;

  const scriptPath = script
    ? new URL(script.src, window.location.href).pathname
    : "/assets/wiki.js";

  const base = scriptPath
    .replace(/\/assets\/wiki\.js$/, "")
    .replace(/\/$/, "");

  const siteUrl = path => base + path;


  // ==========================================
  // 2. Light and Dark mode
  // ==========================================

  const themeKey = "math-wiki-theme";

  const systemTheme = window.matchMedia(
    "(prefers-color-scheme: dark)"
  );

  let preference = null;

  try {
    preference = localStorage.getItem(themeKey);
  } catch (error) {}

  function currentTheme() {
    if (
      preference === "dark" ||
      preference === "light"
    ) {
      return preference;
    }

    return systemTheme.matches
      ? "dark"
      : "light";
  }

  function applyTheme() {
    const mode = currentTheme();

    document.documentElement.setAttribute(
      "data-theme",
      mode
    );

    document.documentElement.style.colorScheme =
      mode;

    const button = document.getElementById(
      "theme-toggle"
    );

    if (button) {
      button.textContent =
        mode === "dark"
          ? "☀ Light"
          : "☾ Dark";

      button.setAttribute(
        "aria-label",
        mode === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      );
    }
  }

  applyTheme();

  if (systemTheme.addEventListener) {
    systemTheme.addEventListener(
      "change",
      () => {
        if (!preference) applyTheme();
      }
    );
  }


  // ==========================================
  // 3. Theme button
  // ==========================================

  function setupThemeButton() {
    const header = document.querySelector(
      "body > header"
    );

    if (!header) return;

    let button = document.getElementById(
      "theme-toggle"
    );

    if (!button) {
      button = document.createElement("button");

      button.id = "theme-toggle";
      button.className = "theme-toggle";
      button.type = "button";

      let controls = header.querySelector(
        ".header-actions"
      );

      if (!controls) {
        controls = document.createElement("div");
        controls.className = "header-actions";

        const right = header.querySelector(
          ".right"
        );

        if (right) controls.appendChild(right);

        header.appendChild(controls);
      }

      controls.appendChild(button);
    }

    button.addEventListener("click", () => {
      preference =
        currentTheme() === "dark"
          ? "light"
          : "dark";

      try {
        localStorage.setItem(
          themeKey,
          preference
        );
      } catch (error) {}

      applyTheme();
    });

    applyTheme();
  }


  // ==========================================
  // 4. Wiki Search
  // ==========================================

  function setupSearch() {
    const input = document.getElementById(
      "search"
    );

    const results = document.getElementById(
      "results"
    );

    if (!input || !results) return;

    let entries = [];

    fetch(siteUrl("/search.json"))
      .then(response => {
        if (!response.ok) {
          throw new Error("Search unavailable");
        }

        return response.json();
      })
      .then(data => {
        entries = Array.isArray(data)
          ? data
          : [];
      })
      .catch(() => {
        entries = [];
      });

    input.addEventListener("input", () => {
      const query = input.value
        .trim()
        .toLocaleLowerCase();

      results.replaceChildren();

      if (!query) return;

      const matches = entries.filter(page => {
        const text = (
          (page.title || "") +
          " " +
          (page.text || "")
        ).toLocaleLowerCase();

        return text.includes(query);
      }).slice(0, 12);

      for (const page of matches) {
        const link = document.createElement("a");

        link.href =
          siteUrl("/notes/") +
          encodeURIComponent(page.slug) +
          "/";

        link.textContent =
          page.title || page.slug;

        results.appendChild(link);
      }
    });
  }


  // ==========================================
  // 5. Automatically create sidebar TOC
  // ==========================================

  function setupTableOfContents() {
    const article = document.querySelector(
      "main article"
    );

    const sidebar = document.querySelector(
      "aside"
    );

    if (!article || !sidebar) return;

    // Create the TOC container if the
    // HTML template does not contain one.

    let toc = document.getElementById(
      "page-toc"
    );

    if (!toc) {
      toc = document.createElement("div");

      toc.id = "page-toc";
      toc.className = "page-toc";

      toc.setAttribute(
        "aria-label",
        "Contents of this page"
      );

      const heading = document.createElement(
        "div"
      );

      heading.className = "toc-heading";
      heading.textContent = "On this page";

      toc.appendChild(heading);

      const results = document.getElementById(
        "results"
      );

      if (results) {
        results.insertAdjacentElement(
          "afterend",
          toc
        );
      } else {
        sidebar.appendChild(toc);
      }
    }

    // Create list if missing.

    let list = document.getElementById(
      "page-toc-list"
    );

    if (!list) {
      list = document.createElement("ul");
      list.id = "page-toc-list";
      toc.appendChild(list);
    }

    // Find note headings.

    const headings = Array.from(
      article.querySelectorAll("h1, h2, h3")
    );

    list.replaceChildren();

    if (!headings.length) {
      toc.hidden = true;
      return;
    }

    toc.hidden = false;

    // ======================================
    // 6. Section numbering
    // ======================================

    const counters = [0, 0, 0];

    const usedIds = new Set(
      Array.from(
        document.querySelectorAll("[id]")
      ).map(element => element.id)
    );

    headings.forEach((heading, index) => {
      const level = Number(
        heading.tagName.substring(1)
      );

      // Preserve original heading title.

      const original =
        heading.dataset.originalTitle ||
        heading.textContent.trim();

      heading.dataset.originalTitle =
        original;

      // Count sections.

      if (level === 1) {
        counters[0]++;
        counters[1] = 0;
        counters[2] = 0;
      } else if (level === 2) {
        counters[1]++;
        counters[2] = 0;
      } else {
        counters[2]++;
      }

      const number = counters
        .slice(0, level)
        .filter(value => value > 0)
        .join(".");

      // Avoid adding duplicate numbers.

      const alreadyNumbered =
        /^\d+(?:\.\d+)*[.．)]?\s+/.test(
          original
        );

      const displayed = alreadyNumbered
        ? original
        : number + ". " + original;

      heading.textContent = displayed;

      // Assign unique HTML anchor.

      if (!heading.id) {
        let id = "section-" + (index + 1);

        while (usedIds.has(id)) {
          id += "-x";
        }

        heading.id = id;
        usedIds.add(id);
      }

      // ====================================
      // 7. Add heading to sidebar
      // ====================================

      const item = document.createElement(
        "li"
      );

      item.className =
        "toc-" + heading.tagName.toLowerCase();

      const link = document.createElement(
        "a"
      );

      link.href =
        "#" + encodeURIComponent(heading.id);

      link.textContent = displayed;

      item.appendChild(link);
      list.appendChild(item);
    });

    toc.hidden = false;
  }


  // ==========================================
  // 8. Initialize
  // ==========================================

  function initialize() {
    setupThemeButton();
    setupSearch();
    setupTableOfContents();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }
})();

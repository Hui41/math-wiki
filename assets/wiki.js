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

      const isReferences =
        original.trim().toLowerCase() === "references";
      
      const displayed = isReferences
        ? original
        : alreadyNumbered
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


/* ==========================================
   Math Wiki: Index cleanup & Back to Top
   ========================================== */

(() => {
  "use strict";

  function initializeExtras() {

    // 1. Remove subtitle on the All Notes page.

    const isIndexPage =
      /\/notes\/(?:index\.html)?$/.test(
        window.location.pathname
      );

    if (isIndexPage) {
      const article = document.querySelector(
        "main article"
      );

      if (article) {
        const first = article.firstElementChild;

        if (
          first &&
          first.tagName === "P" &&
          first.textContent.trim() ===
            "Mathematical notes index"
        ) {
          first.remove();
        }
      }
    }

    // 2. Back-to-top button.

    if (document.getElementById("back-to-top")) {
      return;
    }

    const button = document.createElement("button");

    button.id = "back-to-top";
    button.type = "button";
    button.textContent = "↑";
    button.title = "Back to top";
    button.setAttribute(
      "aria-label",
      "Back to top"
    );

    document.body.appendChild(button);

    // 3. Button styles, including dark mode.

    const style = document.createElement("style");

    style.textContent = `
      #back-to-top {
        position: fixed;
        right: 26px;
        bottom: 26px;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        border: 1px solid #b5cbbb;
        background: #e5f0e7;
        color: #285a45;
        font-size: 25px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 3px 12px rgba(0,0,0,0.12);
        z-index: 9999;

        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transform: translateY(10px);

        transition:
          opacity 0.2s ease,
          transform 0.2s ease,
          visibility 0.2s;
      }

      #back-to-top.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
        transform: translateY(0);
      }

      #back-to-top:hover {
        background: #d4e8d9;
      }

      [data-theme="dark"] #back-to-top {
        background: #294839;
        color: #e4f3e8;
        border-color: #577361;
      }

      [data-theme="dark"] #back-to-top:hover {
        background: #385a46;
      }

      @media (max-width: 700px) {
        #back-to-top {
          right: 16px;
          bottom: 18px;
          width: 42px;
          height: 42px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #back-to-top {
          transition: none;
        }
      }
    `;

    document.head.appendChild(style);

    // 4. Show only after scrolling down.

    function updateVisibility() {
      button.classList.toggle(
        "visible",
        window.scrollY > 300
      );
    }

    window.addEventListener(
      "scroll",
      updateVisibility,
      { passive: true }
    );

    updateVisibility();

    // 5. Smoothly return to the top.

    button.addEventListener("click", () => {
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      window.scrollTo({
        top: 0,
        behavior: reducedMotion
          ? "instant"
          : "smooth"
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeExtras
    );
  } else {
    initializeExtras();
  }

})();



/* Replace homepage footer with a mathematical note */

(() => {
  function updateHomeFooter() {
    const isHome = /\/notes\/(?:index\.html)?$/.test(
      window.location.pathname
    );

    if (!isHome) return;

    const article = document.querySelector("main article");
    if (!article) return;

    // Remove any previously inserted footnote.
    document.getElementById("math-footnote")?.remove();

    // Find the existing footer.
    const footer = article.querySelector("footer") ||
                   document.querySelector("main footer");

    if (!footer) return;

    footer.innerHTML = String.raw`
      <span>
        If \(ax^2-bx-c\leq 0\) with \(a,b,c>0\), then
        \(x\leq\max\left\{
          \frac{2b}{a},
          2\sqrt{\frac ca}
        \right\}\).
      </span>
    `;

    footer.style.fontStyle = "italic";
    footer.style.fontSize = "0.85em";

    // Render the mathematics with MathJax.
    if (window.MathJax?.typesetPromise) {
      MathJax.typesetPromise([footer]);
    } else if (window.MathJax?.startup?.promise) {
      MathJax.startup.promise.then(() => {
        MathJax.typesetPromise([footer]);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      updateHomeFooter
    );
  } else {
    updateHomeFooter();
  }
})();


/* ============================================
   Math Wiki — Cross References

   Supports:
   \label{...}
   \ref{...}

   Sections and theorem-like environments.
   ============================================ */

(() => {
  'use strict';

  function initializeReferences() {
    const article =
      document.querySelector('main article');

    if (!article) return;

    const labels = new Map();

    let currentSection = '0';
    let environmentCounter = 0;

    // ----------------------------------------
    // 1. Number theorem-like environments
    // ----------------------------------------

    const elements = article.querySelectorAll(
      'h1, h2, h3, .theorem'
    );

    for (const element of elements) {

      // Section heading.
      if (/^H[123]$/.test(element.tagName)) {

        const match = element.textContent
          .trim()
          .match(/^(\d+(?:\.\d+)*)\./);

        if (element.tagName === 'H1') {
          currentSection = match
            ? match[1]
            : '0';

          environmentCounter = 0;
        }

        if (match) {
          element.dataset.wikiNumber =
            match[1];
        }

        continue;
      }

      // Proof is not numbered.
      if (element.classList.contains('proof')) {
        continue;
      }

      environmentCounter++;

      const number =
        currentSection === '0'
          ? String(environmentCounter)
          : currentSection + '.' +
            environmentCounter;

      element.dataset.wikiNumber = number;

      // Create a stable anchor.
      if (!element.id) {
        element.id = 'wiki-env-' +
          number.replace(/\./g, '-');
      }

      // Update environment title.
      const header =
        element.querySelector(':scope > header');

      if (header) {
        const original = header.textContent.trim();

        const match = original.match(
          /^([^\s(（]+)(.*)$/
        );

        if (match) {
          header.textContent =
            match[1] + ' ' + number +
            match[2];
        }
      }
    }

    // ----------------------------------------
    // 2. Associate labels with their targets
    // ----------------------------------------

    const markers =
      article.querySelectorAll('.wiki-label');

    for (const marker of markers) {
      const key = marker.dataset.wikiLabel;

      if (!key) continue;

      let target = marker.closest(
        '.theorem, h1, h2, h3'
      );

      // Labels immediately following
      // a section heading.
      if (!target) {
        const container =
          marker.closest('p') || marker;

        const previous =
          container.previousElementSibling;

        if (previous) {
          if (
            /^H[123]$/.test(previous.tagName)
          ) {
            target = previous;
          } else if (
            previous.classList.contains(
              'wiki-heading-with-edit'
            )
          ) {
            target = previous.querySelector(
              'h1, h2, h3'
            );
          }
        }
      }

      if (!target) {
        console.warn(
          'Math Wiki: no target for label',
          key
        );
        continue;
      }

      const number =
        target.dataset.wikiNumber;

      if (!number) continue;

      if (!target.id) {
        target.id = 'wiki-ref-' +
          Array.from(key)
            .map(c => c.codePointAt(0).toString(16))
            .join('-');
      }

      if (labels.has(key)) {
        console.warn(
          'Math Wiki: duplicate label',
          key
        );
      } else {
        labels.set(key, {
          number,
          id: target.id
        });
      }

      // Remove the invisible marker,
      // including its empty paragraph.
      const paragraph = marker.closest('p');

      marker.remove();

      if (
        paragraph &&
        !paragraph.textContent.trim() &&
        !paragraph.children.length
      ) {
        paragraph.remove();
      }
    }

    // ----------------------------------------
    // 3. Resolve references
    // ----------------------------------------

    const references =
      article.querySelectorAll('.wiki-crossref');

    for (const link of references) {
      const key = link.dataset.wikiRef;
      const reference = labels.get(key);

      if (!reference) {
        link.textContent = '??';
        link.title =
          'Undefined reference: ' + key;
        continue;
      }

      link.textContent = reference.number;

      link.href = '#' +
        encodeURIComponent(reference.id);

      link.title = 'Go to ' + key;
    }
  }

  // Register after the original Wiki
  // heading-numbering initialization.
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initializeReferences
    );
  } else {
    initializeReferences();
  }

})();


/* ============================================
   Math Wiki — References Navigation

   1. Add References to the sidebar TOC.
   2. Remember position before citation jumps.
   3. Show a button to return to that position.
   ============================================ */

(() => {
  "use strict";

  function initializeBibliographyNavigation() {

    const article = document.querySelector(
      "main article"
    );

    const toc = document.getElementById(
      "page-toc"
    );

    const tocList = document.getElementById(
      "page-toc-list"
    );

    if (!article) return;

    // ========================================
    // 1. Find bibliography
    // ========================================

    const bibliography = article.querySelector(
      "ol.references"
    );

    if (!bibliography) return;

    // ========================================
    // 2. Create or reuse References heading
    // ========================================

    let heading = Array.from(
      article.querySelectorAll("h1, h2, h3")
    ).find(el =>
      /^(References|参考文献)$/i.test(
        el.textContent.trim()
          .replace(/^\d+(?:\.\d+)*[.．]?\s*/, "")
      )
    );

    if (!heading) {
      heading = document.createElement("h2");
      heading.textContent = "References";

      bibliography.parentNode.insertBefore(
        heading,
        bibliography
      );
    }

    if (!heading.id) {
      heading.id = "wiki-references";
    }

    // ========================================
    // 3. Add References to sidebar
    // ========================================

    if (toc && tocList) {

      const existing = Array.from(
        tocList.querySelectorAll("a")
      ).some(link =>
        link.getAttribute("href") ===
        "#" + heading.id
      );

      if (!existing) {

        const item = document.createElement("li");

        item.className =
          "toc-h2 wiki-references-toc";

        const link = document.createElement("a");

        link.href = "#" + heading.id;
        link.textContent = "References";

        item.appendChild(link);
        tocList.appendChild(item);
      }

      toc.hidden = false;
    }

    // ========================================
    // 4. Create Back to citation button
    // ========================================

    if (document.getElementById(
      "back-to-citation"
    )) return;

    const backButton =
      document.createElement("button");

    backButton.id = "back-to-citation";
    backButton.type = "button";

    backButton.textContent = "↩";

    backButton.title =
      "Return to previous reading position";

    backButton.setAttribute(
      "aria-label",
      "Return to citation"
    );

    document.body.appendChild(backButton);

    // Position to restore when going back.
    let previousPosition = null;

    // ========================================
    // 5. Record position before citation jump
    // ========================================

    document.addEventListener(
      "click",
      event => {

        const target = event.target;

        if (!(target instanceof Element)) {
          return;
        }

        const link = target.closest(
          'a[href^="#ref-"]'
        );

        if (!link) return;

        const id = link.getAttribute(
          "href"
        ).slice(1);

        // Only handle actual bibliography links.
        if (!document.getElementById(id)) {
          return;
        }

        // Remember exact reading position.
        previousPosition = window.scrollY;

        // Show return button.
        backButton.classList.add(
          "visible"
        );
      },
      true
    );

    // ========================================
    // 6. Return without scrolling animation
    // ========================================

    backButton.addEventListener(
      "click",
      () => {

        if (previousPosition === null) return;

        const html = document.documentElement;
        const body = document.body;

        // Save the existing inline styles.
        const oldHtml =
          html.style.getPropertyValue(
            "scroll-behavior"
          );

        const oldHtmlPriority =
          html.style.getPropertyPriority(
            "scroll-behavior"
          );

        const oldBody =
          body.style.getPropertyValue(
            "scroll-behavior"
          );

        const oldBodyPriority =
          body.style.getPropertyPriority(
            "scroll-behavior"
          );

        // Temporarily disable smooth scrolling.
        html.style.setProperty(
          "scroll-behavior",
          "auto",
          "important"
        );

        body.style.setProperty(
          "scroll-behavior",
          "auto",
          "important"
        );

        window.scrollTo({
          top: previousPosition,
          left: 0,
          behavior: "instant"
        });

        // Restore the original styles.
        requestAnimationFrame(() => {

          if (oldHtml) {
            html.style.setProperty(
              "scroll-behavior",
              oldHtml,
              oldHtmlPriority
            );
          } else {
            html.style.removeProperty(
              "scroll-behavior"
            );
          }

          if (oldBody) {
            body.style.setProperty(
              "scroll-behavior",
              oldBody,
              oldBodyPriority
            );
          } else {
            body.style.removeProperty(
              "scroll-behavior"
            );
          }
        });

        // Hide button after returning.
        backButton.classList.remove(
          "visible"
        );

        previousPosition = null;
      }
    );
  }

  // Initialize after the existing sidebar TOC.
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeBibliographyNavigation
    );
  } else {
    initializeBibliographyNavigation();
  }

})();



/* Personal Math Wiki:
   Theme, table of contents, section numbering, search.
*/

(() => {
  'use strict';

  // ========================================
  // 1. Determine the GitHub Pages base path
  // ========================================

  const script = document.currentScript;

  const path = script
    ? new URL(script.src, location.href).pathname
    : '/assets/wiki.js';

  const base = path
    .replace(/\/assets\/wiki\.js(?:$|\?.*)/, '')
    .replace(/\/$/, '');

  const assetUrl = (part) => base + part;


  // ========================================
  // 2. Light / Dark theme
  // ========================================

  const key = 'math-wiki-theme';

  const media = window.matchMedia(
    '(prefers-color-scheme: dark)'
  );

  let preference = null;

  try {
    preference = localStorage.getItem(key);
  } catch (_) {}

  function theme() {
    return preference === 'dark' ||
           preference === 'light'
      ? preference
      : (media.matches ? 'dark' : 'light');
  }

  function setTheme() {
    const current = theme();

    document.documentElement.setAttribute(
      'data-theme',
      current
    );

    const button = document.getElementById(
      'theme-toggle'
    );

    if (button) {
      button.textContent = current === 'dark'
        ? '☀ Light'
        : '☾ Dark';

      button.setAttribute(
        'aria-label',
        current === 'dark'
          ? 'Switch to light mode'
          : 'Switch to dark mode'
      );

      button.setAttribute(
        'aria-pressed',
        String(current === 'dark')
      );
    }
  }

  setTheme();

  const onSystemChange = () => {
    if (
      preference !== 'dark' &&
      preference !== 'light'
    ) {
      setTheme();
    }
  };

  if (media.addEventListener) {
    media.addEventListener(
      'change',
      onSystemChange
    );
  } else if (media.addListener) {
    media.addListener(onSystemChange);
  }


  // ========================================
  // 3. Initialize the page
  // ========================================

  function initialize() {

    // --------------------------------------
    // 3.1 Create or locate theme button
    // --------------------------------------

    let button = document.getElementById(
      'theme-toggle'
    );

    // Compatibility with older templates
    if (!button) {
      const header = document.querySelector(
        'body > header'
      );

      if (header) {
        button = document.createElement('button');

        button.id = 'theme-toggle';
        button.className = 'theme-toggle';
        button.type = 'button';

        header.appendChild(button);
      }
    }

    if (button) {
      button.addEventListener('click', () => {

        preference = theme() === 'dark'
          ? 'light'
          : 'dark';

        try {
          localStorage.setItem(
            key,
            preference
          );
        } catch (_) {}

        setTheme();
      });
    }

    setTheme();


    // ======================================
    // 4. Wiki search
    // ======================================

    const input = document.getElementById(
      'search'
    );

    const results = document.getElementById(
      'results'
    );

    if (input && results) {
      let entries = [];

      fetch(assetUrl('/search.json'))
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              'Search index not found'
            );
          }

          return response.json();
        })
        .then((data) => {
          entries = Array.isArray(data)
            ? data
            : [];
        })
        .catch(() => {
          entries = [];
        });

      input.addEventListener('input', () => {

        const needle = input.value
          .trim()
          .toLocaleLowerCase();

        results.replaceChildren();

        if (!needle) return;

        const matched = entries.filter(
          (entry) => {
            const text = String(
              (entry.title || '') +
              ' ' +
              (entry.text || '')
            ).toLocaleLowerCase();

            return text.includes(needle);
          }
        ).slice(0, 12);

        for (const page of matched) {
          const anchor = document.createElement(
            'a'
          );

          anchor.href =
            assetUrl('/notes/') +
            encodeURIComponent(page.slug) +
            '/';

          anchor.textContent =
            page.title || page.slug;

          results.appendChild(anchor);
        }
      });
    }


    // ======================================
    // 5. Section numbering and page TOC
    // ======================================

    const article = document.querySelector(
      'main article'
    );

    const toc = document.getElementById(
      'page-toc'
    );

    const list = document.getElementById(
      'page-toc-list'
    );

    if (!article) return;

    const heads = Array.from(
      article.querySelectorAll(
        'h1, h2, h3'
      )
    );

    if (list) {
      list.replaceChildren();
    }

    if (!heads.length) {
      if (toc) toc.hidden = true;
      return;
    }

    const counters = [0, 0, 0];

    const allIds = new Set(
      Array.from(
        document.querySelectorAll('[id]')
      ).map(el => el.id)
    );

    heads.forEach((heading, i) => {

      const level = Number(
        heading.tagName.substring(1)
      );

      const original =
        heading.dataset.originalTitle ||
        heading.textContent.trim();

      heading.dataset.originalTitle = original;

      // Update section counters

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
        .filter(n => n > 0)
        .join('.');

      // Avoid duplicate numbering

      const alreadyNumbered =
        /^\d+(?:\.\d+)*[.．)]?\s+/.test(
          original
        );

      const displayed = alreadyNumbered
        ? original
        : `${number}. ${original}`;

      heading.textContent = displayed;

      // Give each heading a unique anchor

      if (!heading.id) {
        let id = `section-${i + 1}`;

        while (allIds.has(id)) {
          id += '-x';
        }

        heading.id = id;
        allIds.add(id);
      }

      // Generate sidebar TOC entry

      if (list) {
        const li = document.createElement(
          'li'
        );

        li.className =
          `toc-${heading.tagName.toLowerCase()}`;

        const a = document.createElement(
          'a'
        );

        a.href =
          '#' + encodeURIComponent(heading.id);

        a.textContent = displayed;

        li.appendChild(a);
        list.appendChild(li);
      }
    });

    if (toc && list) {
      toc.hidden =
        list.children.length === 0;
    }
  }


  // ========================================
  // 6. Start when the page is ready
  // ========================================

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize
    );
  } else {
    initialize();
  }

})();

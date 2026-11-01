
/* Personal Math Wiki: search, light/dark mode, numbered headings and page TOC. */
(() => {
  'use strict';

  // The script is served from /assets/wiki.js (local) or
  // /math-wiki/assets/wiki.js (GitHub Pages).
  // Determine the base automatically.
  const script = document.currentScript;
  const scriptUrl = script
    ? new URL(script.src, location.href)
    : new URL('/assets/wiki.js', location.href);

  const base = scriptUrl.pathname
    .replace(/\/assets\/wiki\.js$/, '')
    .replace(/\/$/, '');

  const siteUrl = (path) => `${base}${path}`;

  // Theme selection is remembered per browser.
  // Default follows the Mac/system theme.
  const storageKey = 'math-wiki-theme';
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  let selected = null;

  try {
    selected = localStorage.getItem(storageKey);
  } catch (_) {}

  const prefersDark = () => media.matches;

  const activeTheme = () =>
    selected === 'light' || selected === 'dark'
      ? selected
      : (prefersDark() ? 'dark' : 'light');

  const root = document.documentElement;

  function applyTheme() {
    const dark = activeTheme() === 'dark';

    root.setAttribute(
      'data-theme',
      dark ? 'dark' : 'light'
    );

    const toggle = document.getElementById('theme-toggle');

    if (toggle) {
      toggle.textContent = dark ? '☀ Light' : '☾ Dark';
      toggle.setAttribute(
        'aria-label',
        dark
          ? 'Switch to light mode'
          : 'Switch to dark mode'
      );
    }
  }

  applyTheme();

  if (media.addEventListener) {
    media.addEventListener('change', () => {
      if (!selected) applyTheme();
    });
  }

  function ready() {
    const header = document.querySelector('body > header');

    if (header && !document.getElementById('theme-toggle')) {
      const controls = document.createElement('div');
      controls.className = 'header-actions';

      const right = header.querySelector('.right');

      if (right) controls.appendChild(right);

      const button = document.createElement('button');

      button.id = 'theme-toggle';
      button.type = 'button';
      button.className = 'theme-toggle';

      button.addEventListener('click', () => {
        selected = activeTheme() === 'dark'
          ? 'light'
          : 'dark';

        try {
          localStorage.setItem(storageKey, selected);
        } catch (_) {}

        applyTheme();
      });

      controls.appendChild(button);
      header.appendChild(controls);

      applyTheme();
    }

    // Search.
    // No dependence on Python-generated hard-coded /notes/ paths.
    const input = document.getElementById('search');
    const results = document.getElementById('results');

    if (input && results) {
      let entries = [];

      fetch(siteUrl('/search.json'))
        .then(r => {
          if (!r.ok) {
            throw new Error('Search index unavailable');
          }
          return r.json();
        })
        .then(data => {
          entries = Array.isArray(data) ? data : [];
        })
        .catch(() => {
          entries = [];
        });

      input.addEventListener('input', () => {
        const q = input.value.trim().toLocaleLowerCase();

        results.replaceChildren();

        if (!q) return;

        for (const page of entries
          .filter(p =>
            (`${p.title || ''} ${p.text || ''}`)
              .toLocaleLowerCase()
              .includes(q)
          )
          .slice(0, 12)) {

          const a = document.createElement('a');

          a.href =
            siteUrl('/notes/') +
            encodeURIComponent(page.slug) +
            '/';

          a.textContent = page.title || page.slug;

          results.appendChild(a);
        }
      });
    }

    // The LaTeX renderer outputs sections
    // as article h1, h2 and h3.
    // Number them without altering the source .wiki files.
    const article = document.querySelector('main article');

    const toc = document.getElementById('page-toc');
    const list = document.getElementById('page-toc-list');

    if (!article) return;

    const headings = [
      ...article.querySelectorAll('h1, h2, h3')
    ];

    if (!headings.length) {
      if (toc) toc.hidden = true;
      return;
    }

    const counts = [0, 0, 0];

    const usedIds = new Set(
      [...document.querySelectorAll('[id]')]
        .map(x => x.id)
    );

    if (list) list.replaceChildren();

    for (const heading of headings) {
      const level = Number(heading.tagName.slice(1));

      const original =
        heading.dataset.originalTitle ||
        heading.textContent.trim();

      heading.dataset.originalTitle = original;

      // Skip numbering if heading already has
      // a manually written numeric prefix.
      const manuallyNumbered =
        /^\d+(?:\.\d+)*[.)．]?\s+/.test(original);

      counts[level - 1]++;

      for (let j = level; j < 3; j++) {
        counts[j] = 0;
      }

      const parts = counts
        .slice(0, level)
        .filter(
          (n, i) => i === level - 1 || n !== 0
        );

      const number = parts.join('.');

      const title = manuallyNumbered
        ? original
        : `${number}. ${original}`;

      heading.textContent = title;

      if (!heading.id) {
        let id =
          `section-${level}-${number.replace(/\./g, '-')}`;

        while (usedIds.has(id)) {
          id += '-x';
        }

        heading.id = id;
        usedIds.add(id);
      }

      if (list) {
        const li = document.createElement('li');
        const a = document.createElement('a');

        a.className =
          `toc-${heading.tagName.toLowerCase()}`;

        a.href = '#' + encodeURIComponent(heading.id);
        a.textContent = title;

        li.appendChild(a);
        list.appendChild(li);
      }
    }

    if (toc && list) {
      toc.hidden = !list.children.length;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();

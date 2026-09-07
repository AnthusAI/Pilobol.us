/* Light/dark toggle for Pilobol.us.
 *
 * Site chrome, loaded via SiteChrome.scripts in web/build_via_papyrus.py.
 * It creates its own button rather than expecting one in the markup, so
 * Papyrus's Markus page shell stays publication-agnostic — same pattern as
 * background-manager.js creating its own canvas.
 *
 * Storage key is "pilobol-theme". A one-time read of the past key
 * "pilobil-theme" (pre-rename leftover) keeps an existing reader preference.
 */
(() => {
  const KEY = 'pilobol-theme';
  // Past identifier leftover; read only if the current key is empty.
  const PAST_KEY = 'pilobil-theme';
  const root = document.documentElement;

  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
    if (stored !== 'light' && stored !== 'dark') {
      stored = localStorage.getItem(PAST_KEY);
      if (stored === 'light' || stored === 'dark') {
        localStorage.setItem(KEY, stored);
      }
    }
  } catch (e) {
    /* private mode / blocked storage: fall back to system preference */
  }
  if (stored === 'light' || stored === 'dark') {
    root.setAttribute('data-theme', stored);
  }

  const current = () => {
    const attr = root.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const mount = () => {
    const masthead = document.querySelector('.markus-site-masthead, .pilo-masthead');
    if (!masthead || document.querySelector('[data-pilo-theme-toggle]')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pilo-theme-toggle';
    btn.setAttribute('data-pilo-theme-toggle', '');

    const label = () => {
      const dark = current() === 'dark';
      btn.textContent = dark ? '☀ Light mode' : '☀︎● Dark mode';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    };

    btn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {
        /* preference simply will not persist */
      }
      label();
    });

    label();
    masthead.appendChild(btn);
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();

/* Light/dark toggle for Pilobol.us.
 *
 * Site chrome, loaded via SiteChrome.scripts in web/build_via_papyrus.py.
 * It creates its own button rather than expecting one in the markup, so
 * Papyrus's Markus page shell stays publication-agnostic — same pattern as
 * background-manager.js creating its own canvas.
 *
 * Storage key is "pilobil-theme" (not "pilobol-") to stay compatible with the
 * preference already persisted in readers' browsers by the previous build.
 *
 * ElevenLabs Audio Native has no auto dark mode — sync data-textcolor and
 * data-backgroundcolor on the widget when the theme changes.
 */
(() => {
  const KEY = 'pilobil-theme';
  const root = document.documentElement;

  const AUDIO_NATIVE_COLORS = {
    dark: {
      text: 'rgba(232, 226, 210, 1.0)',
      bg: 'rgba(28, 32, 28, 1.0)',
    },
    light: {
      text: 'rgba(28, 32, 28, 1.0)',
      bg: 'rgba(245, 241, 232, 1.0)',
    },
  };

  let stored = null;
  try {
    stored = localStorage.getItem(KEY);
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

  const syncAudioNativeColors = () => {
    const widget = document.getElementById('elevenlabs-audionative-widget');
    if (!widget) return;

    const colors = AUDIO_NATIVE_COLORS[current()] || AUDIO_NATIVE_COLORS.dark;
    widget.setAttribute('data-textcolor', colors.text);
    widget.setAttribute('data-backgroundcolor', colors.bg);

    const iframe = widget.querySelector('iframe');
    if (!iframe) return;

    iframe.remove();
    if (window.AudioNative && typeof window.AudioNative.init === 'function') {
      try {
        window.AudioNative.init();
      } catch (e) {
        /* best-effort re-init after theme swap */
      }
    }
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
      syncAudioNativeColors();
    });

    label();
    masthead.appendChild(btn);
  };

  const onReady = () => {
    mount();
    syncAudioNativeColors();
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();

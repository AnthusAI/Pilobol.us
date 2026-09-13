/* Headless ElevenLabs Audio Native theme sync for Pilobol.us.
 *
 * The site theme is driven by prefers-color-scheme (see pilobolus-theme.css).
 * Audio Native has no auto dark mode — set data-textcolor / data-backgroundcolor
 * on the widget to match --markus-paper / --markus-ink. No UI, no localStorage.
 */
(() => {
  const FALLBACK = {
    dark: {
      paper: 'rgba(20, 23, 15, 1.0)',
      ink: 'rgba(223, 222, 208, 1.0)',
    },
    light: {
      paper: 'rgba(241, 234, 217, 1.0)',
      ink: 'rgba(33, 29, 23, 1.0)',
    },
  };

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const current = () => (darkQuery.matches ? 'dark' : 'light');

  const cssColorToRgba = (value) => {
    if (!value || !String(value).trim()) return null;
    const v = String(value).trim();

    const rgbMatch = v.match(/^rgba?\(\s*([^)]+)\s*\)$/i);
    if (rgbMatch) {
      const parts = rgbMatch[1].split(',').map((s) => s.trim());
      const r = parseFloat(parts[0]);
      const g = parseFloat(parts[1]);
      const b = parseFloat(parts[2]);
      if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
      return `rgba(${r}, ${g}, ${b}, 1.0)`;
    }

    let hex = v.startsWith('#') ? v.slice(1) : null;
    if (hex) {
      if (hex.length === 3) {
        hex = hex
          .split('')
          .map((c) => c + c)
          .join('');
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
        return `rgba(${r}, ${g}, ${b}, 1.0)`;
      }
    }

    return null;
  };

  const readMarkusColors = () => {
    const styles = getComputedStyle(document.documentElement);
    const paper = cssColorToRgba(styles.getPropertyValue('--markus-paper'));
    const ink = cssColorToRgba(styles.getPropertyValue('--markus-ink'));
    if (paper && ink) {
      return { bg: paper, text: ink };
    }
    const fb = FALLBACK[current()];
    return { bg: fb.paper, text: fb.ink };
  };

  const syncAudioNativeColors = () => {
    const widget = document.getElementById('elevenlabs-audionative-widget');
    if (!widget) return;

    const colors = readMarkusColors();
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

  const onReady = () => syncAudioNativeColors();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  if (typeof darkQuery.addEventListener === 'function') {
    darkQuery.addEventListener('change', syncAudioNativeColors);
  } else if (typeof darkQuery.addListener === 'function') {
    darkQuery.addListener(syncAudioNativeColors);
  }
})();

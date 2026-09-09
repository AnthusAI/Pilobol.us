/* Headless ElevenLabs Audio Native theme sync for Pilobol.us.
 *
 * The site theme is driven by prefers-color-scheme (see pilobolus-theme.css).
 * Audio Native has no auto dark mode — set data-textcolor / data-backgroundcolor
 * on the widget to match. No UI, no localStorage, no masthead controls.
 */
(() => {
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

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const current = () => (darkQuery.matches ? 'dark' : 'light');

  const syncAudioNativeColors = () => {
    const widget = document.getElementById('elevenlabs-audionative-widget');
    if (!widget) return;

    const colors = AUDIO_NATIVE_COLORS[current()];
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

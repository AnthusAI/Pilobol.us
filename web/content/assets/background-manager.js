(() => {
  const effects = [
    {
      script: 'physarum-v17.js',
      creditTitle: 'Effect: Physarum Polycephalum',
      creditUrl: 'effects/physarum.html'
    },
    {
      script: 'reaction-diffusion-v1.js',
      creditTitle: 'Effect: Reaction-Diffusion',
      creditUrl: 'effects/reaction-diffusion.html'
    },
    {
      script: 'cellular-automata-v1.js',
      creditTitle: 'Effect: Continuous Cellular Automata',
      creditUrl: 'effects/cellular-automata.html'
    }
  ];
  
  // ?fx=<script-stem> forces a specific effect. Without it the effect is
  // random, which makes a broken one look intermittent and is miserable to
  // debug -- two of the three were silently failing and it read as flaky.
  let chosen = effects[Math.floor(Math.random() * effects.length)];
  try {
    const want = new URLSearchParams(window.location.search).get('fx');
    if (want) {
      const match = effects.find((e) => e.script.startsWith(want));
      if (match) chosen = match;
    }
  } catch (e) {
    /* no URLSearchParams: keep the random pick */
  }
  
  const isArticle = window.location.pathname.includes('/articles/') || window.location.pathname.includes('/effects/');
  const prefix = isArticle ? '../' : '';
  
  // Ensure the shared background canvas exists. All three effect scripts look
  // up #pilo-physarum-bg and no-op if it is missing. Creating it here rather
  // than in the page shell keeps Papyrus's Markus renderer
  // publication-agnostic: the effect owns its own element.
  const ensureCanvas = () => {
    let canvas = document.getElementById('pilo-physarum-bg');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'pilo-physarum-bg';
      canvas.className = 'pilo-physarum-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    return canvas;
  };

  // Inject the script only once the canvas is in the DOM, otherwise the effect
  // finds nothing and silently does nothing.
  const start = () => {
    ensureCanvas();
    const scriptTag = document.createElement('script');
    scriptTag.src = prefix + 'assets/' + chosen.script;
    document.head.appendChild(scriptTag);
  };
  
  // Inject the footer credit
  const addFooter = () => {
    const footer = document.querySelector('.markus-site-footer, .pilo-footer');
    if (footer) {
      const creditP = document.createElement('p');
      creditP.innerHTML = `Background Animation: <a href="${prefix}${chosen.creditUrl}">${chosen.creditTitle}</a>`;
      footer.appendChild(creditP);
    }
  };
  const boot = () => { start(); addFooter(); };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

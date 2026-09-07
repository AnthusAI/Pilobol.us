(() => {
  /*
   * Shared configuration contract for every living-background renderer.
   *
   * Effect scripts can read window.__piloFxConfig before creating their
   * simulation. `preset` is a stable, human-readable variation name;
   * `seedRegions` are normalised canvas coordinates, deliberately biased to
   * quiet page real-estate; and `motionScale` / `intensity` are safe scalar
   * knobs for a renderer to use without inventing its own page geometry.
   * The manager updates `theme` and dispatches `pilo:themechange` whenever
   * the operating-system appearance changes. This site intentionally has no
   * reader-controlled theme override.
   */
  const layouts = {
    'header-bloom': {
      label: 'Header bloom',
      intensity: 0.78,
      motionScale: 0.72,
      seedRegions: [
        { x: 0.84, y: 0.16, radius: 0.34, radiusY: 0.17, weight: 0.62, anchor: 'header' },
        { x: 0.96, y: 0.42, radius: 0.12, weight: 0.22 },
        { x: 0.08, y: 0.78, radius: 0.10, weight: 0.16 }
      ]
    },
    'margin-creep': {
      label: 'Margin creep',
      intensity: 0.68,
      motionScale: 0.60,
      seedRegions: [
        { x: 0.84, y: 0.16, radius: 0.32, radiusY: 0.17, weight: 0.34, anchor: 'header' },
        { x: 0.06, y: 0.30, radius: 0.14, weight: 0.20 },
        { x: 0.94, y: 0.50, radius: 0.16, weight: 0.26 },
        { x: 0.11, y: 0.84, radius: 0.10, weight: 0.09 },
        { x: 0.89, y: 0.90, radius: 0.12, weight: 0.11 }
      ]
    },
    'footer-rise': {
      label: 'Footer rise',
      intensity: 0.64,
      motionScale: 0.48,
      seedRegions: [
        { x: 0.84, y: 0.16, radius: 0.30, radiusY: 0.16, weight: 0.20, anchor: 'header' },
        { x: 0.06, y: 0.52, radius: 0.11, weight: 0.10 },
        { x: 0.94, y: 0.66, radius: 0.12, weight: 0.10 },
        { x: 0.17, y: 0.96, radius: 0.18, weight: 0.18 },
        { x: 0.55, y: 0.98, radius: 0.23, weight: 0.28 },
        { x: 0.88, y: 0.92, radius: 0.15, weight: 0.14 }
      ]
    },
    'quiet-spores': {
      label: 'Quiet spores',
      intensity: 0.48,
      motionScale: 0.38,
      seedRegions: [
        { x: 0.86, y: 0.17, radius: 0.28, radiusY: 0.15, weight: 0.44, anchor: 'header' },
        { x: 0.07, y: 0.67, radius: 0.10, weight: 0.20 },
        { x: 0.92, y: 0.86, radius: 0.13, weight: 0.36 }
      ]
    }
  };

  const effects = [
    {
      script: 'physarum-v17.js',
      configKey: 'physarum',
      variants: ['creeping_veins', 'spore_burst', 'mycelium_threads', 'crystallizing'],
      creditTitle: 'Physarum Polycephalum',
      creditUrl: 'effects/physarum.html'
    },
    {
      script: 'reaction-diffusion-v1.js',
      configKey: 'reaction-diffusion',
      variants: ['coral', 'mitosis', 'maze'],
      creditTitle: 'Reaction-Diffusion',
      creditUrl: 'effects/reaction-diffusion.html'
    },
    {
      script: 'cellular-automata-v1.js',
      configKey: 'cellular-automata',
      variants: ['colonies', 'crystal', 'embers'],
      creditTitle: 'Continuous Cellular Automata',
      creditUrl: 'effects/cellular-automata.html'
    },
    {
      script: 'dla-v1.js',
      configKey: 'dla',
      variants: ['frost', 'coral', 'rootlets'],
      creditTitle: 'Diffusion-Limited Aggregation',
      creditUrl: 'effects/dla.html'
    },
    {
      script: 'spore-drift-v1.js',
      configKey: 'spore-drift',
      variants: ['still-air', 'crosswind', 'updraft'],
      creditTitle: 'Spore Drift',
      creditUrl: 'effects/spore-drift.html'
    },
    {
      script: 'lichen-v1.js',
      configKey: 'lichen',
      variants: ['dusting', 'islands', 'old-wall'],
      creditTitle: 'Crustose Lichen',
      creditUrl: 'effects/lichen.html'
    }
  ];
  
  // ?fx=<script-stem> forces a specific effect. Without it the effect is
  // random, which makes a broken one look intermittent and is miserable to
  // debug -- two of the three were silently failing and it read as flaky.
  let chosen = effects[Math.floor(Math.random() * effects.length)];
  let chosenLayout = Object.keys(layouts)[Math.floor(Math.random() * Object.keys(layouts).length)];
  let chosenVariant = '';
  try {
    const params = new URLSearchParams(window.location.search);
    const want = params.get('fx');
    if (want) {
      const match = effects.find((e) => e.script.startsWith(want));
      if (match) chosen = match;
    }
    // Both spellings are supported so a preview URL is easy to type.
    const wantedLayout = params.get('fxPreset') || params.get('fx-preset');
    if (wantedLayout && layouts[wantedLayout]) chosenLayout = wantedLayout;
    const wantedVariant = params.get('fxVariant');
    if (wantedVariant) {
      if (chosen.variants.includes(wantedVariant)) {
        chosenVariant = wantedVariant;
      } else if (!want) {
        // A variant-only URL is still reproducible: infer the effect that
        // owns that variant. With no variant at all, effect selection remains
        // fully random as before.
        const variantOwner = effects.find((effect) => effect.variants.includes(wantedVariant));
        if (variantOwner) {
          chosen = variantOwner;
          chosenVariant = wantedVariant;
        }
      }
    }
  } catch (e) {
    /* no URLSearchParams: keep the random pick */
  }
  
  const isArticle = window.location.pathname.includes('/articles/') || window.location.pathname.includes('/effects/');
  const prefix = isArticle ? '../' : '';
  
  // Ensure the shared background canvas exists. Every effect script looks
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

  // The organism belongs to the sheet, not the viewport. Keep the decorative
  // canvas exactly as tall as the rendered document and notify the active
  // simulation whenever late-loading media changes that height.
  const watchCanvasExtent = (canvas) => {
    let lastHeight = 0;
    let queued = false;
    const sync = () => {
      queued = false;
      const height = Math.ceil(Math.max(
        window.innerHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ));
      if (Math.abs(height - lastHeight) < 2) return;
      lastHeight = height;
      canvas.style.height = `${height}px`;
      document.dispatchEvent(new CustomEvent('pilo:canvasresize', { detail: { height } }));
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    };
    sync();
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('load', schedule, { once: true });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(schedule);
      canvas.__piloResizeObserver = observer;
      const main = document.querySelector('.markus-site > main');
      const footer = document.querySelector('.markus-site-footer, .pilo-footer');
      if (main) observer.observe(main);
      if (footer) observer.observe(footer);
    }
  };

  const appearance = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  const theme = () => appearance && appearance.matches ? 'dark' : 'light';

  /*
   * A deliberately tiny event-to-field bridge. Interaction never commands a
   * branch or particle directly: it leaves bounded, short-lived deposits for
   * whichever simulation is active to interpret on its next update pass.
   * Nothing is persisted or transmitted.
   */
  const createNutrientField = () => {
    const queue = [];
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const habitatPoint = (clientX, clientY) => {
      const width = Math.max(1, window.innerWidth);
      const canvas = document.getElementById('pilo-physarum-bg');
      const height = Math.max(1, canvas ? canvas.clientHeight : document.documentElement.scrollHeight);
      let x = clamp(Number(clientX) || width * 0.5, 0, width);
      const viewportY = clamp(Number(clientY) || window.innerHeight * 0.5, 0, window.innerHeight);
      const readingSurface = document.querySelector('.markus-site > main .markus-document, .markus-site > main');
      if (readingSurface) {
        const rect = readingSurface.getBoundingClientRect();
        if (viewportY >= rect.top && viewportY <= rect.bottom && x >= rect.left && x <= rect.right) {
          const safeGap = clamp(width * 0.045, 10, 36);
          x = x < rect.left + rect.width * 0.5
            ? Math.max(width * 0.035, rect.left - safeGap)
            : Math.min(width * 0.965, rect.right + safeGap);
        }
      }
      return { x: x / width, y: clamp((window.scrollY + viewportY) / height, 0, 1) };
    };

    const deposit = (point, strength, radius, kind) => {
      if (!point) return;
      const item = {
        x: clamp(Number(point.x) || 0, 0, 1),
        y: clamp(Number(point.y) || 0, 0, 1),
        strength: clamp(Number(strength) || 0, -1, 1),
        radius: clamp(Number(radius) || 0.035, 0.012, 0.12),
        kind: kind || 'attention',
        time: performance.now()
      };
      const previous = queue[queue.length - 1];
      if (previous && previous.kind === item.kind && Math.hypot(previous.x - item.x, previous.y - item.y) < 0.035) {
        previous.strength = clamp(previous.strength + item.strength * 0.55, -1, 1);
        previous.radius = Math.max(previous.radius, item.radius);
        previous.time = item.time;
      } else {
        queue.push(item);
        if (queue.length > 64) queue.splice(0, queue.length - 64);
      }
    };

    const drain = (limit = 10) => {
      const now = performance.now();
      return queue.splice(0, clamp(limit, 1, 16)).map((item) => ({
        ...item,
        strength: item.strength * Math.exp(-(now - item.time) / 6000)
      })).filter((item) => Math.abs(item.strength) > 0.025);
    };

    // Effects call paint() before their normal feedback pass. A positive
    // deposit creates a soft future growth knot; negative stress clears one.
    const paint = (gl, texture, width, height, mode = 'density') => {
      const deposits = drain(10);
      if (!deposits.length || !texture || !width || !height) return 0;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      for (const item of deposits) {
        const radius = Math.min(48, Math.max(2, Math.round(item.radius * Math.min(width, height))));
        const cx = Math.round(item.x * width);
        const cy = Math.round((1 - item.y) * height);
        const x0 = clamp(cx - radius, 0, width - 1);
        const y0 = clamp(cy - radius, 0, height - 1);
        const patchWidth = Math.max(1, Math.min(radius * 2 + 1, width - x0));
        const patchHeight = Math.max(1, Math.min(radius * 2 + 1, height - y0));
        const channels = mode === 'trail' ? 1 : 4;
        const data = new Float32Array(patchWidth * patchHeight * channels);
        for (let py = 0; py < patchHeight; py++) {
          for (let px = 0; px < patchWidth; px++) {
            const distance = Math.hypot(x0 + px - cx, y0 + py - cy) / radius;
            const feather = Math.max(0, 1 - distance);
            const value = item.strength > 0 ? clamp(item.strength * feather * feather, 0, 1) : 0;
            const offset = (py * patchWidth + px) * channels;
            if (mode === 'reaction') {
              data[offset] = 1 - value * 0.72;
              data[offset + 1] = value;
              data[offset + 3] = 1;
            } else if (mode === 'density') {
              data[offset] = value;
              data[offset + 3] = 1;
            } else {
              data[offset] = value;
            }
          }
        }
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          x0,
          y0,
          patchWidth,
          patchHeight,
          mode === 'trail' ? gl.RED : gl.RGBA,
          gl.FLOAT,
          data
        );
      }
      return deposits.length;
    };

    let dwellTimer = 0;
    let lastPointer = null;
    let lastStress = 0;
    const onPointerMove = (event) => {
      if (event.pointerType === 'touch') return;
      const now = performance.now();
      if (lastPointer) {
        const elapsed = Math.max(1, now - lastPointer.time);
        const speed = Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) / elapsed;
        if (speed > 1.6 && now - lastStress > 850) {
          deposit(habitatPoint(event.clientX, event.clientY), -0.22, 0.026, 'pointer-stress');
          lastStress = now;
        }
      }
      lastPointer = { x: event.clientX, y: event.clientY, time: now };
      window.clearTimeout(dwellTimer);
      dwellTimer = window.setTimeout(() => {
        if (document.visibilityState === 'visible' && lastPointer) {
          deposit(habitatPoint(lastPointer.x, lastPointer.y), 0.24, 0.034, 'dwell');
        }
      }, 720);
    };

    const onPointerDown = (event) => {
      deposit(habitatPoint(event.clientX, event.clientY), 0.88, event.pointerType === 'touch' ? 0.07 : 0.052, 'inoculation');
    };

    let selectionTimer = 0;
    const onSelection = () => {
      window.clearTimeout(selectionTimer);
      selectionTimer = window.setTimeout(() => {
        const selection = window.getSelection && window.getSelection();
        if (!selection || selection.isCollapsed || !selection.rangeCount) return;
        const rect = selection.getRangeAt(0).getBoundingClientRect();
        if (rect.width || rect.height) deposit(habitatPoint(rect.left + rect.width / 2, rect.top + rect.height / 2), 0.54, 0.045, 'selection');
      }, 180);
    };

    const hoveredLinks = new WeakSet();
    const onPointerOver = (event) => {
      const link = event.target && event.target.closest && event.target.closest('a');
      if (!link || hoveredLinks.has(link)) return;
      hoveredLinks.add(link);
      const rect = link.getBoundingClientRect();
      deposit(habitatPoint(rect.left + rect.width / 2, rect.top + rect.height / 2), 0.22, 0.03, 'new-terrain');
    };

    let lastScrollY = window.scrollY;
    let scrollQueued = false;
    let scrollSide = false;
    const onScroll = () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        const delta = window.scrollY - lastScrollY;
        lastScrollY = window.scrollY;
        scrollQueued = false;
        if (Math.abs(delta) < 8) return;
        scrollSide = !scrollSide;
        const stress = Math.abs(delta) > window.innerHeight * 0.72;
        const canvas = document.getElementById('pilo-physarum-bg');
        const pageHeight = Math.max(1, canvas ? canvas.clientHeight : document.documentElement.scrollHeight);
        const pageY = clamp((window.scrollY + window.innerHeight * (delta > 0 ? 0.74 : 0.28)) / pageHeight, 0, 1);
        deposit(
          { x: scrollSide ? 0.055 : 0.945, y: pageY },
          stress ? -0.30 : Math.min(0.34, 0.10 + Math.abs(delta) / Math.max(1, window.innerHeight) * 0.38),
          stress ? 0.035 : 0.028,
          stress ? 'scroll-stress' : 'moisture'
        );
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerover', onPointerOver, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('selectionchange', onSelection);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') window.clearTimeout(dwellTimer);
    });

    return Object.freeze({ deposit, drain, paint, habitatPoint });
  };

  const configure = (canvas) => {
    const layout = layouts[chosenLayout];
    const pageHeight = Math.max(1, canvas.clientHeight, document.documentElement.scrollHeight);
    const headerScale = window.innerHeight / pageHeight;
    const verticalRadiusScale = Math.min(window.innerWidth, window.innerHeight) / pageHeight;
    const config = {
      effect: chosen.script.replace(/\.js$/, ''),
      preset: chosenLayout,
      presetLabel: layout.label,
      // Placement preset remains at the root. Algorithm variants are scoped
      // by config key so a layout named "coral" can never accidentally select
      // a Reaction-Diffusion simulation preset.
      effects: chosenVariant ? { [chosen.configKey]: { preset: chosenVariant } } : {},
      variant: chosenVariant || null,
      variants: chosen.variants.slice(),
      intensity: layout.intensity,
      motionScale: layout.motionScale,
      seedRegions: layout.seedRegions.map((region) => ({
        x: region.x,
        // Header coordinates are fractions of the first viewport; all other
        // y values are fractions of the full sheet. This keeps the top-right
        // inoculation beside the masthead even on very long articles.
        y: region.anchor === 'header' ? region.y * headerScale : region.y,
        radius: region.radius,
        radiusX: region.radius,
        // Avoid stretching a compact seed zone into hundreds of vertical
        // pixels merely because the canvas now scrolls with the document.
        radiusY: Math.max(0.002, (region.radiusY ?? region.radius) * verticalRadiusScale),
        weight: region.weight
      })),
      theme: theme()
    };
    window.__piloFxConfig = Object.freeze(config);
    document.body.dataset.piloFxLayout = chosenLayout;
    document.body.dataset.piloFxEffect = config.effect;
    canvas.dataset.piloFxLayout = chosenLayout;
    canvas.style.setProperty('--pilo-fx-intensity', String(layout.intensity));
    return config;
  };

  // Inject the script only once the canvas is in the DOM, otherwise the effect
  // finds nothing and silently does nothing.
  const start = () => {
    const canvas = ensureCanvas();
    watchCanvasExtent(canvas);
    configure(canvas);
    const saveData = Boolean(navigator.connection && navigator.connection.saveData);
    // Motion is decorative. Reduced-motion and data-saver readers get a
    // static fungal plate instead of a slowed but still continuous renderer.
    if ((reducedMotion && reducedMotion.matches) || saveData) {
      canvas.dataset.piloFxMode = 'static';
      document.body.dataset.piloFxMode = 'static';
      return;
    }
    window.__piloNutrients = createNutrientField();
    const scriptTag = document.createElement('script');
    // window.__markusAssetVersion is set by the page shell from the same
    // content hash the CSS links use. Without it, this dynamically-injected
    // script tag has no cache-busting at all (unlike every other script on
    // the page, which the shell itself versions) -- a browser can keep
    // serving a stale cached copy of whichever effect was picked, silently,
    // indefinitely, surviving ordinary reloads.
    const version = window.__markusAssetVersion;
    scriptTag.src = prefix + 'assets/' + chosen.script + (version ? ('?v=' + version) : '');
    const useStaticFallback = () => {
      if (canvas.dataset.piloFxReady !== 'true') {
        canvas.dataset.piloFxMode = 'static';
        document.body.dataset.piloFxMode = 'static';
      }
    };
    scriptTag.addEventListener('error', useStaticFallback);
    scriptTag.addEventListener('load', () => window.setTimeout(useStaticFallback, 900));
    document.head.appendChild(scriptTag);
  };
  
  // Inject the footer credit
  const addFooter = () => {
    const footer = document.querySelector('.markus-site-footer, .pilo-footer');
    if (footer) {
      const creditP = document.createElement('p');
      creditP.innerHTML = `Background: <a href="${prefix}${chosen.creditUrl}">${chosen.creditTitle}</a>`;
      footer.appendChild(creditP);
    }
  };
  const boot = () => {
    start();
    addFooter();
    if (appearance) {
      const syncAppearance = () => {
        if (window.__piloFxConfig) {
          window.__piloFxConfig = Object.freeze({ ...window.__piloFxConfig, theme: theme() });
          document.dispatchEvent(new CustomEvent('pilo:themechange', { detail: window.__piloFxConfig }));
        }
      };
      if (appearance.addEventListener) appearance.addEventListener('change', syncAppearance);
      else if (appearance.addListener) appearance.addListener(syncAppearance);
    }
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

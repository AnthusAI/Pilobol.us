/*
 * Dependency-free scroll-driven image treatments shared by the image lab and
 * production pages.
 *
 * Every treatment is scroll-driven and keeps its source <img> in the DOM as
 * a no-JavaScript/accessibility fallback. The lab uses the same classes that
 * the renderer emits for image_effect front matter.
 */
(() => {
  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const smoothstep = (value) => value * value * (3 - 2 * value);

  function scrollProgress(element) {
    if (reduceMotion) return 1;
    const rect = element.getBoundingClientRect();
    const distance = Math.abs(
      rect.top + rect.height / 2 - window.innerHeight / 2
    );
    // A broad clean plateau keeps the image readable while the reader pauses.
    const plateau = window.innerHeight * 0.30;
    const edge = window.innerHeight * 0.95;
    const reveal = distance <= plateau
      ? 1
      : 1 - (distance - plateau) / (edge - plateau);
    return smoothstep(Math.max(0, Math.min(1, reveal)));
  }

  class MaskReveal {
    constructor(element) {
      this.element = element;
      this.image = element.querySelector('img');
    }

    update(progress) {
      this.element.style.setProperty('--mask-progress', progress.toFixed(3));
      this.element.style.setProperty(
        '--mask-right', `${((1 - progress) * 100).toFixed(2)}%`
      );
      this.element.style.setProperty(
        '--mask-grain', (1 - progress).toFixed(3)
      );
    }
  }

  class PixelDissolve {
    constructor(element) {
      this.element = element;
      this.image = element.querySelector('img');
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'pilo-pixel-dissolve-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      element.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.low = document.createElement('canvas');
      this.lowCtx = this.low.getContext('2d');
      this.ready = false;
      this.resize();
      const onLoad = () => {
        this.ready = Boolean(this.ctx && this.lowCtx && this.image.naturalWidth);
        if (this.ready) {
          this.element.style.aspectRatio = `${this.image.naturalWidth} / ${this.image.naturalHeight}`;
          this.image.hidden = true;
          this.update(this.progress ?? scrollProgress(this.element));
        }
      };
      if (this.image.complete) onLoad();
      else this.image.addEventListener('load', onLoad, { once: true });
    }

    resize() {
      const rect = this.element.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      if (this.ready) this.draw(this.progress || 1);
    }

    update(progress) {
      this.progress = progress;
      this.element.style.setProperty('--pixel-progress', progress.toFixed(3));
      if (this.ready) this.draw(progress);
    }

    draw(progress) {
      const width = this.canvas.width;
      const height = this.canvas.height;
      const pixelSize = Math.max(1, Math.round(2 + (1 - progress) * 30));
      const lowWidth = Math.max(1, Math.ceil(width / pixelSize));
      const lowHeight = Math.max(1, Math.ceil(height / pixelSize));
      this.low.width = lowWidth;
      this.low.height = lowHeight;
      this.lowCtx.imageSmoothingEnabled = true;
      this.lowCtx.clearRect(0, 0, lowWidth, lowHeight);
      this.lowCtx.drawImage(this.image, 0, 0, lowWidth, lowHeight);

      this.ctx.clearRect(0, 0, width, height);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.low, 0, 0, width, height);

      // The final part is a real crossfade, so it never snaps from pixels to
      // perfect. A faint grid remains near the edge as a visual tell.
      if (progress > 0.68) {
        this.ctx.globalAlpha = smoothstep((progress - 0.68) / 0.32);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.drawImage(this.image, 0, 0, width, height);
        this.ctx.globalAlpha = 1;
      }
    }
  }

  class Lenticular {
    constructor(element) {
      this.element = element;
      this.image = element.querySelector('img');
      if (!this.image) return;
      this.ghostA = this.clone('pilo-lenticular-ghost pilo-lenticular-ghost-a');
      this.ghostB = this.clone('pilo-lenticular-ghost pilo-lenticular-ghost-b');
      element.append(this.ghostA, this.ghostB);
    }

    clone(className) {
      const clone = this.image.cloneNode(true);
      clone.className = className;
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('alt');
      return clone;
    }

    update(progress) {
      const drift = (1 - progress) * 18;
      this.element.style.setProperty('--lenticular-progress', progress.toFixed(3));
      this.element.style.setProperty('--lenticular-drift', drift.toFixed(2));
      this.element.style.setProperty('--lenticular-opacity', (1 - progress).toFixed(3));
    }
  }

  const treatments = [
    ...Array.from(document.querySelectorAll('.pilo-mask-reveal')).map(el => new MaskReveal(el)),
    ...Array.from(document.querySelectorAll('.pilo-pixel-dissolve')).map(el => new PixelDissolve(el)),
    ...Array.from(document.querySelectorAll('.pilo-lenticular')).map(el => new Lenticular(el)),
  ];
  const elements = treatments.map(treatment => treatment.element);
  let frame = 0;

  function updateAll() {
    frame = 0;
    treatments.forEach((treatment, index) => {
      treatment.update(scrollProgress(elements[index]));
    });
  }

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(updateAll);
  }

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  schedule();
})();

/** Landing RK — motion minimal, respeta prefers-reduced-motion */
export function initLandingMotion() {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  requestAnimationFrame(() => root.classList.add('landing-ready'));

  document.querySelectorAll('[data-reveal]').forEach((el, i) => {
    el.style.setProperty('--reveal-i', String(i));
  });

  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
  }

  if (reduced) return;

  const art = document.querySelector('[data-parallax]');
  if (art && window.matchMedia('(min-width: 768px)').matches) {
    let raf = 0;
    window.addEventListener(
      'mousemove',
      (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth - 0.5) * 10;
          const y = (e.clientY / window.innerHeight - 0.5) * 6;
          art.style.setProperty('--px', `${x}px`);
          art.style.setProperty('--py', `${y}px`);
          raf = 0;
        });
      },
      { passive: true },
    );
  }

  document.querySelectorAll('[data-tile]').forEach((tile) => {
    tile.addEventListener('pointermove', (e) => {
      const rect = tile.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      tile.style.setProperty('--mx', `${x}%`);
      tile.style.setProperty('--my', `${y}%`);
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLandingMotion);
  } else {
    initLandingMotion();
  }
}

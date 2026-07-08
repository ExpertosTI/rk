/** Landing RK — scroll reveal, contadores y micro-interacciones */

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function animateCount(el) {
  if (el.classList.contains('is-counted')) return;
  el.classList.add('is-counted');

  const target = Number(el.dataset.count);
  if (!Number.isFinite(target)) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    el.textContent = String(target);
    return;
  }

  const duration = 1400;
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    el.textContent = String(Math.round(target * easeOutCubic(progress)));
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

function revealStagger(container) {
  container.querySelectorAll('[data-reveal-item]').forEach((item, i) => {
    item.style.setProperty('--item-i', String(i));
    requestAnimationFrame(() => item.classList.add('is-visible'));
  });
  container.querySelectorAll('[data-count]').forEach(animateCount);
}

export function initLandingMotion() {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  requestAnimationFrame(() => root.classList.add('landing-ready'));

  document.querySelectorAll('[data-reveal]').forEach((el, i) => {
    el.style.setProperty('--reveal-i', String(i));
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add('is-visible');
          revealStagger(el);
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
    );

    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

    if (!reduced) {
      document.querySelectorAll('[data-count]').forEach((el) => {
        const counterIo = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                animateCount(entry.target);
                counterIo.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.5 },
        );
        counterIo.observe(el);
      });
    }
  } else {
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      el.classList.add('is-visible');
      revealStagger(el);
    });
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = el.dataset.count || '0';
    });
  }

  if (reduced) {
    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = el.dataset.count || '0';
    });
    return;
  }

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

  const photoHero = document.querySelector('[data-landing-hero]');
  if (photoHero) {
    const onScroll = () => {
      const rect = photoHero.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / (rect.height * 0.8)));
      photoHero.style.setProperty('--scroll-p', String(p));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLandingMotion);
  } else {
    initLandingMotion();
  }
}

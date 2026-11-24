// Scroll position bar (styles: .scroll-thumb in css/theme.css). Mirrors the
// inline script in the main site's layout (src/layouts/base.ejs).
(() => {
  const root = document.documentElement;
  const thumb = document.createElement('div');
  thumb.className = 'scroll-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  document.body.appendChild(thumb);
  root.classList.add('has-scroll-thumb');

  let hideTimer;
  const update = () => {
    const view = window.innerHeight;
    const total = root.scrollHeight;
    if (total <= view + 1) return thumb.classList.remove('is-visible');
    const height = Math.max(32, (view * view) / total);
    const travel = (window.scrollY / (total - view)) * (view - height);
    thumb.style.height = `${height}px`;
    thumb.style.transform = `translateY(${travel}px)`;
    thumb.classList.add('is-visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => thumb.classList.remove('is-visible'), 900);
  };
  window.addEventListener('scroll', update, { passive: true });
})();

// Home page. Shared helpers (cart, wishlist, cards, drawer) live in common.js.
(() => {
  const { PRODUCTS, ready, $, $$, renderCards, bindCards, observeReveal } = window.TL;

  /* ---------- Products ---------- */
  const grid = $('#products');
  function renderProducts(query = '') {
    const q = query.trim().toLowerCase();
    const list = PRODUCTS.filter(p => !q || (p.name + ' ' + p.spec).toLowerCase().includes(q));
    renderCards(grid, list);
    $('#productsEmpty').hidden = list.length > 0;
  }
  bindCards(grid);

  /* ---------- Search ---------- */
  const searchInput = $('#searchInput');
  searchInput.addEventListener('input', () => renderProducts(searchInput.value));
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    $('#featured').scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- Hero slider ---------- */
  const slides = $$('.hero__slide');
  const dots = $$('.hero__dots .dot');
  let current = 0, timer;
  function go(i) {
    current = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === current));
    dots.forEach((d, k) => d.classList.toggle('is-active', k === current));
    restart();
  }
  function restart() { clearInterval(timer); timer = setInterval(() => go(current + 1), 6000); }
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  $('.hero__next').addEventListener('click', () => go(current + 1));
  restart();

  /* ---------- Promo banners ---------- */
  // Images come from the admin panel (or the default files); a card shows its banner
  // only once the image loads, and keeps the icon look if it fails.
  window.TLApi.getBanners()
    .catch(() => window.TLApi.DEFAULT_BANNERS)
    .then(banners => $$('.promo__banner').forEach(img => {
      const show = () => img.closest('.promo').classList.add('has-banner');
      img.addEventListener('load', show, { once: true });
      img.addEventListener('error', () => img.remove(), { once: true });
      img.src = banners[img.dataset.slot];
    }));

  /* ---------- Reveal on scroll ---------- */
  $$('.promo, .why__list li, .section-head').forEach(el => el.classList.add('reveal'));
  observeReveal($$('.reveal'));

  /* ---------- Active nav link on scroll ---------- */
  const sections = ['top', 'brands', 'featured', 'why', 'contact'].map(id => document.getElementById(id));
  const navLinks = $$('.nav__link');
  const tabLinks = $$('.tabbar a');
  function syncNav() {
    const y = window.scrollY + window.innerHeight * 0.35;
    let active = 'top';
    sections.forEach(s => { if (s && s.offsetTop <= y) active = s.id; });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) active = 'contact';
    navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + active));
    tabLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + active && !a.classList.contains('tabbar__cart')));
  }
  window.addEventListener('scroll', syncNav, { passive: true });

  // Searches started on other pages arrive as index.html?q=...
  ready.then(() => {
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
      searchInput.value = q;
      renderProducts(q);
      requestAnimationFrame(() => $('#featured').scrollIntoView());
    } else {
      renderProducts(searchInput.value);
    }
  });
  syncNav();
})();

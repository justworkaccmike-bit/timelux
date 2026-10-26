(() => {
  const PRODUCTS = [
    { id: 'tissot-prx', name: 'Tissot PRX', spec: 'Quartz 40mm', price: 4500000 },
    { id: 'citizen-tsuyosa', name: 'Citizen Tsuyosa', spec: 'Automatic 40mm', price: 4500000 },
    { id: 'seiko-5', name: 'Seiko 5', spec: 'Automatic 42.5mm', price: 3800000 },
    { id: 'casio-edifice', name: 'Casio Edifice', spec: 'Chronograph 44mm', price: 2200000 },
  ];

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const formatUZS = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' UZS';

  // Storage can be unavailable (private mode, blocked site data) — fail soft.
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };

  let cart = store.get('tl-cart', {});
  let wish = new Set(store.get('tl-wish', []));

  /* ---------- Toast ---------- */
  const toast = $('#toast');
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), 2200);
  }

  /* ---------- Badges ---------- */
  function renderCounts(bump) {
    const count = Object.values(cart).reduce((a, b) => a + b, 0);
    $$('[data-cart-count]').forEach(b => {
      b.textContent = count;
      b.hidden = count === 0;
      if (bump) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    });
    const w = $('[data-wish-count]');
    w.textContent = wish.size;
    w.hidden = wish.size === 0;
  }

  /* ---------- Products ---------- */
  const grid = $('#products');
  function renderProducts(query = '') {
    const q = query.trim().toLowerCase();
    const list = PRODUCTS.filter(p => !q || (p.name + ' ' + p.spec).toLowerCase().includes(q));
    grid.innerHTML = list.map(p => `
      <article class="card reveal" data-id="${p.id}">
        <button class="card__fav ${wish.has(p.id) ? 'is-on' : ''}" aria-label="Add ${p.name} to wishlist" aria-pressed="${wish.has(p.id)}">
          <svg class="ico"><use href="#i-heart"/></svg>
        </button>
        <div class="card__img" aria-hidden="true"><svg><use href="#i-watch"/></svg></div>
        <h3 class="card__name">${p.name}</h3>
        <p class="card__spec">${p.spec}</p>
        <p class="card__price">${formatUZS(p.price)}</p>
        <button class="btn btn--gold card__add"><svg class="ico ico--sm"><use href="#i-cart"/></svg> Add to Cart</button>
      </article>`).join('');
    $('#productsEmpty').hidden = list.length > 0;
    observeReveal($$('.reveal', grid));
  }

  grid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card) return;
    const p = PRODUCTS.find(x => x.id === card.dataset.id);

    const fav = e.target.closest('.card__fav');
    if (fav) {
      wish.has(p.id) ? wish.delete(p.id) : wish.add(p.id);
      const on = wish.has(p.id);
      fav.classList.toggle('is-on', on);
      fav.setAttribute('aria-pressed', on);
      store.set('tl-wish', [...wish]);
      renderCounts();
      showToast(on ? `${p.name} added to wishlist` : `${p.name} removed from wishlist`);
      return;
    }

    const add = e.target.closest('.card__add');
    if (add) {
      cart[p.id] = (cart[p.id] || 0) + 1;
      store.set('tl-cart', cart);
      renderCounts(true);
      showToast(`${p.name} added to cart`);
      add.classList.add('is-added');
      setTimeout(() => add.classList.remove('is-added'), 600);
    }
  });

  /* ---------- Search ---------- */
  const searchInput = $('#searchInput');
  searchInput.addEventListener('input', () => renderProducts(searchInput.value));
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    $('#featured').scrollIntoView({ behavior: 'smooth' });
  });
  $('#searchToggle').addEventListener('click', () => {
    const header = $('.header');
    header.classList.toggle('search-open');
    if (header.classList.contains('search-open')) searchInput.focus();
  });

  /* ---------- Drawer ---------- */
  const drawer = $('#drawer');
  const setDrawer = open => {
    drawer.classList.toggle('is-open', open);
    drawer.setAttribute('aria-hidden', !open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  $('#menuOpen').addEventListener('click', () => setDrawer(true));
  $('#menuClose').addEventListener('click', () => setDrawer(false));
  drawer.addEventListener('click', e => { if (e.target === drawer || e.target.closest('a')) setDrawer(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });

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

  /* ---------- Reveal on scroll ---------- */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      }), { threshold: 0.12 })
    : null;
  function observeReveal(els) {
    els.forEach(el => io ? io.observe(el) : el.classList.add('is-in'));
  }
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

  renderProducts();
  renderCounts();
  syncNav();
})();

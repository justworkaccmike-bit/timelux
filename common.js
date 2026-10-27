// Shared by every page: cart, wishlist, toast, drawer, product cards, reveal-on-scroll.
(() => {
  // Filled once the catalogue loads (Supabase, or demo data); pages wait on TL.ready.
  const PRODUCTS = [];
  const ready = window.TLApi.listProducts()
    .catch(() => window.TL_PRODUCTS || [])
    .then(list => { PRODUCTS.push(...list); });

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const formatUZS = n => !n ? 'Price on request' : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' UZS';
  const productUrl = p => `product.html?id=${encodeURIComponent(p.id)}`;
  const watchIcon = '<svg aria-hidden="true"><use href="#i-watch"/></svg>';
  const productMedia = p => p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : watchIcon;

  // Storage can be unavailable (private mode, blocked site data) — fail soft.
  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };

  const cart = store.get('tl-cart', {});
  const wish = new Set(store.get('tl-wish', []));

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

  function addToCart(p, qty = 1) {
    cart[p.id] = (cart[p.id] || 0) + qty;
    store.set('tl-cart', cart);
    renderCounts(true);
    showToast(qty > 1 ? `${qty} × ${p.name} added to cart` : `${p.name} added to cart`);
  }

  function toggleWish(p) {
    wish.has(p.id) ? wish.delete(p.id) : wish.add(p.id);
    const on = wish.has(p.id);
    store.set('tl-wish', [...wish]);
    renderCounts();
    showToast(on ? `${p.name} added to wishlist` : `${p.name} removed from wishlist`);
    return on;
  }

  /* ---------- Product cards ---------- */
  const cardHTML = p => `
    <article class="card reveal" data-id="${esc(p.id)}">
      <button class="card__fav ${wish.has(p.id) ? 'is-on' : ''}" aria-label="Add ${esc(p.name)} to wishlist" aria-pressed="${wish.has(p.id)}">
        <svg class="ico"><use href="#i-heart"/></svg>
      </button>
      <a href="${productUrl(p)}" class="card__img ${p.image ? 'has-photo' : ''}" aria-label="View ${esc(p.name)}">${productMedia(p)}</a>
      <h3 class="card__name"><a href="${productUrl(p)}">${esc(p.name)}</a></h3>
      <p class="card__spec">${esc(p.spec)}</p>
      <p class="card__price">${formatUZS(p.price)}</p>
      <button class="btn btn--gold card__add"><svg class="ico ico--sm"><use href="#i-cart"/></svg> Add to Cart</button>
    </article>`;

  function renderCards(grid, list) {
    grid.innerHTML = list.map(cardHTML).join('');
    observeReveal($$('.reveal', grid));
  }

  // One delegated handler per grid: wishlist heart + add to cart.
  function bindCards(grid) {
    grid.addEventListener('click', e => {
      const card = e.target.closest('.card');
      if (!card) return;
      const p = PRODUCTS.find(x => x.id === card.dataset.id);

      const fav = e.target.closest('.card__fav');
      if (fav) {
        const on = toggleWish(p);
        fav.classList.toggle('is-on', on);
        fav.setAttribute('aria-pressed', on);
        return;
      }

      const add = e.target.closest('.card__add');
      if (add) {
        addToCart(p);
        add.classList.add('is-added');
        setTimeout(() => add.classList.remove('is-added'), 600);
      }
    });
  }

  /* ---------- Search toggle (mobile) ---------- */
  $('#searchToggle').addEventListener('click', () => {
    const header = $('.header');
    header.classList.toggle('search-open');
    if (header.classList.contains('search-open')) $('#searchInput').focus();
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

  /* ---------- Reveal on scroll ---------- */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      }), { threshold: 0.12 })
    : null;
  function observeReveal(els) {
    els.forEach(el => io ? io.observe(el) : el.classList.add('is-in'));
  }

  window.TL = {
    PRODUCTS, ready, $, $$, esc, formatUZS, productUrl, productMedia, store,
    wish, addToCart, toggleWish, showToast, renderCounts,
    renderCards, bindCards, observeReveal,
  };

  renderCounts();
})();

// Product page: product.html?id=<id>. Data comes through api.js, helpers from common.js.
(() => {
  const { PRODUCTS, ready, $, $$, esc, formatUZS, wish, addToCart, toggleWish, renderCards, bindCards, observeReveal } = window.TL;

  const root = $('#pdp');
  const id = new URLSearchParams(location.search).get('id');

  const chev = '<svg class="ico ico--sm" aria-hidden="true"><use href="#i-chev"/></svg>';
  const crumbs = name => `
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="index.html">Home</a>${chev}<a href="index.html#featured">Shop</a>${chev}<span aria-current="page">${esc(name)}</span>
    </nav>`;
  const paragraphs = text => String(text || '').split(/\n\s*\n|\n/).filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('');

  // Search from this page jumps back to the home page's results
  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    location.href = 'index.html' + (q ? '?q=' + encodeURIComponent(q) : '#featured');
  });

  ready.then(() => render(PRODUCTS.find(x => x.id === id)));

  function render(p) {
    if (!p) {
      document.title = 'Watch not found — TimeLux.Uz';
      root.innerHTML = `${crumbs('Not found')}
        <div class="pdp__missing">
          <svg aria-hidden="true"><use href="#i-watch"/></svg>
          <h1 class="section-title">Watch not found</h1>
          <p>This watch may have sold out or the link is incorrect.</p>
          <a href="index.html#featured" class="btn btn--gold">Browse all watches <svg class="ico ico--sm"><use href="#i-arrow"/></svg></a>
        </div>`;
      $('#relatedSection').hidden = true;
      return;
    }

    document.title = `${p.name} — TimeLux.Uz`;
    const specs = Object.entries(p.specs || {}).filter(([, v]) => String(v).trim());
    const keys = ['Movement', 'Case size', 'Water resistance', 'Crystal'].filter(k => p.specs?.[k]);

    root.innerHTML = `${crumbs(p.name)}
      <div class="pdp__grid">
        <div class="pdp__media">
          <div class="pdp__stage ${p.image ? 'has-photo' : ''}">
            <span class="pdp__tag"><svg class="ico ico--sm"><use href="#i-shield"/></svg> 100% Original</span>
            ${p.image
              ? `<img class="pdp__photo" src="${esc(p.image)}" alt="${esc(p.name)}">`
              : '<svg class="pdp__watch" aria-hidden="true"><use href="#i-watch"/></svg>'}
          </div>
        </div>

        <div class="pdp__info">
          <p class="pdp__brand">${esc(p.brand)}</p>
          <h1 class="pdp__title">${esc(p.name)}</h1>
          <p class="pdp__spec">${esc(p.spec)}</p>
          <p class="pdp__price">${formatUZS(p.price)}</p>
          <p class="pdp__stock"><span class="pdp__dot"></span>In stock · Ready to ship</p>
          <div class="pdp__lead">${paragraphs(p.description)}</div>

          ${keys.length ? `<ul class="pdp__keys">
            ${keys.map(k => `<li><span>${esc(k)}</span><strong>${esc(p.specs[k])}</strong></li>`).join('')}
          </ul>` : ''}

          <div class="pdp__buy">
            <div class="qty" aria-label="Quantity">
              <button type="button" data-step="-1" aria-label="Decrease quantity">−</button>
              <input type="number" id="qty" value="1" min="1" max="10" inputmode="numeric" aria-label="Quantity">
              <button type="button" data-step="1" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn--gold pdp__add" id="addToCart"><svg class="ico ico--sm"><use href="#i-cart"/></svg> Add to Cart</button>
            <button class="pdp__fav ${wish.has(p.id) ? 'is-on' : ''}" id="favBtn" aria-label="Add ${esc(p.name)} to wishlist" aria-pressed="${wish.has(p.id)}">
              <svg class="ico"><use href="#i-heart"/></svg>
            </button>
          </div>
          <a href="https://t.me" target="_blank" rel="noopener" class="btn btn--tg pdp__tg"><svg class="ico ico--sm"><use href="#i-tg"/></svg> Order via Telegram</a>

          <ul class="pdp__perks">
            <li><svg class="ico"><use href="#i-truck"/></svg>Fast delivery across Uzbekistan</li>
            <li><svg class="ico"><use href="#i-shield"/></svg>100% original, from official sources</li>
            <li><svg class="ico"><use href="#i-card"/></svg>Cash, card or online payment</li>
          </ul>
        </div>
      </div>

      <section class="pdp__details">
        <div class="tabs" role="tablist" aria-label="Product information">
          <button class="tabs__btn is-active" role="tab" aria-selected="true" aria-controls="tab-desc" id="t-desc">Description</button>
          <button class="tabs__btn" role="tab" aria-selected="false" aria-controls="tab-specs" id="t-specs" tabindex="-1">Specifications</button>
          <button class="tabs__btn" role="tab" aria-selected="false" aria-controls="tab-delivery" id="t-delivery" tabindex="-1">Delivery &amp; Returns</button>
        </div>
        <div class="tabs__panel" role="tabpanel" id="tab-desc" aria-labelledby="t-desc">
          ${paragraphs(p.description)}
          <p>Every watch we sell is checked before it ships and arrives in a signature TimeLux box, ready to wear or to give as a gift.</p>
        </div>
        <div class="tabs__panel" role="tabpanel" id="tab-specs" aria-labelledby="t-specs" hidden>
          <table class="specs">
            <tr><th>Brand</th><td>${esc(p.brand)}</td></tr>
            ${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
          </table>
        </div>
        <div class="tabs__panel" role="tabpanel" id="tab-delivery" aria-labelledby="t-delivery" hidden>
          <ul class="pdp__list">
            <li><strong>Delivery:</strong> we deliver to all regions of Uzbekistan.</li>
            <li><strong>Payment:</strong> cash, card or online payment.</li>
            <li><strong>Returns &amp; warranty:</strong> message us on Telegram or Instagram and we’ll help with any question about your watch.</li>
          </ul>
        </div>
      </section>`;

    /* ---------- Quantity ---------- */
    const qty = $('#qty');
    const clampQty = v => Math.min(10, Math.max(1, parseInt(v, 10) || 1));
    $$('[data-step]', root).forEach(b => b.addEventListener('click', () => {
      qty.value = clampQty(+qty.value + +b.dataset.step);
    }));
    qty.addEventListener('change', () => { qty.value = clampQty(qty.value); });

    /* ---------- Cart & wishlist ---------- */
    const addBtn = $('#addToCart');
    addBtn.addEventListener('click', () => {
      addToCart(p, clampQty(qty.value));
      addBtn.classList.add('is-added');
      setTimeout(() => addBtn.classList.remove('is-added'), 600);
    });
    const fav = $('#favBtn');
    fav.addEventListener('click', () => {
      const on = toggleWish(p);
      fav.classList.toggle('is-on', on);
      fav.setAttribute('aria-pressed', on);
    });

    /* ---------- Tabs ---------- */
    const tabs = $$('.tabs__btn', root);
    function selectTab(tab) {
      tabs.forEach(t => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => selectTab(t));
      t.addEventListener('keydown', e => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        const next = tabs[(i + step + tabs.length) % tabs.length];
        selectTab(next);
        next.focus();
      });
    });

    /* ---------- Related ---------- */
    const others = PRODUCTS.filter(x => x.id !== p.id).slice(0, 4);
    if (!others.length) { $('#relatedSection').hidden = true; return; }
    const related = $('#related');
    renderCards(related, others);
    bindCards(related);
    $$('.section-head').forEach(el => el.classList.add('reveal'));
    observeReveal($$('.section-head'));
  }
})();

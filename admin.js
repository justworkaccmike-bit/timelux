// Admin panel: sign in, manage products and collection banners. All storage goes through api.js.
(() => {
  const api = window.TLApi;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const formatUZS = n => !n ? 'Price on request' : n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' UZS';

  const SPEC_TEMPLATE = ['Movement', 'Case size', 'Case material', 'Dial', 'Crystal', 'Water resistance', 'Strap', 'Functions'];
  const BANNER_NAMES = { new: 'New Arrivals', men: 'Men’s Collection', women: 'Women’s Collection', best: 'Best Sellers' };
  const BANNER_NOTES = { new: 'Shown on phones only' };

  let products = [];

  /* ---------- Toast ---------- */
  const toast = $('#toast');
  let toastTimer;
  function showToast(msg, isError) {
    toast.textContent = msg;
    toast.classList.toggle('is-error', !!isError);
    toast.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-show'), isError ? 4000 : 2400);
  }

  function setBusy(btn, busy, label) {
    if (busy) { btn.dataset.label = btn.innerHTML; btn.textContent = label; }
    else if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    btn.disabled = busy;
  }

  /* ---------- Sign in ---------- */
  const loginView = $('#loginView');
  const appView = $('#appView');
  const loginForm = $('#loginForm');
  const loginError = $('#loginError');

  if (!api.live) {
    $('#demoBar').hidden = false;
    $('#demoEnter').hidden = false;
    $('.adm-login__lead').textContent = 'Supabase isn’t connected yet. Open the demo admin to try it out; changes stay in this browser.';
    $$('.adm-field', loginForm).forEach(f => { f.hidden = true; });
    $('[type=submit]', loginForm).hidden = true;
  }

  function showApp(user) {
    loginView.hidden = true;
    appView.hidden = false;
    $('#who').textContent = api.live ? user.email : 'Demo admin';
    loadProducts();
    loadBanners();
  }
  function showLogin() {
    appView.hidden = true;
    loginView.hidden = false;
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    loginError.hidden = true;
    if (!email || !password) {
      loginError.textContent = 'Enter your email and password.';
      loginError.hidden = false;
      return;
    }
    const btn = $('[type=submit]', loginForm);
    setBusy(btn, true, 'Signing in…');
    try {
      showApp(await api.signIn(email, password));
      loginForm.reset();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    } finally {
      setBusy(btn, false);
    }
  });
  $('#demoEnter').addEventListener('click', async () => showApp(await api.signIn()));
  $('#signOut').addEventListener('click', async () => {
    await api.signOut();
    showLogin();
  });

  /* ---------- Section tabs ---------- */
  $$('.adm-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.adm-tab').forEach(t => t.classList.toggle('is-active', t === tab));
    $('#view-products').hidden = tab.dataset.view !== 'products';
    $('#view-banners').hidden = tab.dataset.view !== 'banners';
  }));

  /* ================= Products ================= */
  const list = $('#productList');
  const search = $('#productSearch');

  async function loadProducts() {
    list.innerHTML = '<p class="adm-empty">Loading products…</p>';
    try {
      products = await api.listProducts({ all: true });
      renderProducts();
    } catch (err) {
      list.innerHTML = `<p class="adm-empty adm-empty--error">Couldn’t load products: ${esc(err.message)}</p>`;
    }
  }

  function renderProducts() {
    const q = search.value.trim().toLowerCase();
    const shown = products.filter(p => !q || `${p.name} ${p.brand} ${p.spec}`.toLowerCase().includes(q));
    const hidden = products.filter(p => p.published === false).length;
    $('#productCount').textContent = `${products.length} product${products.length === 1 ? '' : 's'}` + (hidden ? ` · ${hidden} hidden from the site` : '');
    $('#brandList').innerHTML = [...new Set(products.map(p => p.brand))].map(b => `<option value="${esc(b)}">`).join('');

    if (!products.length) {
      list.innerHTML = '<p class="adm-empty">No products yet. Click “Add product” to create the first one.</p>';
      return;
    }
    if (!shown.length) {
      list.innerHTML = '<p class="adm-empty">No products match your search.</p>';
      return;
    }
    list.innerHTML = shown.map(p => `
      <article class="adm-row ${p.published === false ? 'is-hidden' : ''}" data-id="${esc(p.id)}">
        <div class="adm-row__thumb">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '<svg aria-hidden="true"><use href="#i-watch"/></svg>'}</div>
        <div class="adm-row__main">
          <p class="adm-row__brand">${esc(p.brand)}</p>
          <h3 class="adm-row__name">${esc(p.name)}</h3>
          <p class="adm-row__spec">${esc(p.spec)}</p>
        </div>
        <p class="adm-row__price">${formatUZS(p.price)}</p>
        <span class="adm-chip ${p.published === false ? 'adm-chip--off' : ''}">${p.published === false ? 'Hidden' : 'On site'}</span>
        <div class="adm-row__actions">
          <a class="adm-iconlink" href="product.html?id=${encodeURIComponent(p.id)}" target="_blank" rel="noopener" title="View on site" aria-label="View ${esc(p.name)} on site"><svg class="ico"><use href="#i-ext"/></svg></a>
          <button class="adm-iconlink" data-edit title="Edit" aria-label="Edit ${esc(p.name)}"><svg class="ico"><use href="#i-edit"/></svg></button>
          <button class="adm-iconlink adm-iconlink--danger" data-delete title="Delete" aria-label="Delete ${esc(p.name)}"><svg class="ico"><use href="#i-trash"/></svg></button>
        </div>
      </article>`).join('');
  }
  search.addEventListener('input', renderProducts);

  list.addEventListener('click', e => {
    const row = e.target.closest('.adm-row');
    if (!row) return;
    const p = products.find(x => x.id === row.dataset.id);
    if (e.target.closest('[data-edit]')) openEditor(p);
    if (e.target.closest('[data-delete]')) confirmDelete(p);
  });
  $('#addProduct').addEventListener('click', () => openEditor(null));

  /* ---------- Delete ---------- */
  // Resolves true for Delete, false for Cancel / Escape.
  const confirmDialog = $('#confirmDialog');
  let confirmResolve = null;
  function askConfirm(text) {
    $('#confirmText').textContent = text;
    confirmDialog.showModal();
    $('#confirmCancel').focus();
    return new Promise(resolve => { confirmResolve = resolve; });
  }
  function answerConfirm(ok) {
    confirmDialog.close();
    confirmResolve?.(ok);
    confirmResolve = null;
  }
  $('#confirmOk').addEventListener('click', () => answerConfirm(true));
  $('#confirmCancel').addEventListener('click', () => answerConfirm(false));
  confirmDialog.addEventListener('cancel', e => { e.preventDefault(); answerConfirm(false); });

  async function confirmDelete(p) {
    if (!(await askConfirm(`“${p.name}” will be removed from the website. This can’t be undone.`))) return;
    try {
      await api.deleteProduct(p.id);
      products = products.filter(x => x.id !== p.id);
      renderProducts();
      showToast(`${p.name} deleted`);
    } catch (err) {
      showToast(`Couldn’t delete: ${err.message}`, true);
    }
  }

  /* ---------- Editor ---------- */
  const dialog = $('#productDialog');
  const form = $('#productForm');
  const f = form.elements;
  const errorBox = $('#productError');
  const specRows = $('#specRows');
  let editing = null;   // product being edited, null when adding
  let photo = '';       // current photo URL in the form
  let slugTouched = false;

  const parsePrice = v => Number(String(v).replace(/[^\d]/g, ''));

  function specRow(label = '', value = '') {
    const row = document.createElement('div');
    row.className = 'adm-spec';
    row.innerHTML = `
      <input class="adm-spec__k" placeholder="Label" maxlength="40" value="${esc(label)}" aria-label="Specification label">
      <input class="adm-spec__v" placeholder="Value" maxlength="120" value="${esc(value)}" aria-label="Specification value">
      <button type="button" class="adm-iconlink" aria-label="Remove row"><svg class="ico ico--sm"><use href="#i-close"/></svg></button>`;
    $('button', row).addEventListener('click', () => row.remove());
    specRows.appendChild(row);
    return row;
  }
  $('#addSpec').addEventListener('click', () => $('input', specRow()).focus());

  function renderPhoto() {
    $('#photoPreview').innerHTML = photo
      ? `<img src="${esc(photo)}" alt="">`
      : '<svg aria-hidden="true"><use href="#i-watch"/></svg><span>No photo</span>';
    $('#photoRemove').hidden = !photo;
    $('#photoBtnText').textContent = photo ? 'Replace photo' : 'Upload photo';
  }

  function openEditor(p) {
    editing = p;
    form.reset();
    errorBox.hidden = true;
    $('#productDialogTitle').textContent = p ? `Edit ${p.name}` : 'Add product';
    $('#productSave').textContent = p ? 'Save changes' : 'Add product';
    f.name.value = p?.name || '';
    f.brand.value = p?.brand || '';
    f.spec.value = p?.spec || '';
    f.price.value = p?.price ? formatUZS(p.price).replace(' UZS', '') : '';
    f.id.value = p?.id || '';
    f.id.readOnly = !!p;
    $('#slugHint').textContent = p
      ? 'The page address stays the same so existing links keep working.'
      : 'Letters, numbers and dashes. Can’t be changed after saving, so links keep working.';
    f.description.value = p?.description || '';
    f.published.checked = p ? p.published !== false : true;
    slugTouched = !!p;

    specRows.innerHTML = '';
    const specs = p ? Object.entries(p.specs || {}) : SPEC_TEMPLATE.map(k => [k, '']);
    (specs.length ? specs : [['', '']]).forEach(([k, v]) => specRow(k, v));

    photo = p?.image || '';
    renderPhoto();
    dialog.showModal();
    f.name.focus();
  }

  f.name.addEventListener('input', () => {
    if (!editing && !slugTouched) f.id.value = api.slugify(f.name.value);
  });
  f.id.addEventListener('input', () => { slugTouched = true; });
  f.price.addEventListener('blur', () => {
    const n = parsePrice(f.price.value);
    if (n) f.price.value = formatUZS(n).replace(' UZS', '');
  });

  $$('[data-close]', dialog).forEach(b => b.addEventListener('click', () => dialog.close()));

  // Photo upload happens straight away, so the preview shows the stored image.
  const photoInput = $('#photoInput');
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    photoInput.value = '';
    if (!file) return;
    const btnText = $('#photoBtnText');
    btnText.textContent = 'Uploading…';
    try {
      photo = await api.uploadImage(file, 'products');
    } catch (err) {
      showToast(err.message, true);
    }
    renderPhoto();
  });
  $('#photoRemove').addEventListener('click', () => { photo = ''; renderPhoto(); });

  function readForm() {
    const specs = {};
    $$('.adm-spec', specRows).forEach(row => {
      const k = $('.adm-spec__k', row).value.trim();
      const v = $('.adm-spec__v', row).value.trim();
      if (k && v) specs[k] = v;
    });
    return {
      id: (editing ? editing.id : api.slugify(f.id.value || f.name.value)),
      name: f.name.value.trim(),
      brand: f.brand.value.trim(),
      spec: f.spec.value.trim(),
      price: parsePrice(f.price.value) || null,
      description: f.description.value.trim(),
      specs,
      image: photo,
      published: f.published.checked,
    };
  }

  function validate(p) {
    if (!p.name) return ['name', 'Enter the product name.'];
    if (!editing && products.some(x => x.id === p.id)) return ['id', 'Another product already uses this page address. Change it slightly.'];
    return null;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const p = readForm();
    const problem = validate(p);
    if (problem) {
      errorBox.textContent = problem[1];
      errorBox.hidden = false;
      f[problem[0]].focus();
      return;
    }
    errorBox.hidden = true;
    const btn = $('#productSave');
    setBusy(btn, true, 'Saving…');
    try {
      await api.saveProduct(p, { isNew: !editing });
      dialog.close();
      showToast(editing ? `${p.name} updated` : `${p.name} added`);
      await loadProducts();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.hidden = false;
    } finally {
      setBusy(btn, false);
    }
  });

  /* ================= Banners ================= */
  const bannerGrid = $('#bannerGrid');

  async function loadBanners() {
    bannerGrid.innerHTML = '<p class="adm-empty">Loading banners…</p>';
    try {
      const banners = await api.getBanners();
      bannerGrid.innerHTML = api.SLOTS.map(slot => {
        const custom = banners[slot] !== api.DEFAULT_BANNERS[slot];
        return `
          <article class="adm-banner" data-slot="${slot}">
            <div class="adm-banner__img"><img src="${esc(banners[slot])}" alt="${esc(BANNER_NAMES[slot])} banner"></div>
            <div class="adm-banner__body">
              <h3>${BANNER_NAMES[slot]}</h3>
              <p class="adm-sub">${custom ? 'Custom image' : 'Default image'}${BANNER_NOTES[slot] ? ' · ' + BANNER_NOTES[slot] : ''}</p>
              <div class="adm-banner__actions">
                <label class="btn btn--gold adm-btn-sm">
                  <svg class="ico ico--sm"><use href="#i-upload"/></svg> <span>Replace</span>
                  <input type="file" accept="image/*" hidden>
                </label>
                ${custom ? '<button class="btn adm-btn-ghost adm-btn-sm" data-reset><svg class="ico ico--sm"><use href="#i-reset"/></svg> Use default</button>' : ''}
              </div>
            </div>
          </article>`;
      }).join('');
    } catch (err) {
      bannerGrid.innerHTML = `<p class="adm-empty adm-empty--error">Couldn’t load banners: ${esc(err.message)}</p>`;
    }
  }

  bannerGrid.addEventListener('change', async e => {
    const input = e.target.closest('input[type=file]');
    if (!input?.files[0]) return;
    const card = input.closest('.adm-banner');
    const slot = card.dataset.slot;
    const label = $('label span', card);
    label.textContent = 'Uploading…';
    try {
      const url = await api.uploadImage(input.files[0], 'banners');
      await api.saveBanner(slot, url);
      showToast(`${BANNER_NAMES[slot]} banner updated`);
      loadBanners();
    } catch (err) {
      label.textContent = 'Replace';
      showToast(err.message, true);
    }
  });
  bannerGrid.addEventListener('click', async e => {
    if (!e.target.closest('[data-reset]')) return;
    const slot = e.target.closest('.adm-banner').dataset.slot;
    try {
      await api.resetBanner(slot);
      showToast(`${BANNER_NAMES[slot]} banner reset`);
      loadBanners();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  /* ---------- Start ---------- */
  api.session()
    .then(user => user ? showApp(user) : showLogin())
    .catch(() => showLogin());
})();

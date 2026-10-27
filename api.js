// Data layer for the shop and the admin panel.
// With Supabase configured in config.js everything is read from and written to Supabase.
// Without it the site runs in demo mode on this browser's localStorage, seeded from data.js.
(() => {
  const cfg = window.TL_CONFIG || {};
  const live = !!(cfg.supabaseUrl && cfg.supabaseKey);

  const SLOTS = ['new', 'men', 'women', 'best'];
  const DEFAULT_BANNERS = Object.fromEntries(SLOTS.map(s => [s, `assets/img/banners/${s}.jpg`]));
  const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0);

  const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'watch';

  // Shrink photos before storing them: phones produce 4–8 MB originals.
  async function resizeImage(file, max = 1600, quality = 0.86) {
    if (!/^image\//.test(file.type)) throw new Error('Please choose an image file (JPG, PNG or WebP).');
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
  }
  const blobToDataUrl = blob => new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });

  /* ================= Demo mode (localStorage) ================= */
  const DB_KEY = 'tl-demo-db';
  const SESSION_KEY = 'tl-demo-admin';

  function loadDb() {
    try {
      const db = JSON.parse(localStorage.getItem(DB_KEY));
      if (db && Array.isArray(db.products)) return db;
    } catch { /* fall through to seed */ }
    return {
      products: (window.TL_PRODUCTS || []).map((p, i) => ({ image: '', published: true, sort: i, ...p })),
      banners: {},
    };
  }
  function saveDb(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch { throw new Error('This browser’s storage is full. Use smaller images or connect Supabase.'); }
  }

  const demo = {
    async listProducts({ all = false } = {}) {
      return loadDb().products.filter(p => all || p.published !== false).sort(bySort);
    },
    async getBanners() {
      return { ...DEFAULT_BANNERS, ...loadDb().banners };
    },
    async session() {
      try { return sessionStorage.getItem(SESSION_KEY) ? { email: 'demo' } : null; } catch { return null; }
    },
    async signIn() {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
      return { email: 'demo' };
    },
    async signOut() {
      try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    },
    async saveProduct(p, { isNew }) {
      const db = loadDb();
      const i = db.products.findIndex(x => x.id === p.id);
      if (isNew && i !== -1) throw new Error('A product with this page address already exists.');
      if (isNew) db.products.push({ ...p, sort: Math.max(-1, ...db.products.map(x => x.sort ?? 0)) + 1 });
      else db.products[i] = { ...db.products[i], ...p };
      saveDb(db);
    },
    async deleteProduct(id) {
      const db = loadDb();
      db.products = db.products.filter(p => p.id !== id);
      saveDb(db);
    },
    async uploadImage(file) {
      return blobToDataUrl(await resizeImage(file, 1000, 0.8));
    },
    async saveBanner(slot, url) {
      const db = loadDb();
      db.banners[slot] = url;
      saveDb(db);
    },
    async resetBanner(slot) {
      const db = loadDb();
      delete db.banners[slot];
      saveDb(db);
    },
  };

  /* ================= Live mode (Supabase) ================= */
  let clientPromise;
  function client() {
    return clientPromise ||= new Promise((resolve, reject) => {
      const make = () => resolve(window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey));
      if (window.supabase) return make();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
      s.onload = make;
      s.onerror = () => reject(new Error('Could not reach Supabase. Check your internet connection.'));
      document.head.appendChild(s);
    });
  }
  const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  const fromRow = r => ({
    id: r.id, brand: r.brand, name: r.name, spec: r.spec, price: Number(r.price),
    description: r.description || '', specs: r.specs || {}, image: r.image_url || '',
    published: r.published, sort: r.sort_order,
  });
  const toRow = p => ({
    id: p.id, brand: p.brand, name: p.name, spec: p.spec, price: p.price,
    description: p.description, specs: p.specs, image_url: p.image || null, published: p.published,
  });

  async function isAdmin(sb) {
    const { data } = await sb.rpc('is_admin');
    return data === true;
  }

  const supa = {
    async listProducts({ all = false } = {}) {
      const sb = await client();
      let q = sb.from('products').select('*').order('sort_order').order('created_at');
      if (!all) q = q.eq('published', true);
      return check(await q).map(fromRow);
    },
    async getBanners() {
      const sb = await client();
      const rows = check(await sb.from('banners').select('slot, image_url'));
      return { ...DEFAULT_BANNERS, ...Object.fromEntries(rows.map(r => [r.slot, r.image_url])) };
    },
    async session() {
      const sb = await client();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return null;
      return (await isAdmin(sb)) ? { email: session.user.email } : null;
    },
    async signIn(email, password) {
      const sb = await client();
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error('Wrong email or password.');
      if (!(await isAdmin(sb))) {
        await sb.auth.signOut();
        throw new Error('This account does not have admin access.');
      }
      return { email };
    },
    async signOut() {
      await (await client()).auth.signOut();
    },
    async saveProduct(p, { isNew }) {
      const sb = await client();
      const res = isNew
        ? await sb.from('products').insert(toRow(p))
        : await sb.from('products').update(toRow(p)).eq('id', p.id);
      if (res.error?.code === '23505') throw new Error('A product with this page address already exists.');
      check(res);
    },
    async deleteProduct(id) {
      const sb = await client();
      check(await sb.from('products').delete().eq('id', id));
    },
    async uploadImage(file, folder = 'products') {
      const sb = await client();
      const blob = await resizeImage(file);
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      check(await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },
    async saveBanner(slot, url) {
      const sb = await client();
      check(await sb.from('banners').upsert({ slot, image_url: url, updated_at: new Date().toISOString() }));
    },
    async resetBanner(slot) {
      const sb = await client();
      check(await sb.from('banners').delete().eq('slot', slot));
    },
  };

  window.TLApi = { ...(live ? supa : demo), live, slugify, SLOTS, DEFAULT_BANNERS };
})();

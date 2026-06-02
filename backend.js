// ============================================================
//  KRYPT — Backend абстракц
//
//  supabase-config.js-д жинхэнэ түлхүүр байвал → Supabase (бодит,
//  олон төхөөрөмж дундын). Байхгүй бол → localStorage demo горим
//  (тохиргоо хэрэггүй, шууд ажиллана, гэхдээ өгөгдөл зөвхөн энэ
//  хөтөч дээр хадгалагдана).
//
//  Хоёр горим ижил API-тай тул хуудаснууд ялгааг мэдрэхгүй.
// ============================================================

const USING_SUPABASE = (typeof SUPABASE_READY !== 'undefined') && SUPABASE_READY && !!sb;

/* ── localStorage туслахууд ─────────────────────────────── */
const _LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};
const _K = { users: 'krypt_users', session: 'krypt_session', orders: 'krypt_orders' };
function _uid() {
  return 'xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}
function _pickProfile(u) {
  return u ? { full_name: u.full_name, company: u.company, phone: u.phone } : null;
}

/* ── Supabase хувилбар ──────────────────────────────────── */
const SupabaseBackend = {
  mode: 'supabase',

  async register({ email, password, full_name, phone, company }) {
    const { data, error } = await sb.auth.signUp({
      email, password, options: { data: { full_name, phone, company } }
    });
    if (error) throw new Error(error.message);
    return { needsConfirm: !data.session, user: data.user };
  },

  async login({ email, password }) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },

  async logout() { await sb.auth.signOut(); },

  async currentUser() {
    const { data } = await sb.auth.getSession();
    return data.session ? { id: data.session.user.id, email: data.session.user.email } : null;
  },

  async profile(userId) {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
    return data;
  },

  async orders({ all }) {
    let q = sb.from('orders')
      .select('*, profiles(full_name, company, phone)')
      .order('created_at', { ascending: false });
    if (!all) {
      const me = await this.currentUser();
      q = q.eq('user_id', me.id);
    }
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createOrder(payload) {
    const me = await this.currentUser();
    const { error } = await sb.from('orders').insert({ ...payload, user_id: me.id });
    if (error) throw new Error(error.message);
  },

  async updateStatus(id, status) {
    const { error } = await sb.from('orders').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  onChange(cb) {
    sb.channel('orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, cb)
      .subscribe();
  },
};

/* ── localStorage хувилбар ──────────────────────────────── */
const LocalBackend = {
  mode: 'local',

  async register({ email, password, full_name, phone, company }) {
    email = (email || '').trim().toLowerCase();
    const users = _LS.get(_K.users, []);
    if (users.find(u => u.email === email)) throw new Error('already registered');
    // Хамгийн анхны бүртгэл = админ (студийн эзэн)
    const role = users.length === 0 ? 'admin' : 'customer';
    const user = {
      id: _uid(), email, password, full_name, phone, company, role,
      created_at: new Date().toISOString()
    };
    users.push(user); _LS.set(_K.users, users);
    _LS.set(_K.session, user.id);
    return { needsConfirm: false, user };
  },

  async login({ email, password }) {
    email = (email || '').trim().toLowerCase();
    const users = _LS.get(_K.users, []);
    const u = users.find(x => x.email === email);
    if (!u || u.password !== password) throw new Error('Invalid login credentials');
    _LS.set(_K.session, u.id);
  },

  async logout() { localStorage.removeItem(_K.session); },

  async currentUser() {
    const id = _LS.get(_K.session, null);
    if (!id) return null;
    const u = _LS.get(_K.users, []).find(x => x.id === id);
    return u ? { id: u.id, email: u.email } : null;
  },

  async profile(userId) {
    return _LS.get(_K.users, []).find(x => x.id === userId) || null;
  },

  async orders({ all }) {
    const me = await this.currentUser();
    const users = _LS.get(_K.users, []);
    let list = _LS.get(_K.orders, []);
    if (!all) list = list.filter(o => o.user_id === me.id);
    list = list.map(o => ({ ...o, profiles: _pickProfile(users.find(u => u.id === o.user_id)) }));
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return list;
  },

  async createOrder(payload) {
    const me = await this.currentUser();
    const list = _LS.get(_K.orders, []);
    const now = new Date().toISOString();
    list.push({
      id: _uid(), user_id: me.id, status: 'new',
      created_at: now, updated_at: now,
      ...payload,
    });
    _LS.set(_K.orders, list);
    window.dispatchEvent(new Event('krypt-orders-changed'));
  },

  async updateStatus(id, status) {
    const list = _LS.get(_K.orders, []);
    const o = list.find(x => x.id === id);
    if (o) { o.status = status; o.updated_at = new Date().toISOString(); _LS.set(_K.orders, list); }
    window.dispatchEvent(new Event('krypt-orders-changed'));
  },

  onChange(cb) {
    window.addEventListener('krypt-orders-changed', cb);
    window.addEventListener('storage', e => { if (e.key === _K.orders) cb(); });
  },
};

/* ── Өөрийн Node.js + PostgreSQL сервер (REST API) ──────── */
const ApiBackend = {
  mode: 'api',
  _profile: null,
  _token() { return localStorage.getItem('krypt_token'); },

  async _fetch(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const t = this._token();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    let res;
    try {
      res = await fetch(API_BASE_URL + path, { ...opts, headers });
    } catch (e) {
      throw new Error('Серверт холбогдсонгүй. Сервер ажиллаж байгаа эсэх, API_BASE_URL зөв эсэхийг шалгана уу.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('Алдаа ' + res.status));
    return data;
  },

  async register({ email, password, full_name, phone, company }) {
    const d = await this._fetch('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, full_name, phone, company })
    });
    localStorage.setItem('krypt_token', d.token);
    this._profile = d.user;
    return { needsConfirm: false, user: d.user };
  },

  async login({ email, password }) {
    const d = await this._fetch('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password })
    });
    localStorage.setItem('krypt_token', d.token);
    this._profile = d.user;
  },

  async logout() { localStorage.removeItem('krypt_token'); this._profile = null; },

  async currentUser() {
    if (!this._token()) return null;
    try {
      const d = await this._fetch('/auth/me');
      this._profile = d.user;
      return { id: d.user.id, email: d.user.email };
    } catch {
      localStorage.removeItem('krypt_token');
      return null;
    }
  },

  async profile() {
    if (this._profile) return this._profile;
    const d = await this._fetch('/auth/me');
    this._profile = d.user;
    return d.user;
  },

  async orders({ all }) {
    const d = await this._fetch('/orders' + (all ? '?all=1' : ''));
    return d.orders || [];
  },

  async createOrder(payload) {
    await this._fetch('/orders', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateStatus(id, status) {
    await this._fetch('/orders/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  onChange(cb) {
    // Энгийн polling — 8 секунд тутамд шинэчилнэ
    setInterval(cb, 8000);
  },
};

/* ── Сонголт (дараалал: API → Supabase → demo) ──────────── */
const API_ON = (typeof API_READY !== 'undefined') && API_READY;
const Backend = API_ON ? ApiBackend : (USING_SUPABASE ? SupabaseBackend : LocalBackend);

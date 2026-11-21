// Shared helpers: per-recap device token, API calls, sharing, small DOM utilities.

export const LOGO = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="6" y="10" width="30" height="46" rx="8" fill="#ff5a3c" transform="rotate(-10 21 33)"/><rect x="18" y="6" width="30" height="46" rx="8" fill="#6d4aff"/><rect x="18" y="12" width="30" height="4" rx="2" fill="#c6f432"/><path d="M27 34l5 5 9-11" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function randomToken() {
  const a = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const memory = {};
export function remember(key, value) { try { localStorage.setItem(`cc.${key}`, value); } catch { memory[key] = value; } }
export function recall(key) { try { return localStorage.getItem(`cc.${key}`) || memory[key] || ''; } catch { return memory[key] || ''; } }

// One random token per recap per browser identifies you in that group (stored hashed on the server). No account.
// Your personal link (/r/<id>#k=<token>) carries it to another phone or browser.
export function tokenFor(id) {
  let t = recall(`tok.${id}`);
  if (!t) { t = randomToken(); remember(`tok.${id}`, t); }
  return t;
}
export const validToken = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t);

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (token) headers['x-token'] = token;
  if (body) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new Error('No connection. Check your internet and try again.'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
}

export function toast(msg) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 2400);
}

export const isPhone = () => matchMedia('(pointer: coarse)').matches;

// Share sheet on phones, clipboard on desktop.
export async function shareLink({ title, text, url }) {
  if (navigator.share && isPhone()) {
    try { await navigator.share({ title, text, url }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Link copied. Paste it in the group chat.');
    return 'copied';
  } catch {
    prompt('Copy this link:', url);
    return 'prompted';
  }
}

// Phones: share sheet with the image file. Desktop (or no file sharing): download.
export async function shareImage(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (isPhone() && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Saved. Post it to your story or the chat.');
  return 'downloaded';
}

export function counter(input, out) {
  const max = Number(input.getAttribute('maxlength'));
  const upd = () => { out.textContent = `${Array.from(input.value).length}/${max}`; };
  input.addEventListener('input', upd);
  upd();
}

export function mountLogo() { document.querySelectorAll('[data-logo]').forEach((el) => { el.innerHTML = LOGO; }); }

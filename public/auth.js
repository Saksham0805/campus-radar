/* Campus Radar - email OTP login (login popup first) + bookmark sync.
   Load this BEFORE script.js:  <script src="auth.js"></script> */
(function () {
  // Live Server (port 5500) -> local Express backend. Anywhere else (Vercel) -> same site's /api
  const API = location.port === '5500' ? 'http://localhost:3000/api' : '/api';
  const REQUIRE_LOGIN = true;                // true = site locked until login, false = login optional
  const KEY = 'cr_token', MAIL = 'cr_email', PENDING = 'cr_pending';

  /* sessionStorage helpers (never crash if the browser blocks storage) */
  const ss = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
    del: (k) => { try { sessionStorage.removeItem(k); } catch {} },
  };

  const css = `
  .cr-ov{position:fixed;inset:0;background:rgba(20,18,40,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px}
  .cr-ov.open{display:flex}
  .cr-ov.gate{background:rgba(246,245,255,.96);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
  .cr-ov.gate .cr-x{display:none}
  .cr-box{background:#fff;border-radius:20px;padding:28px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(60,40,160,.25);font-family:inherit}
  .cr-box h3{margin:0 0 6px;font-size:22px;color:#1e1b3a}
  .cr-box p{margin:0 0 16px;color:#6b6a80;font-size:14px}
  .cr-box input{width:100%;box-sizing:border-box;padding:13px 14px;border:1.5px solid #dcd8f5;border-radius:10px;font-size:16px;font-family:inherit;outline:none;margin-bottom:12px}
  .cr-box input:focus{border-color:#6654e8}
  .cr-otp{letter-spacing:10px;text-align:center;font-size:22px!important;font-weight:700}
  .cr-btn{width:100%;padding:13px;border:0;border-radius:10px;background:#6654e8;color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer}
  .cr-btn:hover{background:#5140d2}
  .cr-btn:disabled{opacity:.6;cursor:wait}
  .cr-link{background:none;border:0;color:#6654e8;cursor:pointer;font-size:13px;font-family:inherit;margin-top:10px;padding:0}
  .cr-err{color:#d93a3a;font-size:13px;min-height:18px;margin-bottom:6px}
  .cr-x{float:right;background:none;border:0;font-size:22px;cursor:pointer;color:#999}
  .cr-float{position:fixed;right:18px;bottom:18px;z-index:9998;padding:11px 18px;border:0;border-radius:999px;background:#6654e8;color:#fff;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(102,84,232,.4)}
  .cr-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#1e1b3a;color:#fff;padding:10px 18px;border-radius:10px;z-index:10000;font-size:14px}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const ov = document.createElement('div');
  ov.className = 'cr-ov';
  ov.innerHTML = `
    <div class="cr-box">
      <button class="cr-x" aria-label="Close">&times;</button>
      <div id="cr-s1">
        <h3>Login to Campus Radar</h3>
        <p>We'll email you a 6-digit code. No password needed.</p>
        <input id="cr-email" type="email" placeholder="you@example.com" autocomplete="email">
        <div class="cr-err" id="cr-e1"></div>
        <button class="cr-btn" id="cr-send">Send OTP</button>
      </div>
      <div id="cr-s2" style="display:none">
        <h3>Enter OTP</h3>
        <p id="cr-sub"></p>
        <input id="cr-otp" class="cr-otp" inputmode="numeric" maxlength="6" placeholder="------" autocomplete="one-time-code">
        <div class="cr-err" id="cr-e2"></div>
        <button class="cr-btn" id="cr-verify">Verify &amp; Login</button>
        <button class="cr-link" id="cr-back">Change email / resend</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const $ = (id) => document.getElementById(id);

  /* Uses the site's own toast if it has one (#toast), otherwise makes one */
  let toastTimer;
  function toast(m) {
    const site = document.getElementById('toast');
    if (site) {
      site.textContent = m; site.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => site.classList.remove('show'), 2600);
      return;
    }
    const t = document.createElement('div'); t.className = 'cr-toast'; t.textContent = m;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2800);
  }

  let pendingEmail = '';
  const isLoggedIn = () => !!localStorage.getItem(KEY);
  const gated = () => REQUIRE_LOGIN && !isLoggedIn();

  function showStep1() {
    $('cr-s1').style.display = ''; $('cr-s2').style.display = 'none';
    $('cr-email').focus();
  }
  function showStep2(email) {
    pendingEmail = email;
    $('cr-sub').textContent = 'Code sent to ' + email;
    $('cr-s1').style.display = 'none'; $('cr-s2').style.display = '';
    $('cr-otp').value = ''; $('cr-e2').textContent = '';
    $('cr-otp').focus();
  }

  const open = () => {
    ov.classList.add('open');
    ov.classList.toggle('gate', gated());
    document.body.style.overflow = gated() ? 'hidden' : '';
    const p = ss.get(PENDING);          // OTP already sent? come back to the OTP box
    if (p) showStep2(p); else showStep1();
  };
  const close = () => {
    if (gated()) return;                // can't dismiss until logged in
    ov.classList.remove('open');
    document.body.style.overflow = '';
  };
  ov.querySelector('.cr-x').onclick = close;
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });

  async function call(path, opts = {}) {
    const token = localStorage.getItem(KEY);
    let res;
    try {
      res = await fetch(API + path, {
        ...opts,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      });
    } catch {
      throw new Error('Cannot reach the server. Is "npm start" running?');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) logout(true);
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  $('cr-send').onclick = async () => {
    const email = $('cr-email').value.trim().toLowerCase();
    $('cr-e1').textContent = '';
    if (!email) return ($('cr-e1').textContent = 'Enter your email');
    $('cr-send').disabled = true;
    try {
      await call('/auth/request-otp', { method: 'POST', body: JSON.stringify({ email }) });
      ss.set(PENDING, email);
      showStep2(email);
    } catch (e) { $('cr-e1').textContent = e.message; }
    $('cr-send').disabled = false;
  };
  $('cr-email').addEventListener('keydown', (e) => e.key === 'Enter' && $('cr-send').click());
  $('cr-otp').addEventListener('keydown', (e) => e.key === 'Enter' && $('cr-verify').click());
  $('cr-otp').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    if (e.target.value.length === 6 && !$('cr-verify').disabled) $('cr-verify').click();
  });
  $('cr-back').onclick = () => { ss.del(PENDING); showStep1(); };

  $('cr-verify').onclick = async () => {
    $('cr-e2').textContent = '';
    $('cr-verify').disabled = true;
    try {
      const d = await call('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email: pendingEmail, otp: $('cr-otp').value.trim() }) });
      localStorage.setItem(KEY, d.token); localStorage.setItem(MAIL, d.email);
      ss.del(PENDING);
      close(); updateBtn(); toast('Logged in as ' + d.email);
      document.dispatchEvent(new CustomEvent('cr:login', { detail: { email: d.email } }));
    } catch (e) { $('cr-e2').textContent = e.message; }
    $('cr-verify').disabled = false;
  };

  function logout(silent) {
    localStorage.removeItem(KEY); localStorage.removeItem(MAIL);
    ss.del(PENDING);
    updateBtn(); if (!silent) toast('Logged out');
    document.dispatchEvent(new CustomEvent('cr:logout'));
    if (REQUIRE_LOGIN) open();
  }

  /* Login / Logout button: uses [data-auth-btn] if the page has one, else a floating button */
  let btn = document.querySelector('[data-auth-btn]');
  if (!btn) { btn = document.createElement('button'); btn.className = 'cr-float'; document.body.appendChild(btn); }
  function updateBtn() {
    const email = localStorage.getItem(MAIL);
    btn.textContent = email ? 'Logout (' + email.split('@')[0] + ')' : 'Login';
    btn.style.display = gated() ? 'none' : '';
  }
  btn.addEventListener('click', (e) => { e.preventDefault(); isLoggedIn() ? logout() : open(); });
  updateBtn();

  /* Bookmarks.  h = { id, title, deadline: '2026-12-05', url }  */
  async function syncBookmark(h, isSaved, quiet) {
    if (!isLoggedIn()) { if (!quiet) { toast('Login to get deadline reminders'); open(); } return false; }
    try {
      if (isSaved) {
        await call('/bookmarks', { method: 'POST', body: JSON.stringify({ hackathonId: h.id, title: h.title, deadline: h.deadline, url: h.url }) });
        if (!quiet) toast("Saved. We'll email you before the deadline.");
      } else {
        await call('/bookmarks/' + encodeURIComponent(h.id), { method: 'DELETE' });
      }
      return true;
    } catch (e) { if (!quiet) toast(e.message); return false; }
  }

  async function fetchBookmarks() {
    const list = await call('/bookmarks');
    return Array.isArray(list) ? list : [];
  }

  if (gated()) open();   // login popup first, before the site is usable

  window.CampusAuth = { open, logout, isLoggedIn, syncBookmark, fetchBookmarks, email: () => localStorage.getItem(MAIL) };
})();

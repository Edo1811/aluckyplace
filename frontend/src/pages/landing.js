import { api } from '../api.js';
import { setUser } from '../store.js';
import socket from '../socket.js';
import { $, fmt, onLeave, listen, playerFrame } from '../ui/core.js';

const CSS = `
.land{position:absolute;inset:0;overflow:hidden;background:radial-gradient(120% 70% at 50% 0%,#0b1712 0%,#050505 60%)}
.land canvas{position:absolute;inset:0;width:100%;height:100%}
.land .veil{position:absolute;inset:0;background:radial-gradient(75% 60% at 50% 48%,rgba(5,5,5,.9),rgba(5,5,5,.45) 70%,rgba(5,5,5,.15));pointer-events:none}
.land .center{position:relative;z-index:2;height:100%;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 18px calc(24px + env(safe-area-inset-bottom));scrollbar-width:none}
.land .center::-webkit-scrollbar{display:none}
.logo{font-size:44px;font-weight:700;letter-spacing:-.015em;line-height:1.02;text-align:center}
.logo .a{color:var(--gold);text-shadow:0 0 28px rgba(212,175,55,.45)}
.logo .q{color:var(--em)}
.tagline{font-size:14px;font-style:italic;color:rgba(255,255,255,.45);margin-top:10px;text-align:center}
.lform{width:100%;max-width:360px;margin-top:26px;padding:18px;border-radius:22px;background:rgba(12,12,12,.72);border:1px solid rgba(255,255,255,.09);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 30px 70px rgba(0,0,0,.6)}
.lseg{display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);position:relative;margin-bottom:16px}
.lseg button{position:relative;z-index:1;padding:10px 0;border:none;background:none;font-size:13.5px;font-weight:700;color:rgba(255,255,255,.4);cursor:pointer;transition:color .2s}
.lseg button.on{color:#fff}
.lseg .knob{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:10px;background:rgba(255,255,255,.09);transition:transform .28s cubic-bezier(.3,1.2,.4,1)}
.lseg.up .knob{transform:translateX(100%)}
.lf{margin-bottom:11px;position:relative}
.lf .inp{padding:13px 14px;font-size:14px}
.lf.bad .inp{border-color:rgba(239,68,68,.5)}
.lf .err{font-size:11px;color:#f87171;margin:5px 2px 0;display:none}
.lf.bad .err{display:block}
.lf .ok{position:absolute;right:12px;top:13px;color:var(--em);font-size:14px;display:none}
.lf.good .ok{display:block}
.eye{position:absolute;right:8px;top:7px;width:34px;height:34px;border:none;background:none;cursor:pointer;color:rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center}
.eye svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.6}
.signonly{overflow:hidden;max-height:0;opacity:0;transition:max-height .35s ease,opacity .25s,margin .3s;margin-bottom:0}
.lform.signup .signonly{max-height:90px;opacity:1;margin-bottom:11px}
.strength{display:flex;gap:4px;margin:6px 2px 0}
.strength i{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.08);transition:background .3s}
.cta{width:100%;padding:15px;border-radius:13px;border:none;background:var(--em);color:#03150e;font-size:15px;font-weight:700;cursor:pointer;margin-top:6px;transition:filter .15s}
.cta:hover{filter:brightness(1.08)}
.cta:disabled{filter:saturate(.4) brightness(.8);cursor:default}
.cta .spin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(3,21,14,.3);border-top-color:#03150e;animation:lsp .7s linear infinite;vertical-align:-2px;margin-right:8px}
@keyframes lsp{to{transform:rotate(360deg)}}
.formerr{font-size:12px;color:#f87171;text-align:center;min-height:0;margin-top:8px}
.perk{margin-top:12px;font-size:11.5px;line-height:1.5;color:rgba(255,255,255,.42);text-align:center}
.perk b{color:var(--em)}
.perk b.g{color:var(--gold)}
.lfoot{margin-top:22px;font-size:11px;letter-spacing:.06em;color:rgba(255,255,255,.3);text-align:center}
.lfoot b{color:rgba(255,255,255,.55)}
.welcome{position:absolute;inset:0;z-index:20;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:24px;background:rgba(5,5,5,.92);backdrop-filter:blur(8px)}
.welcome.on{display:flex;animation:wIn .4s}
@keyframes wIn{from{opacity:0}}
.welcome h2{font-size:30px}
.welcome .gift{display:flex;gap:10px;margin-top:4px}
.welcome .gift div{padding:14px 18px;border-radius:16px;border:1px solid var(--line);background:var(--card);min-width:110px}
.welcome .gift b{display:block;font-size:26px}
.welcome .gift span{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.3)}
@media(min-width:900px){.logo{font-size:68px}.tagline{font-size:16px}.lform{max-width:380px}}
`;

export function renderLanding(app) {
  app.innerHTML = `<style>${CSS}</style>
  <div class="land">
    <canvas id="rain"></canvas><div class="veil"></div>
    <div class="center">
      <div class="logo"><span class="a">A</span> <span class="q">"</span>lucky<span class="q">"</span> place</div>
      <div class="tagline">Gamble. Win big. Lose it all. Repeat.</div>
      <form class="lform" id="lform" novalidate>
        <div class="lseg" id="lseg"><div class="knob"></div><button type="button" class="on" data-m="in">Log in</button><button type="button" data-m="up">Sign up</button></div>
        <div class="lf" id="fUser"><input class="inp" id="user" placeholder="Username" autocomplete="username" maxlength="32"><span class="ok">✓</span><div class="err"></div></div>
        <div class="signonly"><div class="lf" id="fMail" style="margin:0"><input class="inp" id="mail" type="email" placeholder="Email" autocomplete="email"><span class="ok">✓</span><div class="err"></div></div></div>
        <div class="lf" id="fPass"><input class="inp" id="pass" type="password" placeholder="Password" autocomplete="current-password">
          <button type="button" class="eye" id="eye" aria-label="Show password"><svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <div class="strength" id="str" style="display:none"><i></i><i></i><i></i><i></i></div><div class="err"></div></div>
        <button class="cta" id="cta" type="submit">Log in</button>
        <div class="formerr" id="formerr"></div>
        <div class="perk" id="perk"></div>
      </form>
      <div class="lfoot">No real money. <b>Ever.</b></div>
    </div>
  </div>
  <div class="welcome" id="welcome">
    <div id="wFrame"></div><h2 id="wTitle"></h2>
    <p style="font-size:13px;color:rgba(255,255,255,.45);max-width:280px;line-height:1.5" id="wSub"></p>
    <div class="gift" id="wGift"></div>
    <button class="btn em" style="margin-top:8px;min-width:220px;padding:14px" id="wGo">Take me in</button>
  </div>`;

  startRain();
  bindForm();
}

// ── falling cards + burning CC bills ─────────────────────────────────────────
function startRain() {
  const cv = $('rain'), ctx = cv.getContext('2d');
  const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', 'K', 'Q', 'J', '7', '10'];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, objs = [], raf = 0, last = 0;
  const size = () => {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2);
    cv.width = r.width * d; cv.height = r.height * d; ctx.setTransform(d, 0, 0, d, 0, 0); W = r.width; H = r.height;
  };
  const spawn = (init) => {
    const s = (W < 600 ? 0.75 : 1) * (0.7 + Math.random() * 0.6);
    return { card: Math.random() < 0.58, x: Math.random() * W, y: init ? Math.random() * H : -80, vy: (22 + Math.random() * 34) * s,
      vx: (Math.random() - 0.5) * 10, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.1, s,
      suit: SUITS[Math.random() * 4 | 0], rank: RANKS[Math.random() * 6 | 0], ph: Math.random() * 10, a: 0.35 + Math.random() * 0.45 };
  };
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const card = (o) => {
    const w = 34 * o.s, h = 48 * o.s, red = o.suit === '♥' || o.suit === '♦';
    ctx.fillStyle = 'rgba(248,246,240,.95)'; rr(-w / 2, -h / 2, w, h, 4 * o.s); ctx.fill();
    ctx.fillStyle = red ? '#b02020' : '#161616';
    ctx.font = `700 ${9 * o.s}px Georgia`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.rank, -w / 2 + 3 * o.s, -h / 2 + 3 * o.s);
    ctx.font = `${18 * o.s}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.suit, 0, 2 * o.s);
  };
  const bill = (o, t) => {
    const w = 58 * o.s, h = 26 * o.s, g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, '#14532d'); g.addColorStop(0.5, '#1f7a46'); g.addColorStop(1, '#14532d');
    ctx.fillStyle = g; rr(-w / 2, -h / 2, w, h, 3 * o.s); ctx.fill();
    ctx.strokeStyle = 'rgba(187,247,208,.35)'; ctx.lineWidth = 1; rr(-w / 2 + 3 * o.s, -h / 2 + 3 * o.s, w - 6 * o.s, h - 6 * o.s, 2 * o.s); ctx.stroke();
    ctx.fillStyle = 'rgba(220,252,231,.8)'; ctx.font = `700 ${9 * o.s}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CC', 0, 0.5 * o.s);
    const bx = w / 2;
    ctx.fillStyle = 'rgba(20,10,4,.85)'; ctx.beginPath(); ctx.moveTo(bx, -h / 2);
    for (let k = 0; k <= 6; k++) ctx.lineTo(bx - 6 * o.s - Math.sin(t * 6 + k * 1.7 + o.ph) * 3 * o.s, -h / 2 + k * h / 6);
    ctx.lineTo(bx, h / 2); ctx.closePath(); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const fy = -h / 2 + (k + 0.5) * h / 5, fl = (9 + Math.sin(t * 9 + k * 2.1 + o.ph) * 5) * o.s;
      const fg = ctx.createRadialGradient(bx - 3 * o.s, fy, 0, bx - 3 * o.s, fy, fl);
      fg.addColorStop(0, 'rgba(255,240,180,.95)'); fg.addColorStop(0.35, 'rgba(251,146,60,.8)'); fg.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(bx + fl * 0.25, fy, fl * 0.8, fl * 0.45, -0.3, 0, 7); ctx.fill();
    }
  };
  const frame = (now) => {
    const t = now / 1000, dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    ctx.clearRect(0, 0, W, H);
    for (const o of objs) {
      o.y += o.vy * dt; o.x += o.vx * dt + Math.sin(t * 0.8 + o.ph) * 6 * dt; o.r += o.vr * dt;
      if (o.y > H + 80) Object.assign(o, spawn(false));
      ctx.save(); ctx.globalAlpha = o.a; ctx.translate(o.x, o.y); ctx.rotate(o.r);
      o.card ? card(o) : bill(o, t); ctx.restore();
    }
    if (!REDUCED) raf = requestAnimationFrame(frame);
  };
  const init = () => { size(); objs = Array.from({ length: Math.round(Math.min(30, W * H / 26000)) }, () => spawn(true)); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
  listen(window, 'resize', init);
  listen(document, 'visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else if (!REDUCED) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  onLeave(() => cancelAnimationFrame(raf));
  init();
}

// ── auth form ────────────────────────────────────────────────────────────────
function bindForm() {
  let mode = 'in';
  const perk = () => {
    $('perk').innerHTML = mode === 'up'
      ? 'You start with <b>1,000 CC</b> and <b class="g">10 A</b>. Spend them wisely. You won\'t.'
      : 'New here? You start with <b>1,000 CC</b> and <b class="g">10 A</b>.';
  };
  const setMode = (m) => {
    mode = m;
    $('lform').classList.toggle('signup', m === 'up');
    $('lseg').classList.toggle('up', m === 'up');
    document.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    $('cta').textContent = m === 'up' ? 'Create account' : 'Log in';
    $('pass').autocomplete = m === 'up' ? 'new-password' : 'current-password';
    $('str').style.display = m === 'up' ? 'flex' : 'none';
    $('formerr').textContent = '';
    ['fUser', 'fMail', 'fPass'].forEach((id) => $(id).classList.remove('bad', 'good'));
    perk();
  };
  document.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
  perk();

  const bad = (id, msg) => { $(id).classList.add('bad'); $(id).classList.remove('good'); $(id).querySelector('.err').textContent = msg; };
  const good = (id) => { $(id).classList.remove('bad'); if (mode === 'up') $(id).classList.add('good'); };
  const checkUser = (show) => {
    const v = $('user').value.trim();
    if (!v) { if (show) bad('fUser', 'Enter a username'); return false; }
    if (mode === 'up' && (v.length < 3 || v.length > 32)) { if (show) bad('fUser', 'Username must be 3–32 characters'); return false; }
    good('fUser'); return true;
  };
  const checkMail = (show) => {
    if (mode !== 'up') return true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('mail').value.trim())) { if (show) bad('fMail', 'That doesn\'t look like an email'); return false; }
    good('fMail'); return true;
  };
  const checkPass = (show) => {
    const v = $('pass').value;
    const sc = (v.length >= 8) + (/[A-Z]/.test(v) && /[a-z]/.test(v)) + /\d/.test(v) + /[^A-Za-z0-9]/.test(v);
    const cols = ['#ef4444', '#f59e0b', '#84cc16', '#10b981'];
    $('str').querySelectorAll('i').forEach((i, k) => { i.style.background = k < sc ? cols[Math.max(0, sc - 1)] : ''; });
    if (!v) { if (show) bad('fPass', 'Enter your password'); return false; }
    if (mode === 'up' && v.length < 6) { if (show) bad('fPass', 'At least 6 characters'); return false; }
    $('fPass').classList.remove('bad'); return true;
  };
  $('user').addEventListener('input', () => checkUser(false));
  $('user').addEventListener('blur', () => { if ($('user').value) checkUser(true); });
  $('mail').addEventListener('input', () => checkMail(false));
  $('mail').addEventListener('blur', () => { if ($('mail').value) checkMail(true); });
  $('pass').addEventListener('input', () => checkPass(false));
  $('eye').addEventListener('click', () => { $('pass').type = $('pass').type === 'password' ? 'text' : 'password'; });

  $('lform').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('formerr').textContent = '';
    if (![checkUser(true), checkMail(true), checkPass(true)].every(Boolean)) return;
    const username = $('user').value.trim(), password = $('pass').value, email = $('mail').value.trim();
    const btn = $('cta');
    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span>${mode === 'up' ? 'Creating account' : 'Logging in'}`;
    try {
      const data = mode === 'in'
        ? await api.post('/auth/login', { username, password })
        : await api.post('/auth/register', { username, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      socket.emit('auth', { token: data.token });
      setUser(data.user);
      welcome(data.user, mode === 'up');
    } catch (err) {
      const msg = err.message || 'Something went wrong';
      if (err.status === 409) bad('fUser', msg);
      else if (err.status === 401) bad('fPass', 'Wrong username or password');
      else $('formerr').textContent = msg;
    } finally {
      btn.disabled = false;
      btn.textContent = mode === 'up' ? 'Create account' : 'Log in';
    }
  });
}

function welcome(user, isNew) {
  $('wFrame').innerHTML = playerFrame(user.username, null, 100);
  $('wTitle').textContent = isNew ? `Welcome, ${user.username}` : `Back again, ${user.username}`;
  $('wSub').textContent = isNew ? 'Here\'s your starting stack. It will not last.' : 'Your balance is right where you left it.';
  $('wGift').innerHTML = `<div><b style="color:var(--em)">${fmt(user.cc_balance)}</b><span>Credits</span></div><div><b style="color:var(--gold)">${fmt(user.a_balance)}</b><span>Tokens</span></div>`;
  $('welcome').classList.add('on');
  $('wGo').addEventListener('click', () => window.__navigate('home'));
  if (!isNew) setTimeout(() => { if ($('welcome')) window.__navigate('home'); }, 1400);
}

import { api } from '../api.js';
import { setUser } from '../store.js';

export function renderLanding(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box }
      body { background:#050505 }
      .page { position:relative; min-height:100vh; background:#050505; display:flex; align-items:center; justify-content:center; overflow:hidden }
      #bgc  { position:absolute; inset:0; width:100%; height:100%; pointer-events:none }
      .center { position:relative; z-index:2; display:flex; flex-direction:column; align-items:center; gap:22px; padding:60px 20px; width:100%; max-width:400px }
      .logo  { font-family:'Playfair Display',Georgia,serif; font-size:52px; font-weight:700; color:#fff; line-height:1; letter-spacing:-1.5px; text-align:center }
      .logo .gld { color:#D4AF37 }
      .logo .em  { color:#10b981 }
      .tagline { font-family:'Playfair Display',Georgia,serif; font-style:italic; font-size:14.5px; color:rgba(255,255,255,0.36); letter-spacing:0.04em; text-align:center }
      .card { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.09); border-radius:16px; padding:22px; display:flex; flex-direction:column; gap:13px }
      .tabs { display:flex; background:rgba(0,0,0,0.35); border-radius:10px; padding:3px; gap:3px }
      .tab  { flex:1; padding:9px 0; background:none; border:none; border-radius:8px; color:rgba(255,255,255,0.3); font-size:13.5px; font-family:'Playfair Display',Georgia,serif; cursor:pointer; transition:background .18s,color .18s }
      .tab.on { background:rgba(16,185,129,0.15); color:#10b981; font-weight:700 }
      .fields { display:flex; flex-direction:column; gap:8px }
      .f { width:100%; padding:12px 15px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.07); border-radius:8px; color:#fff; font-size:14px; font-family:'Playfair Display',Georgia,serif; outline:none; transition:border-color .15s }
      .f:focus { border-color:rgba(16,185,129,0.45) }
      .f::placeholder { color:rgba(255,255,255,0.2) }
      .btn { width:100%; padding:13px; background:#10b981; border:none; border-radius:9px; color:#fff; font-size:15px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer; letter-spacing:0.04em; transition:background .15s,transform .08s; margin-top:3px }
      .btn:hover { background:#0ea472 }
      .btn:active { transform:scale(0.99) }
      .btn:disabled { background:rgba(255,255,255,0.1); cursor:not-allowed }
      .err  { font-size:12px; color:#ef4444; text-align:center; min-height:16px; font-family:'Playfair Display',Georgia,serif }
      .disc { font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:rgba(255,255,255,0.14) }
    </style>

    <div class="page" id="page">
      <canvas id="bgc"></canvas>
      <div class="center">
        <div class="logo"><span class="gld">A</span> <span class="em">"</span>lucky<span class="em">"</span> place</div>
        <p class="tagline">Gamble. Win big. Lose it all. Repeat.</p>
        <div class="card">
          <div class="tabs">
            <button class="tab on" id="tl">Log In</button>
            <button class="tab"    id="ts">Sign Up</button>
          </div>
          <div class="fields" id="flds"></div>
          <div class="err" id="err"></div>
          <button class="btn" id="gbtn">Log In</button>
        </div>
        <span class="disc">No real money. Ever.</span>
      </div>
    </div>
  `;

  // ── Background animation — cards and cash 3-4× bigger ────────────────────
  const cvs = document.getElementById('bgc');
  const ctx  = cvs.getContext('2d');
  const pg   = document.getElementById('page');

  function rsz() { cvs.width = pg.offsetWidth; cvs.height = pg.offsetHeight; }
  rsz();
  try { new ResizeObserver(rsz).observe(pg); } catch(e) {}

  const SUITS = ['♠','♥','♦','♣'], VALS = ['A','K','Q','J','10','9','8'];

  function mk(W, H, scatter) {
    const isCard = Math.random() < 0.55;
    // 3-4× scale factor applied to card and cash dimensions
    const scale = 3 + Math.random(); // 3.0 – 4.0
    return {
      type: isCard ? 'card' : 'cash',
      x:    Math.random() * W,
      y:    scatter ? Math.random() * H : -Math.random() * 200,
      vy:   0.55 + Math.random() * 0.9,
      vx:   (Math.random() - 0.5) * 0.22,
      rot:  Math.random() * 360,
      rs:   (Math.random() - 0.5) * 1.4,
      al:   0.10 + Math.random() * 0.18,
      suit: SUITS[0 | Math.random() * 4],
      val:  VALS[0 | Math.random() * 7],
      // Card: ~27×39 base → scaled up
      cw:   (26 + Math.random() * 8)  * scale,
      ch:   (38 + Math.random() * 8)  * scale,
      // Cash: ~40×18 base → scaled up
      bw:   (38 + Math.random() * 16) * scale,
      bh:   (17 + Math.random() * 8)  * scale,
      fp:   Math.random() * Math.PI * 2,
      scale,
    };
  }

  let items = [];
  // Fewer items since they're much bigger — 14 fills the screen well
  function init() {
    const W = cvs.width, H = cvs.height;
    items = Array.from({ length: 14 }, () => mk(W, H, true));
  }
  init();

  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();}

  let last = 0;
  function loop(ts) {
    const dt = Math.min((ts - last) / 16.67, 3); last = ts;
    const W = cvs.width, H = cvs.height, t = ts / 1000;
    ctx.clearRect(0, 0, W, H);

    items.forEach(it => {
      it.y += it.vy * dt; it.x += it.vx * dt; it.rot += it.rs * dt;
      if (it.y > H + 120) { const n = mk(W, H, false); Object.assign(it, n); }

      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot * Math.PI / 180);
      ctx.globalAlpha = it.al;

      if (it.type === 'card') {
        const { cw, ch, scale } = it;
        const r = 4 * scale;
        ctx.fillStyle = 'rgba(252,252,250,0.93)';
        rr(ctx, -cw/2, -ch/2, cw, ch, r); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.6; ctx.stroke();
        const red = it.suit === '♥' || it.suit === '♦';
        ctx.fillStyle = red ? '#b02020' : '#111';
        ctx.font = `bold ${Math.round(8 * scale)}px Georgia,serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(it.val, -cw/2 + 4 * scale, -ch/2 + 4 * scale);
        ctx.font = `${Math.round(14 * scale)}px Georgia,serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.suit, 0, 4);
      } else {
        const { bw, bh, scale } = it;
        const r = 3 * scale;
        ctx.fillStyle = '#0f2010';
        ctx.strokeStyle = 'rgba(40,110,40,0.5)'; ctx.lineWidth = 0.8;
        rr(ctx, -bw/2, -bh/2, bw, bh, r); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(50,130,50,0.65)';
        ctx.font = `bold ${Math.round(9 * scale)}px Georgia,serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('$', -bw/2 + 9 * scale, 0);

        const flick = 0.35 + 0.65 * Math.abs(Math.sin(t * 5.5 + it.fp));
        ctx.globalAlpha = it.al * 0.55 * flick;
        const g = ctx.createRadialGradient(0, -bh/2, 0, 0, -bh/2, bh * 1.4);
        g.addColorStop(0, 'rgba(255,110,0,.95)');
        g.addColorStop(0.45, 'rgba(255,55,0,.4)');
        g.addColorStop(1, 'rgba(255,20,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-bw/2, -bh * 1.7, bw, bh * 1.7);
      }
      ctx.restore();
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ── Tab switching ─────────────────────────────────────────────────────────
  let mode = 'login';

  function buildFields() {
    const flds = document.getElementById('flds');
    flds.innerHTML = mode === 'login'
      ? `<input class="f" id="f-username" type="text"     placeholder="Username" autocomplete="username">
         <input class="f" id="f-password" type="password" placeholder="Password" autocomplete="current-password">`
      : `<input class="f" id="f-username" type="text"     placeholder="Username" autocomplete="username">
         <input class="f" id="f-email"    type="email"    placeholder="Email"    autocomplete="email">
         <input class="f" id="f-password" type="password" placeholder="Password" autocomplete="new-password">`;
    flds.querySelectorAll('.f').forEach(f => {
      f.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    });
  }

  document.getElementById('tl').addEventListener('click', () => {
    mode = 'login';
    document.getElementById('tl').classList.add('on');
    document.getElementById('ts').classList.remove('on');
    document.getElementById('gbtn').textContent = 'Log In';
    document.getElementById('err').textContent = '';
    buildFields();
  });

  document.getElementById('ts').addEventListener('click', () => {
    mode = 'signup';
    document.getElementById('ts').classList.add('on');
    document.getElementById('tl').classList.remove('on');
    document.getElementById('gbtn').textContent = 'Create Account';
    document.getElementById('err').textContent = '';
    buildFields();
  });

  document.getElementById('gbtn').addEventListener('click', submit);
  buildFields();

  // ── Submit ────────────────────────────────────────────────────────────────
  async function submit() {
    const errEl   = document.getElementById('err');
    const btn     = document.getElementById('gbtn');
    errEl.textContent = '';

    const username = document.getElementById('f-username')?.value.trim();
    const password = document.getElementById('f-password')?.value;
    const email    = document.getElementById('f-email')?.value.trim();

    if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

    btn.disabled    = true;
    btn.textContent = mode === 'login' ? 'Logging in…' : 'Creating account…';

    try {
      let data;
      if (mode === 'login') {
        data = await api.post('/auth/login', { username, password });
      } else {
        if (!email) { errEl.textContent = 'Email is required.'; btn.disabled = false; btn.textContent = 'Create Account'; return; }
        data = await api.post('/auth/register', { username, email, password });
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      window.__navigate('home');

    } catch (err) {
      errEl.textContent   = err.message || 'Something went wrong.';
      btn.disabled        = false;
      btn.textContent     = mode === 'login' ? 'Log In' : 'Create Account';
    }
  }
}

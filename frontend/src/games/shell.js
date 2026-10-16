// Shared frame for every game screen: top bar, bet screen, play stage,
// result screen with one-tap replay. Game pages supply the stage + logic.
import './shell.css';
import { store, updateBalance } from '../store.js';
import { $, fmt, esc, amountOf, balanceHTML, bindBalance, emitBalance, onLeave } from '../ui/core.js';

/** Push a server-reported balance into the store and every balance pill. */
export function syncBalance(cc) {
  if (cc === undefined || cc === null) return;
  updateBalance({ cc_balance: Number(cc) });
  emitBalance();
}

const lastBet = {};
export const betFor = (id, fallback = 100) => Math.max(10, Math.min(lastBet[id] || fallback, Math.max(10, Number(store.ccBalance) || 10)));

/**
 * Render the game frame.
 * opts: { id, title, css, stage, actions, exitTo='games', onExit }
 * Returns helpers for switching screens and showing results.
 */
export function gameShell(app, opts) {
  app.innerHTML = `<style>${opts.css || ''}</style>
  <div class="glayer">
    <div class="gtop">
      <button class="gexit" id="gexit" aria-label="Leave">←</button>
      <div class="gtitle">${esc(opts.title)}</div>
      ${balanceHTML()}
    </div>
    <section class="gscreen" id="scBet">
      <div class="center"><div class="betbox">
        <div class="bt-lbl">Your bet</div>
        <input class="bt-inp" id="betInp" inputmode="numeric" autocomplete="off">
        <div class="chips" id="betChips"></div>
        <div class="muted" id="betNote"></div>
        <div class="gerr" id="betErr"></div>
      </div></div>
      <div class="gactions"><button class="ga ga-em" id="betGo">Place bet</button></div>
    </section>
    <section class="gscreen" id="scPlay">
      <div class="gstage" id="gstage">${opts.stage || ''}</div>
      <div class="gactions" id="gactions">${opts.actions || ''}</div>
    </section>
    <section class="gscreen" id="scRes">
      <div class="center">
        <div class="res-badge" id="resBadge"></div>
        <div class="res-amt" id="resAmt"></div>
        <div class="res-sub" id="resSub"></div>
        <div class="res-seed" id="resSeed"></div>
      </div>
      <div class="gactions"><button class="ga" id="resChange">Change bet</button><button class="ga ga-em" id="resAgain">Play again</button></div>
    </section>
  </div>`;
  bindBalance();
  $('gexit').addEventListener('click', () => { if (opts.onExit) opts.onExit(); window.__navigate(opts.exitTo || 'games'); });

  const show = (id) => document.querySelectorAll('.gscreen').forEach((s) => s.classList.toggle('on', s.id === id));
  const shell = {
    show,
    /** Bet screen. onPlace(bet) should start the round; may be async and throw to show an error. */
    bet({ onPlace, note, min = 10, cta = 'Place bet' }) {
      const inp = $('betInp');
      inp.value = fmt(betFor(opts.id));
      const bal = () => Number(store.ccBalance) || 0;
      $('betNote').textContent = note || `Balance ${fmt(bal())} CC · minimum ${fmt(min)} CC`;
      $('betErr').textContent = '';
      $('betGo').textContent = cta;
      const chips = [['100', 100], ['1K', 1000], ['5K', 5000], ['½', 'half'], ['Max', 'max']];
      $('betChips').innerHTML = chips.map(([l, v]) => `<button class="chip" data-v="${v}">${l}</button>`).join('');
      $('betChips').querySelectorAll('[data-v]').forEach((c) => c.addEventListener('click', () => {
        const v = c.dataset.v === 'max' ? bal() : c.dataset.v === 'half' ? Math.floor(bal() / 2) : Math.min(Number(c.dataset.v), bal());
        inp.value = fmt(Math.max(min, v)); $('betErr').textContent = '';
      }));
      inp.oninput = () => { const v = amountOf(inp.value); inp.value = v ? fmt(v) : ''; $('betErr').textContent = ''; };
      $('betGo').onclick = async () => {
        const b = amountOf(inp.value);
        if (b < min) { $('betErr').textContent = `Minimum bet is ${fmt(min)} CC`; return; }
        if (b > bal()) { $('betErr').textContent = 'You don\'t have that much'; return; }
        lastBet[opts.id] = b;
        $('betGo').disabled = true;
        try { await onPlace(b); } catch (err) { $('betErr').textContent = err.message || 'Could not place that bet'; show('scBet'); }
        $('betGo').disabled = false;
      };
      show('scBet');
    },
    stage: () => $('gstage'),
    actions(html) { const a = $('gactions'); a.innerHTML = html; a.style.display = html ? 'flex' : 'none'; return a; },
    /** Result screen. again(): one-tap replay; change(): back to the bet screen. */
    result({ net, sub, seed, again, change, againLabel = 'Play again', changeLabel = 'Change bet' }) {
      const win = net > 0;
      $('resBadge').textContent = win ? 'You won' : net === 0 ? 'Break even' : 'You lost';
      $('resAmt').textContent = `${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))} CC`;
      $('resAmt').className = `res-amt ${win ? 'win' : net < 0 ? 'lose' : ''}`;
      $('resSub').textContent = sub || '';
      $('resSeed').textContent = seed ? `seed ${seed}` : '';
      $('resAgain').textContent = againLabel; $('resChange').textContent = changeLabel;
      $('resAgain').onclick = again; $('resChange').onclick = change;
      $('resChange').style.display = change ? '' : 'none';
      show('scRes');
    },
  };
  return shell;
}

/** Sizes a canvas to its box (DPR-aware). Returns {ctx, W, H} or null if not laid out. */
export function fitCanvas(cv) {
  const r = cv.getBoundingClientRect(); if (!r.width || !r.height) return null;
  const d = Math.min(devicePixelRatio || 1, 2), cw = Math.round(r.width * d), ch = Math.round(r.height * d);
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
  return { ctx, W: r.width, H: r.height };
}

/** requestAnimationFrame loop that stops on navigation. */
export function loop(fn) {
  let raf = 0, last = performance.now(), on = true;
  const tick = (now) => { if (!on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; fn(dt, now); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  const stop = () => { on = false; cancelAnimationFrame(raf); };
  onLeave(stop);
  return stop;
}

/** Pointer flick reader: calls onEnd({dx, dy, dt, speed}). */
export function flick(el, onEnd) {
  let sx = 0, sy = 0, st = 0, down = false;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; st = performance.now(); try { el.setPointerCapture(e.pointerId); } catch { /* */ } });
  el.addEventListener('pointerup', (e) => {
    if (!down) return; down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy, dt = Math.max(0.04, (performance.now() - st) / 1000);
    onEnd({ dx, dy, dt, speed: Math.hypot(dx, dy) / dt });
  });
  el.addEventListener('pointercancel', () => { down = false; });
}

/** Socket handlers that are removed when the page is left. */
export function on(socket, handlers) {
  Object.entries(handlers).forEach(([ev, fn]) => { socket.off(ev); socket.on(ev, fn); });
  onLeave(() => Object.keys(handlers).forEach((ev) => socket.off(ev)));
}

export const eOut = (k) => 1 - Math.pow(1 - k, 3);
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

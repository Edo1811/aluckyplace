import { api } from '../api.js';
import { $, fmt, toast, later } from '../ui/core.js';
import { gameShell, syncBalance } from '../games/shell.js';
import { pullGesture, EM, RED } from '../games/draw.js';

// Server: roll is an integer 1–100. Over wins on roll > t (t 1–99); under wins on roll < t (t 2–100). 1% edge.
const chanceOf = (over, t) => (over ? 100 - t : t - 1);

export function renderDice(app) {
  const shell = gameShell(app, {
    id: 'dice', title: 'Dice',
    stage: `<div class="pad">
      <div class="dnum" id="dcNum">—</div>
      <div class="dbarwrap"><div class="dbar"><i id="dcL"></i><i id="dcR"></i></div>
        <div class="dknob" id="dcKnob"></div><div class="dmark" id="dcMark" style="display:none"></div>
        <input class="drange" id="dcRange" type="range" min="2" max="98" step="1" value="50" aria-label="Target"></div>
      <div class="statrow">
        <div><div class="stat-v" id="dcTgt">50</div><div class="stat-l">Target</div></div>
        <div><div class="stat-v" id="dcCh">50%</div><div class="stat-l">Win chance</div></div>
        <div><div class="stat-v" id="dcPay">1.98×</div><div class="stat-l">Payout</div></div>
      </div>
      <div class="throwpad" id="dcPad"><div class="tpin" id="dcPin">Pull back to throw</div></div>
      <div class="ghint">Drag the marker to set your target · pull down on the pad and release to throw</div>
    </div>`,
  });

  let bet = 0, tgt = 50, over = true, rolling = false;

  function upd() {
    const ch = chanceOf(over, tgt);
    $('dcL').style.width = `${tgt}%`; $('dcR').style.width = `${100 - tgt}%`;
    $('dcL').style.background = over ? 'rgba(239,68,68,.35)' : 'rgba(16,185,129,.45)';
    $('dcR').style.background = over ? 'rgba(16,185,129,.45)' : 'rgba(239,68,68,.35)';
    $('dcKnob').style.left = `${tgt}%`;
    $('dcTgt').textContent = `${over ? '>' : '<'} ${tgt}`;
    $('dcCh').textContent = `${ch}%`;
    $('dcPay').textContent = `${(99 / ch).toFixed(2)}×`;
  }
  function modeBtn() {
    shell.actions(`<button class="ga" id="dcMode">${over ? 'Roll over' : 'Roll under'} · tap to flip</button>`);
    $('dcMode').onclick = () => { if (rolling) return; over = !over; modeBtn(); upd(); };
  }
  $('dcRange').addEventListener('input', (e) => { if (rolling) return; tgt = Number(e.target.value); upd(); });

  const pin = $('dcPin'), pad = $('dcPad');
  pullGesture(pad, 90, {
    onStart: () => !rolling,
    onMove: (p) => {
      pin.style.transform = `translateY(${Math.min(p * 0.34, 26)}px)`;
      pin.textContent = p > 16 ? 'Release' : 'Pull back to throw';
      pad.style.borderColor = `rgba(16,185,129,${0.14 + p / 200})`;
    },
    onRelease: (p) => { pin.style.transform = ''; pad.style.borderColor = ''; if (p > 16) roll(p / 90); else pin.textContent = 'Pull back to throw'; },
  });

  async function roll(power) {
    rolling = true; pin.textContent = 'Rolling';
    $('dcMode').disabled = true; $('dcRange').disabled = true;
    $('dcMark').style.display = 'none'; $('dcNum').style.color = '';
    const steps = Math.round(9 + power * 16);
    let n = 0, res = null, err = null;
    api.post('/games/dice/roll', { amount: bet, direction: over ? 'over' : 'under', threshold: tgt })
      .then((r) => { res = r; }).catch((e) => { err = e; });
    const tick = () => {
      if (err) { rolling = false; toast(err.message, 'red'); reset(); return; }
      n++;
      if (n < steps || !res) { $('dcNum').textContent = 1 + Math.floor(Math.random() * 100); later(42, tick); return; }
      syncBalance(res.cc_balance);
      const col = res.win ? EM : RED;
      $('dcNum').textContent = res.roll; $('dcNum').style.color = col;
      const mk = $('dcMark'); mk.style.display = 'block'; mk.style.left = `${res.roll}%`; mk.style.background = col;
      later(1300, () => shell.result({
        net: Number(res.net), sub: `Rolled ${res.roll} · ${over ? 'over' : 'under'} ${tgt}`, seed: res.seed,
        again: () => start(bet), change,
      }));
    };
    tick();
  }
  function reset() {
    rolling = false; $('dcRange').disabled = false; pin.textContent = 'Pull back to throw';
    $('dcNum').textContent = '—'; $('dcNum').style.color = ''; $('dcMark').style.display = 'none';
    modeBtn(); upd();
  }
  function start(b) { bet = b; reset(); shell.show('scPlay'); }
  const change = () => shell.bet({ onPlace: start });

  upd();
  change();
}

import socket from '../socket.js';
import { $, esc, later, sheetHTML, openSheet } from '../ui/core.js';
import { on } from '../games/shell.js';
import { pvpShell } from '../games/pvp.js';
import { sfx, isMuted, setMuted } from '../games/sfx.js';

// 007 rules (server: backend/src/pvp/matchmaking.js → resolveDuels).
//   Charge ⚡ loads your one shot (max 1)
//   Attack 💥 needs a charge and spends it — hits a player who's charging
//   Defend 🛡 blocks an attack — max 2 rounds in a row
//   Two attacks collide and cancel out
const ICON = { charge: '⚡', defend: '🛡', attack: '💥' };
const LABEL = { charge: 'Charge', defend: 'Defend', attack: 'Attack' };

const pref = {
  get(k, d) { try { const v = localStorage.getItem(`alp_du_${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`alp_du_${k}`, JSON.stringify(v)); } catch { /* storage off */ } },
};

const RULES = `<div class="bjrules">
  <h3>The moves</h3>
  <ul><li><b>⚡ Charge</b> — load your shot. You can hold one charge at a time.</li>
  <li><b>💥 Attack</b> — only while charged. Fires your shot and uses up the charge.</li>
  <li><b>🛡 Defend</b> — blocks an attack. You can defend at most 2 rounds in a row.</li></ul>
  <h3>What happens</h3>
  <table>
    <tr><td>💥 Attack vs ⚡ Charge</td><td>charger loses ♥</td></tr>
    <tr><td>💥 Attack vs 🛡 Defend</td><td>blocked</td></tr>
    <tr><td>💥 Attack vs 💥 Attack</td><td>shots cancel out</td></tr>
    <tr><td>anything else</td><td>nothing happens</td></tr>
  </table>
  <p style="margin-top:8px">The only way to get hit is charging while your opponent attacks — and you can always see whether they're charged. Both players pick at the same time. No pick in time = Defend (or Charge if you can't defend).</p>
  <h3>Winning</h3>
  <p>3 lives each. Lose them all and your opponent takes the pot. From round 20 it's <b>sudden death</b>: both drop to 1 life and the next hit wins.</p>
  <h3>Settings</h3>
  <div class="bjtog"><span>Sound</span><button id="duSndTog"></button></div>
</div>`;

const STYLE = `
.dut{position:relative;padding:8px 14px 10px;gap:8px;justify-content:flex-start}
.dubar{display:flex;align-items:center;gap:7px}
.dubar .sp{flex:1}
.duround{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.dusudden{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#fca5a5;background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.35);padding:3px 8px;border-radius:9px;animation:dupulse 1.2s ease-in-out infinite}
@keyframes dupulse{50%{opacity:.55}}
.duico{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);font-family:var(--pf);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
.duarena{position:relative;display:flex;justify-content:space-between;align-items:flex-end;flex:1;min-height:200px;max-height:330px}
.dufig{width:42%;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative}
.duname{font-size:12px;font-weight:700;color:rgba(255,255,255,.7);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dufig.me .duname{color:var(--em)}
.duhearts{display:flex;gap:3px;font-size:17px}
.duhearts i{font-style:normal;color:#f43f5e;transition:opacity .3s,transform .3s}
.duhearts i.gone{opacity:.14;transform:scale(.7);filter:grayscale(1)}
.duhearts i.break{animation:dubreak .6s ease-out forwards}
@keyframes dubreak{30%{transform:scale(1.5) rotate(-12deg)}100%{opacity:.14;transform:scale(.7);filter:grayscale(1)}}
.dumeters{display:flex;gap:6px;align-items:center}
.ducharge{font-size:11px;font-weight:700;padding:3px 8px;border-radius:9px;border:1px solid rgba(255,255,255,.12);color:rgba(255,255,255,.3);background:rgba(255,255,255,.03);transition:all .25s;white-space:nowrap}
.ducharge.on{color:#fde047;border-color:rgba(253,224,71,.55);background:rgba(253,224,71,.12);box-shadow:0 0 14px rgba(253,224,71,.25)}
.dudef{display:flex;gap:2px;font-size:10px}
.dudef i{font-style:normal;opacity:.18}
.dudef i.on{opacity:1}
.dubody{position:relative;width:62px;height:96px;margin-top:6px}
.dubody .b{position:absolute;bottom:0;left:50%;margin-left:-26px;width:52px;height:66px;border-radius:22px 22px 12px 12px;background:rgba(255,255,255,.45);transition:transform .15s}
.dubody .h{position:absolute;bottom:62px;left:50%;margin-left:-15px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.45)}
.dufig.me .dubody .b,.dufig.me .dubody .h{background:rgba(16,185,129,.8)}
.dubody.hurt .b,.dubody.hurt .h{background:#ef4444 !important}
.dubody.hurt{animation:bjshake .45s}
@keyframes bjshake{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
.dubody.charging::after{content:'';position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(circle,rgba(253,224,71,.45),transparent 65%);animation:duglow .9s ease-out}
@keyframes duglow{from{transform:scale(.4);opacity:0}40%{opacity:1}}
.dubody.armed::before{content:'⚡';position:absolute;top:-10px;right:-8px;font-size:15px;filter:drop-shadow(0 0 6px rgba(253,224,71,.8));animation:dupulse 1.4s ease-in-out infinite}
.dushield{position:absolute;top:-6px;width:20px;height:104px;border-radius:50%;border:3px solid rgba(96,165,250,.85);box-shadow:0 0 18px rgba(96,165,250,.6),inset 0 0 12px rgba(96,165,250,.4);animation:dushield .25s ease-out}
.dufig.me .dushield{right:-22px;border-left-color:transparent}
.dufig.opp .dushield{left:-22px;border-right-color:transparent}
@keyframes dushield{from{transform:scaleY(.2);opacity:0}}
.duhist{display:flex;gap:3px;min-height:20px}
.duhist span{font-size:12px;width:20px;height:20px;border-radius:6px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center}
.duhist span:first-child{background:rgba(255,255,255,.12)}
.dupick{position:absolute;top:22px;font-size:26px;animation:dureveal .35s cubic-bezier(.2,1.6,.4,1);z-index:3}
.dufig.me .dupick{right:-40px}.dufig.opp .dupick{left:-40px}
.dupick.wait{font-size:11px;color:rgba(255,255,255,.45);top:34px;animation:none;background:rgba(255,255,255,.06);padding:2px 6px;border-radius:7px}
.dufig.me .dupick.wait{right:-50px}.dufig.opp .dupick.wait{left:-50px}
@keyframes dureveal{from{transform:scale(0) rotate(-30deg)}}
.duproj{position:absolute;bottom:56px;width:18px;height:18px;border-radius:50%;background:radial-gradient(circle,#fff,#fde047 45%,#f97316);box-shadow:0 0 18px #f97316;z-index:4;pointer-events:none}
.duburst{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);font-size:40px;z-index:5;animation:duburst .9s ease-out forwards;pointer-events:none}
@keyframes duburst{0%{transform:translateX(-50%) scale(.2);opacity:0}25%{transform:translateX(-50%) scale(1.3);opacity:1}100%{transform:translateX(-50%) scale(1);opacity:0}}
.dutag{position:absolute;bottom:118px;font-family:var(--pf);font-size:13px;font-weight:800;letter-spacing:.06em;z-index:5;animation:floatup 1.3s ease-out forwards;pointer-events:none;white-space:nowrap}
.duclock{position:absolute;left:50%;top:6px;transform:translateX(-50%);width:54px;height:54px}
.duclock svg{width:100%;height:100%;transform:rotate(-90deg)}
.duclock circle{fill:none;stroke-width:4}
.duclock .bg{stroke:rgba(255,255,255,.08)}
.duclock .fg{stroke:var(--em);stroke-linecap:round}
.duclock .fg.low{stroke:#f87171}
.duclock b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:17px;font-family:var(--pf)}
.duhint{text-align:center;font-size:12.5px;color:rgba(255,255,255,.55);min-height:34px;line-height:1.4;display:flex;align-items:center;justify-content:center;padding:0 6px}
.duhint .y{color:#fde047}.duhint .e{color:var(--em)}.duhint .r{color:#f87171}
.dulog{text-align:center;font-size:15px;font-weight:700;font-family:var(--pf);min-height:22px}
.dulog.e{color:var(--em)}.dulog.r{color:#f87171}.dulog.y{color:#fde047}.dulog.b{color:#93c5fd}
.ducoach{background:#0f1d18;border:1px solid rgba(16,185,129,.35);border-radius:12px;padding:9px 12px;font-size:12px;line-height:1.5;color:rgba(255,255,255,.75);display:none;position:relative}
.ducoach.on{display:block}
.ducoach b{color:#fff}
.ducoach button{position:absolute;top:6px;right:8px;background:none;border:none;color:rgba(255,255,255,.4);font-size:15px;cursor:pointer}
.dumoves{display:flex;gap:8px;width:100%}
.dumoves .ga{display:flex;flex-direction:column;align-items:center;gap:3px;line-height:1.1;padding:11px 6px}
.dumoves .ga .ic{font-size:20px}
.dumoves .ga small{font-size:9.5px;font-weight:400;opacity:.7;white-space:nowrap}
.dumoves .ga.on{outline:2px solid var(--em);opacity:1}
.dumoves .ga.mc{background:rgba(253,224,71,.1);border-color:rgba(253,224,71,.35);color:#fde047}
.dumoves .ga.md{background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.35);color:#93c5fd}
.dumoves .ga.ma{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.4);color:#fca5a5}
.bjrules h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4);margin:16px 0 6px}
.bjrules p,.bjrules li{font-size:13px;line-height:1.55;color:rgba(255,255,255,.7)}
.bjrules ul{padding-left:18px;margin:0}
.bjrules table{width:100%;border-collapse:collapse;font-size:12.5px}
.bjrules td{padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);color:rgba(255,255,255,.7)}
.bjrules td:last-child{text-align:right;color:var(--gold);font-weight:700}
.bjtog{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;color:rgba(255,255,255,.75)}
.bjtog button{font-family:var(--pf);font-size:12px;font-weight:700;padding:6px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);cursor:pointer;min-width:58px}
.bjtog button.on{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.4);color:var(--em)}
`;

export function renderDuels(app, md) {
  const st0 = (md && md.state) || {};
  const MAXHP = st0.hp || 3, TURN = st0.turn_ms || 7000, MAXDEF = st0.max_defends || 2, SUDDEN = st0.sudden_round || 20;
  const oppName = esc((md && md.opponent) || 'Opponent');
  const fighter = (who, name) => `<div class="dufig ${who}" id="f_${who}">
      <div class="duname">${name}</div>
      <div class="duhearts" id="hp_${who}"></div>
      <div class="dumeters"><div class="ducharge" id="ch_${who}">⚡ empty</div><div class="dudef" id="df_${who}"></div></div>
      <div class="dubody" id="bd_${who}"><div class="h"></div><div class="b"></div></div>
      <div class="duhist" id="hi_${who}"></div>
    </div>`;
  const p = pvpShell(app, md, {
    game: 'duels', title: 'Duels', css: STYLE,
    stage: `<div class="pad dut" id="dut">
      <div class="dubar"><span class="duround" id="duRound">Round 1</span><span class="dusudden" id="duSudden" style="display:none">Sudden death · next hit wins</span><span class="sp"></span>
        <button class="duico" id="duSnd" aria-label="Sound"></button><button class="duico" id="duHelp" aria-label="Rules">?</button></div>
      <div class="duarena" id="duArena">
        ${fighter('me', 'You')}
        <div class="duclock" id="duClock"><svg viewBox="0 0 54 54"><circle class="bg" cx="27" cy="27" r="23"/><circle class="fg" id="duClockFg" cx="27" cy="27" r="23" stroke-dasharray="144.5" stroke-dashoffset="0"/></svg><b id="duClockN"></b></div>
        ${fighter('opp', oppName)}
      </div>
      <div class="dulog" id="duLog"></div>
      <div class="duhint" id="duHint"></div>
      <div class="ducoach" id="duCoach"><button id="duCoachX" aria-label="Close">×</button>
        <b>⚡ Charge</b> loads your shot · <b>💥 Attack</b> needs a charge and hits someone who's charging · <b>🛡 Defend</b> blocks it (max ${MAXDEF} in a row) · two attacks <b>cancel out</b>. Watch their ⚡ meter!</div>
    </div>${sheetHTML('shDuRules', 'How Duels works', RULES)}`,
  });
  if (!p) return;

  const S = {
    me: { hp: MAXHP, charge: 0, defends: 0, hist: [] },
    opp: { hp: MAXHP, charge: 0, defends: 0, hist: [] },
  };
  let round = 1, picked = null, result = null, over = false, clockRaf = 0;

  // ── painting ───────────────────────────────────────────────────────────────
  function paint(breakWho) {
    for (const who of ['me', 'opp']) {
      const f = S[who];
      $(`hp_${who}`).innerHTML = Array.from({ length: MAXHP }, (_, i) => `<i class="${i < f.hp ? '' : i === f.hp && breakWho === who ? 'break' : 'gone'}">♥</i>`).join('');
      const ch = $(`ch_${who}`); ch.textContent = f.charge ? '⚡ charged' : '⚡ empty'; ch.classList.toggle('on', !!f.charge);
      $(`bd_${who}`).classList.toggle('armed', !!f.charge);
      $(`df_${who}`).innerHTML = Array.from({ length: MAXDEF }, (_, i) => `<i class="${i < f.defends ? 'on' : ''}">🛡</i>`).join('');
      $(`df_${who}`).title = `${f.defends}/${MAXDEF} defends in a row`;
      $(`hi_${who}`).innerHTML = f.hist.slice(0, 5).map((m) => `<span title="${LABEL[m]}">${ICON[m]}</span>`).join('');
    }
  }
  const legal = (m) => (m === 'attack' ? S.me.charge >= 1 : m === 'charge' ? S.me.charge < 1 : S.me.defends < MAXDEF);
  function hint() {
    const h = $('duHint');
    if (picked) { h.innerHTML = `Locked in: <b>${ICON[picked]} ${LABEL[picked]}</b> · waiting for ${oppName}`; return; }
    const parts = [];
    if (S.opp.charge) parts.push(`<span class="y">⚡ ${oppName} is charged</span> — they can hit you if you Charge. Defend is safe.`);
    else parts.push(`<span class="e">${oppName} has no charge</span> — they can't hit you this round.`);
    if (S.me.defends >= MAXDEF) parts.push('<span class="r">You defended twice — Charge or Attack now.</span>');
    else if (S.me.charge && S.opp.charge) parts.push('If you both attack, the shots cancel out.');
    h.innerHTML = `<span>${parts.join(' ')}</span>`;
  }
  function buttons() {
    const sub = {
      charge: legal('charge') ? 'load your shot' : 'already charged',
      defend: legal('defend') ? `blocks attacks · ${MAXDEF - S.me.defends} left` : `max ${MAXDEF} in a row`,
      attack: legal('attack') ? 'hits if they charge' : 'needs a charge',
    };
    const btn = (m, cls) => `<button class="ga ${cls}" data-m="${m}"${legal(m) ? '' : ' disabled'}><span class="ic">${ICON[m]}</span>${LABEL[m]}<small>${sub[m]}</small></button>`;
    const a = p.shell.actions(`<div class="dumoves">${btn('charge', 'mc')}${btn('defend', 'md')}${btn('attack', 'ma')}</div>`);
    a.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      if (picked || over || !legal(b.dataset.m)) return;
      picked = b.dataset.m; p.move(picked); sfx.chip();
      a.querySelectorAll('[data-m]').forEach((x) => { x.disabled = x !== b; x.classList.toggle('on', x === b); });
      showPick('me', picked); hint();
    }));
  }
  function showPick(who, m, wait) {
    const f = $(`f_${who}`); f.querySelector('.dupick')?.remove();
    if (!m && !wait) return;
    const e = document.createElement('div'); e.className = `dupick${wait ? ' wait' : ''}`;
    e.textContent = wait ? 'ready' : ICON[m];
    f.querySelector('.dubody').appendChild(e);
  }

  // ── round clock ────────────────────────────────────────────────────────────
  function clock(ms) {
    cancelAnimationFrame(clockRaf);
    const fg = $('duClockFg'), n = $('duClockN'), c = $('duClock');
    if (!ms) { c.style.visibility = 'hidden'; return; }
    c.style.visibility = 'visible';
    const end = performance.now() + ms;
    const tick = () => {
      if (!fg.isConnected) return;
      const left = Math.max(0, end - performance.now());
      fg.setAttribute('stroke-dashoffset', String(144.5 * (1 - left / ms)));
      fg.classList.toggle('low', left < 2500);
      n.textContent = Math.ceil(left / 1000);
      if (left > 0) clockRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function newRound(ms) {
    picked = null;
    showPick('me', null); showPick('opp', null);
    $('duRound').textContent = `Round ${round}`;
    $('duSudden').style.display = round >= SUDDEN ? '' : 'none';
    buttons(); hint(); clock(ms); p.timer(ms);
  }

  // ── effects ────────────────────────────────────────────────────────────────
  function centerOf(id) {
    const a = $('duArena').getBoundingClientRect(), r = $(id).getBoundingClientRect();
    return r.left - a.left + r.width / 2;
  }
  function projectile(fromWho, toX, done) {
    const e = document.createElement('div'); e.className = 'duproj';
    const x0 = centerOf(`bd_${fromWho}`);
    e.style.left = `${x0 - 9}px`;
    $('duArena').appendChild(e);
    e.animate([{ left: `${x0 - 9}px` }, { left: `${toX - 9}px` }], { duration: 380, easing: 'cubic-bezier(.4,0,.9,.6)', fill: 'forwards' })
      .onfinish = () => { done && done(e); };
    return e;
  }
  function tag(who, text, color) {
    const e = document.createElement('div'); e.className = 'dutag'; e.textContent = text; e.style.color = color;
    const x = centerOf(`bd_${who}`); e.style.left = `${x}px`; e.style.transform = 'translateX(-50%)';
    $('duArena').appendChild(e); later(1400, () => e.remove());
  }
  function shield(who) {
    const e = document.createElement('div'); e.className = 'dushield';
    $(`bd_${who}`).appendChild(e); later(1100, () => e.remove());
  }
  function burst(text) {
    const e = document.createElement('div'); e.className = 'duburst'; e.textContent = text;
    $('duArena').appendChild(e); later(950, () => e.remove());
  }
  function hurt(who) {
    const b = $(`bd_${who}`); b.classList.remove('hurt'); void b.offsetWidth; b.classList.add('hurt');
    later(500, () => b.classList.remove('hurt'));
  }
  function charging(who) {
    const b = $(`bd_${who}`); b.classList.remove('charging'); void b.offsetWidth; b.classList.add('charging');
    later(900, () => b.classList.remove('charging'));
  }
  function log(text, cls = '') { const l = $('duLog'); l.textContent = text; l.className = `dulog ${cls}`; }

  function play(r) {
    const mine = r.your_move, theirs = r.opp_move;
    const auto = !picked;
    showPick('me', mine); showPick('opp', theirs);
    S.me.hist.unshift(mine); S.opp.hist.unshift(theirs);
    clock(0); p.timer(0); p.shell.actions('');
    $('duHint').innerHTML = '';

    // set-up effects (charge glow, shields) right away
    later(250, () => {
      if (mine === 'charge') { charging('me'); sfx.flip(); }
      if (theirs === 'charge') { charging('opp'); if (mine !== 'charge') sfx.flip(); }
      if (mine === 'defend') shield('me');
      if (theirs === 'defend') shield('opp');
    });

    const meX = () => centerOf('bd_me'), oppX = () => centerOf('bd_opp');
    const lostMe = !!r.you_hit, lostOpp = !!r.opp_hit;
    let text = 'Nothing landed', cls = '';
    later(500, () => {
      if (r.clash) {
        // both shots meet in the middle and cancel out
        sfx.clack();
        const mid = (meX() + oppX()) / 2;
        projectile('me', mid, (e) => e.remove()); projectile('opp', mid, (e) => { e.remove(); burst('💥'); sfx.settle(); });
        text = 'Shots collided — both attacks cancel out!'; cls = 'y';
      } else {
        if (mine === 'attack') {
          sfx.clack();
          if (theirs === 'defend') { projectile('me', oppX() - 40, (e) => { e.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-60px,-40px)' }], { duration: 400, fill: 'forwards' }).onfinish = () => e.remove(); tag('opp', 'BLOCKED', '#93c5fd'); sfx.chip(); }); text = `${oppName} blocked your shot`; cls = 'b'; }
          else projectile('me', oppX(), (e) => { e.remove(); });
        }
        if (theirs === 'attack') {
          if (mine !== 'attack') sfx.clack();
          if (mine === 'defend') { projectile('opp', meX() + 40, (e) => { e.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(60px,-40px)' }], { duration: 400, fill: 'forwards' }).onfinish = () => e.remove(); tag('me', 'BLOCKED', '#93c5fd'); sfx.chip(); }); text = 'You blocked their shot!'; cls = 'b'; }
          else projectile('opp', meX(), (e) => { e.remove(); });
        }
        if (lostOpp) { text = `Hit! ${oppName} was charging`; cls = 'e'; }
        if (lostMe) { text = 'You got hit while charging'; cls = 'r'; }
      }
    });

    later(900, () => {
      if (lostOpp) { hurt('opp'); tag('opp', '−1 ♥', '#f87171'); sfx.bust(); }
      if (lostMe) { hurt('me'); tag('me', '−1 ♥', '#f87171'); sfx.bust(); }
      const breakWho = lostMe ? 'me' : lostOpp ? 'opp' : null;
      Object.assign(S.me, { hp: r.your_hp, charge: r.your_charge, defends: r.your_defends });
      Object.assign(S.opp, { hp: r.opp_hp, charge: r.opp_charge, defends: r.opp_defends });
      paint(breakWho);
      if (!r.clash && mine === 'charge' && theirs === 'charge') text = 'Both charged up';
      else if (!r.clash && !lostMe && !lostOpp && text === 'Nothing landed' && (mine === 'charge' || theirs === 'charge')) text = mine === 'charge' ? 'You charged up ⚡' : `${oppName} charged up ⚡`;
      log(text + (auto ? ` (you ran out of time — auto ${LABEL[mine]})` : ''), cls);
      if (r.sudden_death && !(S.me.hp <= 0 || S.opp.hp <= 0)) later(900, () => log('Sudden death — both down to 1 life, next hit wins', 'r'));
      if (S.me.hp <= 0 || S.opp.hp <= 0) { over = true; if (result) end(); return; }
    });

    round = r.next_round || round + 1;
    // server starts the next clock 1.4s after the result
    later(1400, () => { if (!over) newRound((r.turn_ms || TURN) - 100); });
  }

  const end = () => later(1100, () => p.finish({ won: result.you_won, seed: result.seed, sub: result.you_won ? `${md.opponent} is out of lives` : 'You ran out of lives' }));

  on(socket, {
    'pvp:opponent_moved': () => { if (!$('f_opp').querySelector('.dupick')) showPick('opp', null, true); },
    'pvp:round_result': (r) => play(r),
    'pvp:result': (r) => { result = r; if (over) end(); },
  });

  // ── wiring ─────────────────────────────────────────────────────────────────
  const paintSound = () => { $('duSnd').textContent = isMuted() ? '🔇' : '🔊'; };
  $('duSnd').addEventListener('click', () => { setMuted(!isMuted()); paintSound(); });
  $('duHelp').addEventListener('click', () => {
    const paintT = () => { $('duSndTog').textContent = isMuted() ? 'Off' : 'On'; $('duSndTog').classList.toggle('on', !isMuted()); };
    paintT(); $('duSndTog').onclick = () => { setMuted(!isMuted()); paintT(); paintSound(); };
    openSheet('shDuRules');
  });
  if ((pref.get('seen', 0) || 0) < 3) { $('duCoach').classList.add('on'); pref.set('seen', (pref.get('seen', 0) || 0) + 1); }
  $('duCoachX').addEventListener('click', () => { $('duCoach').classList.remove('on'); pref.set('seen', 3); });

  paintSound(); paint(); log('Pick your move', '');
  newRound(TURN);
}

import socket from '../socket.js';
import { store } from '../store.js';
import { $, fmt, toast, later, onLeave, sheetHTML, openSheet, closeSheets } from '../ui/core.js';
import { gameShell, on, syncBalance } from '../games/shell.js';
import { cardHTML } from '../games/draw.js';
import { isBigWin } from '../cosmeticFx.js';
import { sfx, isMuted, setMuted } from '../games/sfx.js';
import { handInfo, totalLabel, bustChance, basicStrategy } from '../games/bjStrategy.js';

const STYLE = `
.bjt{position:relative;padding:44px 14px 14px;gap:10px}
.bjbar{position:absolute;top:10px;left:12px;right:12px;display:flex;align-items:center;gap:7px;z-index:4}
.bjstreak{font-size:11px;font-weight:700;letter-spacing:.04em;color:rgba(255,255,255,.3);padding:4px 9px;border-radius:10px;border:1px solid transparent;transition:all .3s}
.bjstreak.hot{color:#fbbf24;border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.08)}
.bjstreak.fire{color:#fb923c;border-color:rgba(251,146,60,.45);background:rgba(251,146,60,.12);box-shadow:0 0 18px rgba(251,146,60,.25);animation:bjfire 1.2s ease-in-out infinite}
@keyframes bjfire{50%{box-shadow:0 0 28px rgba(251,146,60,.45)}}
.bjstreak.bump{animation:bjpop .45s cubic-bezier(.2,1.6,.4,1)}
.bjsp{flex:1}
.bjico{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);font-family:var(--pf);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center}
.bjshoe{position:absolute;top:50px;right:14px;width:34px;height:48px;border-radius:6px;background:#0e1a16;border:1px solid rgba(16,185,129,.4);background-image:repeating-linear-gradient(135deg,rgba(16,185,129,.14) 0 5px,transparent 5px 10px);box-shadow:3px 3px 0 #0b1411,6px 6px 0 #09110e,0 8px 20px rgba(0,0,0,.5);z-index:1}
.bjt .handlab b{display:inline-block;transition:color .2s}
.bjt .handlab b.pop{animation:bjpop .32s cubic-bezier(.2,1.6,.4,1)}
.bjt .handlab b.gold{color:var(--gold);text-shadow:0 0 14px rgba(212,175,55,.6)}
.bjt .handlab b.bust{color:#f87171}
@keyframes bjpop{40%{transform:scale(1.35)}}
.pc2.bjfly{animation:bjfly .34s cubic-bezier(.2,.9,.3,1) both}
@keyframes bjfly{from{transform:translate(var(--dx),var(--dy)) rotate(-24deg) scale(.55);opacity:.3}}
.pc2.still{animation:none}
.pc2.bjflipout{animation:bjfo .16s ease-in forwards}
.pc2.bjflipin{animation:bjfi .2s ease-out}
@keyframes bjfo{to{transform:perspective(500px) rotateY(90deg)}}
@keyframes bjfi{from{transform:perspective(500px) rotateY(-90deg)}}
.cardrow.shake{animation:bjshake .42s}
.cardrow.dead .pc2{filter:grayscale(.7) brightness(.55);transition:filter .4s}
.cardrow.glow .pc2{box-shadow:0 0 0 2px rgba(212,175,55,.8),0 0 26px rgba(212,175,55,.45)}
@keyframes bjshake{20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}
.bjhands{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.bjhand{display:flex;flex-direction:column;gap:5px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid transparent;transition:border-color .2s,opacity .2s}
.bjhand.on{border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.04)}
.bjhand.wait{opacity:.55}
.bjhand .cardrow{min-height:90px}
.bjodds{font-size:10px;color:rgba(255,255,255,.3);min-height:13px}
.bjodds.hi{color:#fca5a5}
.bjout{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;padding:3px 9px;border-radius:9px;animation:bjpop .4s cubic-bezier(.2,1.6,.4,1)}
.bjout.win{color:var(--em);background:rgba(16,185,129,.12)}
.bjout.bj{color:var(--gold);background:rgba(212,175,55,.14)}
.bjout.lose{color:#f87171;background:rgba(239,68,68,.1)}
.bjout.push{color:rgba(255,255,255,.6);background:rgba(255,255,255,.06)}
.bjmsg{text-align:center;font-size:12.5px;color:rgba(255,255,255,.45);font-style:italic;min-height:18px;transition:opacity .2s}
.bjmsg.em{color:var(--em);font-style:normal;font-weight:700}
.bjmsg.gold{color:var(--gold);font-style:normal;font-weight:700}
.bjmsg.red{color:#f87171;font-style:normal}
.bjside{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;min-height:0}
.bjside span{font-size:10.5px;padding:3px 9px;border-radius:9px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.35);animation:feedIn .3s ease-out}
.bjside span.hit{background:rgba(212,175,55,.15);color:var(--gold);border:1px solid rgba(212,175,55,.35)}
.bjchips{display:flex;align-items:center;justify-content:center;gap:9px;min-height:34px;position:relative}
.bjstack{position:relative;width:30px;height:30px;transition:transform .5s cubic-bezier(.5,0,.75,0),opacity .5s}
.bjstack i{position:absolute;left:0;width:30px;height:30px;border-radius:50%;border:3px dashed rgba(255,255,255,.75);box-shadow:0 2px 0 rgba(0,0,0,.45),inset 0 0 0 3px rgba(0,0,0,.18)}
.bjstack i.new{animation:bjdrop .3s cubic-bezier(.3,1.5,.5,1)}
@keyframes bjdrop{from{transform:translateY(-26px);opacity:0}}
.bjstack.lost{transform:translateY(-240px) scale(.6);opacity:0}
.bjstack.won{animation:bjwonpulse .8s ease-out}
@keyframes bjwonpulse{30%{transform:scale(1.25);filter:drop-shadow(0 0 12px rgba(212,175,55,.8))}}
.bjstakelab{font-size:11px;color:rgba(255,255,255,.4);font-weight:700}
.bjfchip{position:absolute;width:22px;height:22px;border-radius:50%;border:3px dashed rgba(255,255,255,.8);pointer-events:none;z-index:6;animation:bjfchip .55s cubic-bezier(.3,.7,.4,1) both}
@keyframes bjfchip{from{transform:translate(var(--dx),var(--dy)) scale(.7);opacity:0}30%{opacity:1}}
.bjcoach{position:relative;margin:0 auto;max-width:400px;width:100%;background:#0f1d18;border:1px solid rgba(16,185,129,.35);border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.75);display:none;animation:feedIn .25s ease-out}
.bjcoach.on{display:block}
.bjcoach b{color:var(--em)}
.bjcoach .row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.bjcoach button{font-family:var(--pf);font-size:11.5px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);cursor:pointer}
.bjcoach button.go{background:var(--em);color:#03150e;border-color:transparent}
.bjfocus{position:relative;z-index:5;border-radius:12px;box-shadow:0 0 0 2px var(--em),0 0 30px rgba(16,185,129,.35)}
#gactions.bjfocus{border-radius:14px}
.bjhintbtn{position:absolute;right:12px;bottom:10px;z-index:4;font-family:var(--pf);font-size:11.5px;font-weight:700;padding:7px 12px;border-radius:18px;border:1px solid rgba(212,175,55,.32);background:rgba(212,175,55,.1);color:var(--gold);cursor:pointer;display:none}
.bjhintbtn.on{display:block}
#gactions .ga{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.1}
#gactions .ga small{font-size:9.5px;font-weight:400;opacity:.65;letter-spacing:.02em;white-space:nowrap}
#gactions .ga.bjsuggest{box-shadow:0 0 0 2px var(--gold),0 0 22px rgba(212,175,55,.45);animation:bjnudge 1s ease-in-out infinite}
@keyframes bjnudge{50%{transform:translateY(-3px)}}
.bjsidebox{display:flex;flex-direction:column;gap:8px;text-align:left;padding-top:4px;border-top:1px solid rgba(255,255,255,.06)}
.bjsidebox .row{display:flex;gap:7px;align-items:center}
.bjsidebox .chip small{display:block;font-size:9px;font-weight:400;opacity:.6;margin-top:2px}
.bjsidebox .lbl{font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.28);flex:1}
.bjsidebox .amt .chip{padding:6px 0;font-size:11px}
.bjrules h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4);margin:16px 0 6px}
.bjrules p,.bjrules li{font-size:13px;line-height:1.55;color:rgba(255,255,255,.7)}
.bjrules ul{padding-left:18px;margin:0}
.bjrules table{width:100%;border-collapse:collapse;font-size:12.5px}
.bjrules td{padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);color:rgba(255,255,255,.7)}
.bjrules td:last-child{text-align:right;color:var(--gold);font-weight:700}
.bjtog{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;color:rgba(255,255,255,.75)}
.bjtog button{font-family:var(--pf);font-size:12px;font-weight:700;padding:6px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);cursor:pointer;min-width:58px}
.bjtog button.on{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.4);color:var(--em)}
@media(min-width:900px){.bjshoe{width:44px;height:62px}}
`;

const RULES = `<div class="bjrules">
  <h3>The goal</h3>
  <p>Get closer to 21 than the dealer without going over. Going over is a <b>bust</b> and loses straight away — even if the dealer busts later.</p>
  <h3>Card values</h3>
  <ul><li>2–10 count as their number</li><li>J, Q, K count as 10</li><li>Ace counts as 1 <i>or</i> 11 — whichever helps. A hand with an Ace counted as 11 is <b>soft</b> and shows two totals, like 7 / 17.</li></ul>
  <h3>Your moves</h3>
  <ul><li><b>Hit</b> — take another card</li><li><b>Stand</b> — keep your total, dealer plays</li><li><b>Double</b> — double your bet on your first two cards and get exactly one more card</li><li><b>Split</b> — two cards of the same rank become two hands, each with its own bet (up to 3 hands)</li></ul>
  <h3>The dealer</h3>
  <p>The dealer has no choices: they draw until 17 or more, and also draw on a soft 17. Their second card stays face down until you're done.</p>
  <h3>Payouts</h3>
  <table><tr><td>Blackjack (Ace + 10-card)</td><td>3 : 2</td></tr><tr><td>Win</td><td>1 : 1</td></tr><tr><td>Push (same total)</td><td>bet back</td></tr></table>
  <h3>Side bets</h3>
  <p>Optional extra bets on your first two cards, paid instantly.</p>
  <table><tr><td>Perfect Pairs — same rank &amp; suit</td><td>25 : 1</td></tr><tr><td>Colored pair — same rank &amp; color</td><td>12 : 1</td></tr><tr><td>Mixed pair</td><td>6 : 1</td></tr></table>
  <p style="margin-top:8px">21+3 uses your two cards plus the dealer's up card, like a poker hand:</p>
  <table><tr><td>Suited three of a kind</td><td>100 : 1</td></tr><tr><td>Straight flush</td><td>40 : 1</td></tr><tr><td>Three of a kind</td><td>30 : 1</td></tr><tr><td>Straight</td><td>10 : 1</td></tr><tr><td>Flush</td><td>5 : 1</td></tr></table>
  <h3>Settings</h3>
  <div class="bjtog"><span>Beginner tips<br><small style="color:rgba(255,255,255,.35)">Button explanations and bust odds</small></span><button id="bjTipsTog"></button></div>
  <div class="bjtog"><span>Sound</span><button id="bjSndTog"></button></div>
  <div class="bjtog"><span>Tutorial</span><button id="bjTourAgain">Replay</button></div>
</div>`;

const PAIR_NAMES = { perfect: 'Perfect pair', colored: 'Colored pair', mixed: 'Mixed pair' };
const T3_NAMES = { suited_trips: 'Suited trips', straight_flush: 'Straight flush', trips: 'Three of a kind', straight: 'Straight', flush: 'Flush' };

// tiny per-browser prefs
const pref = {
  get(k, d) { try { const v = localStorage.getItem(`alp_bj_${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`alp_bj_${k}`, JSON.stringify(v)); } catch { /* storage off */ } },
};

export function renderBlackjack(app) {
  const shell = gameShell(app, {
    id: 'blackjack', title: 'Blackjack', css: STYLE,
    stage: `<div class="pad bjt" id="bjt">
      <div class="bjbar"><div class="bjstreak" id="bjStreak"></div><div class="bjsp"></div>
        <button class="bjico" id="bjSnd" aria-label="Sound"></button><button class="bjico" id="bjHelp" aria-label="Rules">?</button></div>
      <div class="bjshoe" id="bjShoe"></div>
      <div id="bjDealer"><div class="handlab">Dealer<b id="bjdv"></b></div><div class="cardrow" id="bjd"></div></div>
      <div class="bjmsg" id="bjMsg"></div>
      <div class="bjside" id="bjSide"></div>
      <div id="bjYou"><div class="handlab">You</div><div class="bjhands" id="bjp"></div></div>
      <div class="bjchips" id="bjChips"></div>
      <div class="bjcoach" id="bjCoach"></div>
      <button class="bjhintbtn" id="bjHint">💡 Hint</button>
    </div>${sheetHTML('shBjRules', 'How to play', RULES)}`,
  });

  // ── state ──────────────────────────────────────────────────────────────────
  let bet = 0;          // main bet per hand
  let staked = 0;       // main stake on the table (doubles + splits included)
  let sideStake = 0;    // side bets placed this round
  let live = false;     // player may act
  let busy = false;     // waiting on the server
  let last = null;      // last blackjack:state
  let sidesShown = false;
  let tips = pref.get('tips', true);
  let streak = Number(pref.get('streak', 0)) || 0;
  const side = { pp: pref.get('pp', false), t3: pref.get('t3', false), pct: pref.get('sidepct', 10) };
  const vis = { dealer: [], hands: [] };   // cards currently on screen

  let chain = Promise.resolve();
  const enqueue = (fn) => { chain = chain.then(fn).catch((e) => console.error('[bj]', e)); return chain; };
  const sleep = (ms) => new Promise((res) => later(ms, res));

  const bal = () => Number(store.ccBalance) || 0;
  const sideAmt = (b) => Math.max(10, Math.min(b, Math.round(b * side.pct / 100)));
  const sidesFor = (b) => ({ pp: side.pp ? sideAmt(b) : 0, t3: side.t3 ? sideAmt(b) : 0 });

  // ── small UI bits ──────────────────────────────────────────────────────────
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function msg(text, kind = '') { const m = $('bjMsg'); m.textContent = text; m.className = `bjmsg ${kind}`; }

  function paintStreak(bump) {
    const s = $('bjStreak');
    s.textContent = streak >= 2 ? `🔥 ${streak} win streak` : streak === 1 ? '1 win' : '';
    s.className = `bjstreak${streak >= 5 ? ' fire' : streak >= 3 ? ' hot' : ''}`;
    if (bump && streak >= 2) restart(s, 'bump');
  }
  function paintSound() { $('bjSnd').textContent = isMuted() ? '🔇' : '🔊'; }

  // chips
  function paintChips() {
    const box = $('bjChips');
    if (!staked) { box.innerHTML = ''; return; }
    const n = Math.min(7, 1 + Math.floor(Math.log2(Math.max(1, staked / Math.max(1, bet))) * 2));
    const cols = ['#10b981', '#D4AF37', '#ef4444', '#3b82f6', '#a855f7', '#10b981', '#D4AF37'];
    let stack = box.querySelector('.bjstack');
    if (!stack) { box.innerHTML = '<div class="bjstack"></div><div class="bjstakelab"></div>'; stack = box.querySelector('.bjstack'); }
    const had = stack.children.length;
    stack.innerHTML = Array.from({ length: n }, (_, i) => `<i style="bottom:${i * 4}px;background:${cols[i]}"${i >= had ? ' class="new"' : ''}></i>`).join('');
    stack.style.height = `${30 + (n - 1) * 4}px`;
    box.querySelector('.bjstakelab').textContent = `${fmt(staked + sideStake)} CC on the table`;
  }
  function flyChips(count, from) {
    const host = $('bjt'), stack = $('bjChips').querySelector('.bjstack');
    if (!stack) return;
    const hr = host.getBoundingClientRect(), sr = stack.getBoundingClientRect(), fr = from.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const c = document.createElement('div');
      c.className = 'bjfchip';
      c.style.left = `${sr.left - hr.left + 4 + (i % 3) * 3}px`;
      c.style.top = `${sr.top - hr.top + 4 - i * 2}px`;
      c.style.background = ['#D4AF37', '#10b981', '#D4AF37'][i % 3];
      c.style.setProperty('--dx', `${fr.left + fr.width / 2 - sr.left - 15 + (i - count / 2) * 14}px`);
      c.style.setProperty('--dy', `${fr.top + fr.height / 2 - sr.top}px`);
      c.style.animationDelay = `${i * 70}ms`;
      host.appendChild(c);
      later(700 + i * 70, () => c.remove());
    }
  }

  // ── cards ──────────────────────────────────────────────────────────────────
  function cardEl(card, cls) {
    const t = document.createElement('div');
    t.innerHTML = cardHTML(card);
    const el = t.firstElementChild;
    if (cls) el.classList.add(cls);
    return el;
  }
  const same = (a, b) => a && b && a.rank === b.rank && a.suit === b.suit;
  const prefix = (a, b) => { let i = 0; while (b && i < a.length && i < b.length && same(a[i], b[i])) i++; return i; };

  async function fly(row, card) {
    const el = cardEl(card, 'bjfly');
    row.appendChild(el);
    const s = $('bjShoe').getBoundingClientRect(), r = el.getBoundingClientRect();
    el.style.setProperty('--dx', `${s.left - r.left}px`);
    el.style.setProperty('--dy', `${s.top - r.top}px`);
    sfx.card();
    await sleep(230);
  }

  function setTotal(el, hand, { quiet } = {}) {
    const txt = totalLabel(hand), { total } = handInfo(hand);
    if (el.textContent !== txt) { el.textContent = txt; if (!quiet) restart(el, 'pop'); }
    el.classList.toggle('gold', total === 21);
    el.classList.toggle('bust', total > 21);
  }

  // dealer
  const dealerTotal = (quiet) => setTotal($('bjdv'), vis.dealer, { quiet });
  async function dealDealer(card) {
    await fly($('bjd'), card);
    vis.dealer.push(card);
    dealerTotal();
    if (card.rank !== '?' && handInfo(vis.dealer).total > 21) { restart($('bjd'), 'shake'); sfx.bust(); }
  }
  async function flipHole(card) {
    const old = $('bjd').children[1];
    if (!old) return dealDealer(card);
    old.classList.add('bjflipout');
    sfx.flip();
    await sleep(160);
    old.replaceWith(cardEl(card, 'bjflipin'));
    vis.dealer[1] = card;
    dealerTotal();
    await sleep(220);
  }

  // player
  const handBox = (i) => $('bjp').children[i];
  function buildHands(hands) {
    $('bjp').innerHTML = hands.map(() => `<div class="bjhand"><div class="cardrow"></div>
      <div class="handlab"><b></b></div><div class="bjodds"></div></div>`).join('');
    hands.forEach((h, i) => {
      const row = handBox(i).querySelector('.cardrow');
      h.forEach((c) => row.appendChild(cardEl(c, 'still')));
      setTotal(handBox(i).querySelector('.handlab b'), h, { quiet: true });
    });
  }
  async function dealPlayer(i, card) {
    const box = handBox(i), row = box.querySelector('.cardrow');
    await fly(row, card);
    vis.hands[i].push(card);
    setTotal(box.querySelector('.handlab b'), vis.hands[i]);
    const { total } = handInfo(vis.hands[i]);
    if (total > 21) { restart(row, 'shake'); row.classList.add('dead'); sfx.bust(); await sleep(250); }
    else if (total === 21) { row.classList.add('glow'); sfx.pop(); }
  }

  /** Bring the player's hands on screen up to `target`, dealing only cards that are new. */
  async function syncPlayer(target, active = 0) {
    const prev = vis.hands;
    if (target.length !== prev.length || target.some((h, i) => prefix(h, prev[i]) < (prev[i] || []).length)) {
      // a split (or a resumed table): rebuild, keeping cards that are still in place
      const split = target.length > prev.length && prev[active];
      const prevFor = (i) => (!split ? prev[i] : i <= active ? prev[i] : i === active + 1 ? [prev[active][1]] : prev[i - 1]);
      vis.hands = target.map((h, i) => h.slice(0, prefix(h, prevFor(i))));
      buildHands(vis.hands);
      if (split) sfx.chip();
    }
    for (let i = 0; i < target.length; i++) {
      for (let k = vis.hands[i].length; k < target[i].length; k++) await dealPlayer(i, target[i][k]);
    }
  }

  async function openingDeal(hands, dealer) {
    vis.dealer = []; vis.hands = hands.map(() => []);
    $('bjd').innerHTML = ''; $('bjdv').textContent = '';
    buildHands(vis.hands);
    const h = hands[0];
    if (h.length >= 2) {
      await dealPlayer(0, h[0]); await dealDealer(dealer[0]);
      await dealPlayer(0, h[1]); await dealDealer(dealer[1]);
    } else { await dealDealer(dealer[0]); await dealDealer(dealer[1]); }
    await syncPlayer(hands);
  }

  function markActive(active, done) {
    [...$('bjp').children].forEach((b, i) => {
      const many = vis.hands.length > 1;
      b.classList.toggle('on', !done && many && i === active);
      b.classList.toggle('wait', !done && many && i > active);
    });
  }

  function paintOdds(active) {
    [...$('bjp').children].forEach((b, i) => {
      const o = b.querySelector('.bjodds');
      const p = live && tips && i === active ? bustChance(vis.hands[i]) : 0;
      o.textContent = live && tips && i === active ? (p > 0 ? `Hit: ${Math.round(p * 100)}% bust risk` : 'Hit: can\'t bust') : '';
      o.classList.toggle('hi', p >= 0.5);
    });
  }

  function showSides(list) {
    if (sidesShown || !list || !list.length) return;
    sidesShown = true;
    $('bjSide').innerHTML = list.map((s) => {
      const name = s.key === 'pp' ? PAIR_NAMES[s.hit] : T3_NAMES[s.hit];
      return s.hit ? `<span class="hit">${s.name} · ${name} +${fmt(s.payout - s.bet)}</span>` : `<span>${s.name} · no hit</span>`;
    }).join('');
    if (list.some((s) => s.hit)) { sfx.side(); toast(`${list.filter((s) => s.hit).map((s) => s.name).join(' + ')} hit!`, 'gold'); }
  }

  // ── controls ───────────────────────────────────────────────────────────────
  function controls(st) {
    const hand = st.player_hands[st.active_hand];
    const afford = bal() >= bet;
    const canD = st.can_double && afford, canS = st.can_split && afford;
    const why = (ok, can, fallback) => (ok ? '' : can ? 'low balance' : fallback);
    const b = (a, label, sub, cls = '', dis = false) => `<button class="ga ${cls}" data-a="${a}"${dis ? ' disabled' : ''}>${label}${tips && sub ? `<small>${sub}</small>` : ''}</button>`;
    const showD = st.can_double || tips, showS = st.can_split || tips;
    shell.actions(
      b('hit', 'Hit', '+1 card')
      + b('stand', 'Stand', 'end turn', 'ga-em')
      + (showD ? b('double', 'Double', canD ? '2× · 1 card' : why(canD, st.can_double, '2 cards only'), 'ga-gold', !canD) : '')
      + (showS ? b('split', 'Split', canS ? '2 hands' : why(canS, st.can_split, hand.length === 2 ? 'needs pair' : '2 cards only'), '', !canS) : ''),
    ).querySelectorAll('[data-a]').forEach((btn) => btn.addEventListener('click', () => act(btn.dataset.a)));
    $('bjHint').classList.add('on');
  }
  function lock() {
    document.querySelectorAll('#gactions .ga').forEach((btn) => { btn.disabled = true; btn.classList.remove('bjsuggest'); });
    $('bjHint').classList.remove('on');
  }

  function act(a) {
    if (!live || busy) return;
    busy = true; live = false;
    if (tourStep >= 0) tour(TOUR.length);
    lock(); coach(null); paintOdds(-1);
    if (a === 'double' || a === 'split') { staked += bet; paintChips(); sfx.chip(); }
    socket.emit('blackjack:action', { action: a });
  }

  function hint() {
    if (!live || !last) return;
    const st = last, hand = st.player_hands[st.active_hand], up = st.dealer_hand[0];
    const r = basicStrategy(hand, up, { canDouble: st.can_double && bal() >= bet, canSplit: st.can_split && bal() >= bet });
    const name = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split' }[r.move];
    coach(`Pro move: <b>${name}</b>. ${r.why}.`);
    document.querySelectorAll('#gactions .ga').forEach((btn) => btn.classList.toggle('bjsuggest', btn.dataset.a === r.move));
  }

  // ── coach / tutorial ───────────────────────────────────────────────────────
  let tourStep = -1;
  const TOUR = [
    ['bjDealer', 'This is the <b>dealer</b>. One of their cards stays face down until you finish your turn.'],
    ['bjYou', 'This is <b>your hand</b>. Beat the dealer by getting closer to 21 — but go over 21 and you <b>bust</b>.'],
    ['gactions', '<b>Hit</b> takes another card, <b>Stand</b> ends your turn. <b>Double</b> and <b>Split</b> are extra moves on your first two cards.'],
    ['bjHint', 'Not sure? Tap <b>Hint</b> any time to see what a pro would do. The <b>?</b> up top has all the rules.'],
  ];
  function clearFocus() { document.querySelectorAll('.bjfocus').forEach((e) => e.classList.remove('bjfocus')); }
  function coach(html, buttons) {
    const c = $('bjCoach');
    clearFocus();
    if (!html) { c.classList.remove('on'); c.innerHTML = ''; return; }
    c.innerHTML = html + (buttons ? `<div class="row">${buttons}</div>` : '');
    c.classList.add('on');
  }
  function tour(step) {
    tourStep = step;
    if (step >= TOUR.length) { tourStep = -1; pref.set('tour', true); coach(null); return; }
    const [target, text] = TOUR[step];
    coach(`${text}`, `<button data-t="skip">Skip</button><button class="go" data-t="next">${step === TOUR.length - 1 ? 'Got it' : 'Next'}</button>`);
    $(target)?.classList.add('bjfocus');
    $('bjCoach').querySelector('[data-t="next"]').onclick = () => tour(step + 1);
    $('bjCoach').querySelector('[data-t="skip"]').onclick = () => tour(TOUR.length);
  }

  // ── round flow ─────────────────────────────────────────────────────────────
  function resetTable() {
    vis.dealer = []; vis.hands = []; sidesShown = false; last = null;
    $('bjd').innerHTML = ''; $('bjdv').textContent = ''; $('bjp').innerHTML = '';
    $('bjSide').innerHTML = ''; msg('');
    coach(null);
    $('bjChips').innerHTML = '';
  }

  function deal(b) {
    const sides = sidesFor(b);
    const need = b + sides.pp + sides.t3;
    if (need > bal()) throw new Error(sides.pp || sides.t3 ? 'Not enough for the bet plus side bets' : 'You don\'t have that much');
    bet = b; staked = b; sideStake = sides.pp + sides.t3; busy = true; live = false;
    chain = Promise.resolve();
    resetTable();
    paintChips(); sfx.chips();
    shell.actions('<button class="ga" disabled>Dealing…</button>');
    $('bjHint').classList.remove('on');
    shell.show('scPlay');
    socket.emit('blackjack:deal', { bet: b, side: sides });
  }
  function dealFromTable(b) {
    try { deal(b); } catch (e) { toast(e.message, 'red'); change(); }
  }
  const change = () => {
    shell.bet({ onPlace: deal });
    sideBox();
  };

  /** Side bet toggles on the bet screen. */
  function sideBox() {
    let box = $('bjSideBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'bjSideBox'; box.className = 'bjsidebox';
      $('betErr').before(box);
    }
    const pcts = [10, 25, 50];
    box.innerHTML = `<div class="row"><div class="lbl">Side bets · optional</div></div>
      <div class="row chips"><button class="chip${side.pp ? ' on' : ''}" data-s="pp">Perfect Pairs<small>pair pays up to 25×</small></button>
      <button class="chip${side.t3 ? ' on' : ''}" data-s="t3">21+3<small>poker hand up to 100×</small></button></div>
      <div class="row chips amt"${side.pp || side.t3 ? '' : ' style="display:none"'}>${pcts.map((p) => `<button class="chip${side.pct === p ? ' on' : ''}" data-p="${p}">${p}% of bet</button>`).join('')}</div>`;
    box.querySelectorAll('[data-s]').forEach((c) => c.addEventListener('click', () => { side[c.dataset.s] = !side[c.dataset.s]; pref.set(c.dataset.s, side[c.dataset.s]); sideBox(); }));
    box.querySelectorAll('[data-p]').forEach((c) => c.addEventListener('click', () => { side.pct = Number(c.dataset.p); pref.set('sidepct', side.pct); sideBox(); }));
  }

  function outcomeTag(r) {
    const map = { blackjack: ['bj', 'Blackjack'], win: ['win', `Win +${fmt(r.payout - r.bet)}`], push: ['push', 'Push'], loss: ['lose', 'Lose'], bust: ['lose', 'Bust'] };
    const [cls, txt] = map[r.outcome] || ['push', r.outcome];
    return `<div class="bjout ${cls}">${txt}</div>`;
  }

  function explain(r) {
    const hands = r.player_hands, dt = r.dealer_total;
    if (hands.length > 1) {
      const won = hands.filter((h) => h.payout > h.bet).length;
      const head = dt > 21 ? `Dealer busted with ${dt}` : `Dealer has ${dt}`;
      return [`${head} — you won ${won} of ${hands.length} hands`, won ? 'em' : 'red'];
    }
    const h = hands[0];
    if (h.outcome === 'blackjack') return ['Blackjack! Ace + a 10-card pays 3 : 2', 'gold'];
    if (h.outcome === 'bust') return [`Bust with ${h.total} — over 21 loses straight away`, 'red'];
    if (h.outcome === 'push') return dt === 21 && r.dealer_hand.length === 2 && h.hand.length === 2
      ? ['Both have Blackjack — push, your bet comes back', ''] : [`Push on ${h.total} — same total, your bet comes back`, ''];
    if (dt > 21) return [`Dealer busted with ${dt} — you win`, 'em'];
    if (h.outcome === 'win') return [`Your ${h.total} beats the dealer's ${dt}`, 'em'];
    return [`Dealer's ${dt} beats your ${h.total}`, 'red'];
  }

  async function playResult(r) {
    const hands = r.player_hands.map((h) => h.hand);
    if (!vis.dealer.length) await openingDeal(hands, [r.dealer_hand[0], { rank: '?', suit: '?' }]);
    else await syncPlayer(hands);
    showSides(r.side_results);
    markActive(0, true); paintOdds(-1);

    // dealer's turn
    const alive = r.player_hands.some((h) => h.total <= 21);
    await sleep(alive ? 450 : 300);
    await flipHole(r.dealer_hand[1]);
    if (r.dealer_hand.length > 2) {
      const dt = handInfo(vis.dealer);
      msg(dt.soft && dt.total === 17 ? 'Dealer must hit soft 17' : `Dealer has ${dt.total} — must draw to 17`);
      for (let i = 2; i < r.dealer_hand.length; i++) { await sleep(620); await dealDealer(r.dealer_hand[i]); }
    }
    if (alive && r.dealer_total <= 21) { msg(`Dealer stands on ${r.dealer_total}`); }
    await sleep(450);

    // outcomes — totals settle to their final single value
    $('bjdv').textContent = r.dealer_total;
    r.player_hands.forEach((h, i) => {
      const box = handBox(i); if (!box) return;
      box.querySelector('.handlab b').textContent = h.total;
      box.querySelector('.bjodds').outerHTML = outcomeTag(h);
      if (h.outcome === 'win' || h.outcome === 'blackjack') box.querySelector('.cardrow').classList.add('glow');
    });
    const net = Number(r.net);
    const [text, kind] = explain(r);
    msg(text, kind);
    syncBalance(r.cc_balance);

    const handNet = r.player_hands.reduce((a, h) => a + h.payout - h.bet, 0);
    const stack = $('bjChips').querySelector('.bjstack');
    if (handNet > 0 && stack) { flyChips(Math.min(6, 2 + r.player_hands.length * 2), $('bjd')); later(350, () => { restart(stack, 'won'); sfx.chips(); }); }
    else if (handNet < 0 && stack && r.player_hands.every((h) => h.payout === 0)) stack.classList.add('lost');
    const lab = $('bjChips').querySelector('.bjstakelab');
    if (lab) lab.textContent = net > 0 ? `+${fmt(net)} CC` : net < 0 ? `−${fmt(-net)} CC` : 'Bet returned';
    if (r.player_hands.some((h) => h.outcome === 'blackjack')) sfx.blackjack();
    else if (handNet > 0) sfx.win(); else if (handNet < 0) sfx.lose(); else sfx.push();

    // streak counts the round's overall result
    const before = streak;
    if (net > 0) streak++; else if (net < 0) streak = 0;
    pref.set('streak', streak);
    paintStreak(streak > before);
    if (streak > before && [3, 5, 10, 15, 20].includes(streak)) { sfx.streak(); toast(`🔥 ${streak} wins in a row!`, 'gold'); }

    // big wins get the full result screen (win effects live there); otherwise stay at the table
    const special = r.player_hands.some((h) => h.outcome === 'blackjack') || (r.side_results || []).some((s) => s.hit) || net >= 10000;
    if (special && isBigWin(net, staked + sideStake)) {
      await sleep(900);
      shell.result({ net, sub: text, seed: r.seed, again: () => dealFromTable(bet), change, bet: staked + sideStake });
      return;
    }
    const canX2 = bal() >= bet * 2 + (sidesFor(bet * 2).pp + sidesFor(bet * 2).t3);
    shell.actions(`<button class="ga" data-a="change">Change bet</button>
      <button class="ga ga-gold" data-a="x2"${canX2 ? '' : ' disabled'}>Double up<small>${fmt(bet * 2)} CC</small></button>
      <button class="ga ga-em" data-a="again">Deal again<small>${fmt(bet)} CC</small></button>`)
      .querySelectorAll('[data-a]').forEach((btn) => btn.addEventListener('click', () => {
        const a = btn.dataset.a;
        if (a === 'change') change(); else dealFromTable(a === 'x2' ? bet * 2 : bet);
      }));
  }

  // ── socket ─────────────────────────────────────────────────────────────────
  on(socket, {
    'blackjack:resume': ({ bet: b, staked: st, side_bet: sb }) => {
      bet = Number(b); staked = Number(st) || bet; sideStake = Number(sb) || 0;
      toast('Back to your unfinished hand', 'amber');
    },
    'blackjack:state': (st) => {
      busy = false;
      syncBalance(st.cc_balance);
      shell.show('scPlay');
      enqueue(async () => {
        if (!vis.dealer.length) { paintChips(); await openingDeal(st.player_hands, st.dealer_hand); }
        else await syncPlayer(st.player_hands, st.active_hand);
        showSides(st.side_results);
        last = st; live = true;
        markActive(st.active_hand);
        paintOdds(st.active_hand);
        controls(st);
        if (!pref.get('tour', false) && tourStep < 0) tour(0);
      });
    },
    'blackjack:result': (r) => {
      busy = false; live = false;
      lock();
      enqueue(() => playResult(r));
    },
    'blackjack:error': ({ message }) => {
      toast(message || 'Blackjack error', 'red');
      if (/double|split/i.test(message || '')) { staked -= bet; paintChips(); }
      busy = false;
      if (!last) { chain = Promise.resolve(); change(); } else { live = true; controls(last); }
    },
  });

  // ── wiring ─────────────────────────────────────────────────────────────────
  $('bjHint').addEventListener('click', hint);
  $('bjHelp').addEventListener('click', () => {
    const paint = () => {
      $('bjTipsTog').textContent = tips ? 'On' : 'Off'; $('bjTipsTog').classList.toggle('on', tips);
      $('bjSndTog').textContent = isMuted() ? 'Off' : 'On'; $('bjSndTog').classList.toggle('on', !isMuted());
    };
    paint();
    $('bjTipsTog').onclick = () => { tips = !tips; pref.set('tips', tips); paint(); if (live && last) { controls(last); paintOdds(last.active_hand); } };
    $('bjSndTog').onclick = () => { setMuted(!isMuted()); paint(); paintSound(); };
    $('bjTourAgain').onclick = () => { closeSheets(); pref.set('tour', false); if (live) tour(0); else toast('The tutorial starts on your next hand'); };
    openSheet('shBjRules');
  });
  $('bjSnd').addEventListener('click', () => { setMuted(!isMuted()); paintSound(); if (!isMuted()) sfx.chip(); });
  onLeave(() => coach(null));

  paintStreak(); paintSound();
  change();
}

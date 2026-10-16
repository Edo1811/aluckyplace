import socket from '../socket.js';
import { store } from '../store.js';
import { $, fmt, esc, amountOf, every, later, toast, playerFrame } from '../ui/core.js';
import { gameShell, on } from '../games/shell.js';
import { GAME_BY_ID } from '../ui/games-meta.js';

// The engine calls Higher-or-Lower 'higherlow'; the client routes use 'highlow'.
const ENGINE = { highlow: 'higherlow' };

const STYLE = `
.mm{flex:1;display:flex;flex-direction:column;min-height:0}
.mm .center{gap:14px}
.qmeta{font-size:12px;color:rgba(255,255,255,.4);font-style:italic}
.vs{display:flex;align-items:center;justify-content:center;gap:18px;width:100%}
.vs .p{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;flex:1;max-width:150px}
.vs .p b{font-size:14px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vs .p small{font-size:11px;color:rgba(255,255,255,.35)}
.vs .x{font-size:13px;color:rgba(255,255,255,.3);letter-spacing:.2em}
.pcard.ready{border-color:rgba(16,185,129,.45);background:rgba(16,185,129,.06)}
.cd{font-size:12px;color:rgba(255,255,255,.4)}
.cd b{color:#fff;font-variant-numeric:tabular-nums}
.cd.bad b{color:#f87171}
.capnote{display:flex;align-items:center;justify-content:center;gap:6px}
.capnote i{width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.2);font-size:10px;font-style:normal;display:inline-flex;align-items:center;justify-content:center;cursor:help}
`;

export function renderMatchmaking(app, game, onStart, opts = null) {
  const meta = GAME_BY_ID[game] || { name: game };
  const friendlyId = opts && opts.friendly ? opts.friendlyId : null;
  let matchId = null, oppName = '', cap = 0, cd = 30, cdTimer = 0, myBet = 0, ready = false;

  const shell = gameShell(app, { id: `mm-${game}`, title: meta.name, css: STYLE, onExit: leave });
  shell.stage().innerHTML = `<div class="mm">
    <section class="center" id="mmQueue">
      <div class="qring"></div>
      <div><div class="qtitle" id="qTitle">${friendlyId ? 'Starting friendly match' : 'Finding an opponent'}</div>
      <div class="qmeta" id="qElapsed">${friendlyId ? 'Waiting for both players…' : 'Searching · 0s'}</div></div>
      <div class="muted" style="max-width:280px">${friendlyId ? 'Bets are already agreed.' : 'You\'re matched with players near your balance first.'}</div>
    </section>
    <section class="center" id="mmFound" style="display:none">
      <div class="vs" id="vs"></div>
      <div class="qtitle">Opponent found</div>
    </section>
    <section class="center" id="mmBet" style="display:none">
      <div class="prow">
        <div class="pcard you" id="myCard"><div class="pc-name">You</div><div class="pc-bal">${fmt(store.ccBalance)} CC</div><div class="pc-bet" id="myBet">—</div><div class="pc-st" id="mySt">Setting bet</div></div>
        <div class="pcard" id="oppCard"><div class="pc-name" id="oppN"></div><div class="pc-bal" id="oppB"></div><div class="pc-bet" id="oppBet">—</div><div class="pc-st" id="oppSt">Setting bet</div></div>
      </div>
      <div class="betbox">
        <input class="bt-inp" id="pvpBet" inputmode="numeric" placeholder="Your bet" autocomplete="off">
        <div class="chips" id="pvpChips"></div>
        <div class="muted capnote" id="capNote"></div>
        <div class="cd" id="cd">Locks in <b id="cdN">30</b>s</div>
      </div>
    </section>
    <section class="center" id="mmGo" style="display:none">
      <div class="cdring" id="goNum">⚔️</div><div class="muted" id="goTxt">Starting</div>
    </section>
  </div>`;
  const actions = (html) => shell.actions(html);
  shell.show('scPlay');
  actions(friendlyId ? '' : '<button class="ga" id="leaveQ">Leave queue</button>');
  $('leaveQ')?.addEventListener('click', () => { leave(); window.__navigate('games'); });

  const view = (id) => ['mmQueue', 'mmFound', 'mmBet', 'mmGo'].forEach((s) => { $(s).style.display = s === id ? '' : 'none'; });
  let elapsed = 0;
  const startElapsed = () => { elapsed = 0; };
  every(1000, () => { if ($('mmQueue')?.style.display !== 'none' && !friendlyId) { elapsed++; $('qElapsed').textContent = `Searching · ${elapsed}s`; } });

  function leave() {
    clearInterval(cdTimer);
    if (!friendlyId && !matchId) socket.emit('pvp:queue:leave');
  }
  function backToQueue(msg) {
    toast(msg, 'amber'); matchId = null; ready = false;
    later(1500, () => { view('mmQueue'); actions('<button class="ga" id="leaveQ">Leave queue</button>'); $('leaveQ')?.addEventListener('click', () => { leave(); window.__navigate('games'); }); startElapsed(); socket.emit('pvp:queue:join', { game: ENGINE[game] || game }); });
  }

  // ── betting ───────────────────────────────────────────────────────────────
  function betting() {
    view('mmBet');
    $('oppN').textContent = oppName;
    $('capNote').innerHTML = `Capped at ${fmt(cap)} CC <i title="Your bet can't exceed 35% of your opponent's balance">?</i>`;
    const setBet = (v) => {
      v = Math.max(0, Math.min(v, cap, Number(store.ccBalance)));
      myBet = v; $('pvpBet').value = v ? fmt(v) : '';
      $('myBet').textContent = v ? `${fmt(v)} CC` : '—';
      if (matchId) socket.emit('pvp:bet:set', { match_id: matchId, amount: v });
      const r = $('readyBtn'); if (r && !ready) r.disabled = v < 10;
    };
    $('pvpChips').innerHTML = [['100', 100], ['1K', 1000], ['5K', 5000], ['Max', 'max']].map(([l, v]) => `<button class="chip" data-v="${v}">${l}</button>`).join('');
    $('pvpChips').querySelectorAll('[data-v]').forEach((c) => c.addEventListener('click', () => setBet(c.dataset.v === 'max' ? cap : Number(c.dataset.v))));
    $('pvpBet').addEventListener('input', (e) => setBet(amountOf(e.target.value)));
    actions('<button class="ga ga-em" id="readyBtn" disabled>Ready</button>');
    $('readyBtn').addEventListener('click', () => {
      if (myBet < 10 || !matchId) return;
      ready = true; socket.emit('pvp:bet:ready', { match_id: matchId });
      $('readyBtn').disabled = true; $('readyBtn').textContent = 'Waiting for opponent';
      $('myCard').classList.add('ready'); $('mySt').textContent = 'Ready'; $('mySt').className = 'pc-st ok';
      $('pvpBet').disabled = true;
    });
    setBet(Math.min(1000, cap));
    cd = 30; clearInterval(cdTimer);
    cdTimer = setInterval(() => { cd = Math.max(0, cd - 1); const n = $('cdN'); if (n) { n.textContent = cd; $('cd').classList.toggle('bad', cd <= 5); } }, 1000);
  }

  on(socket, {
    'pvp:matched': ({ match_id, opponent, friendly }) => {
      matchId = match_id; oppName = opponent.username; cap = Math.floor(Number(opponent.cc_balance) * 0.35);
      $('oppB').textContent = `${fmt(opponent.cc_balance)} CC`;
      $('vs').innerHTML = `<div class="p">${playerFrame(store.user?.username, null, 72)}<b>You</b><small>${fmt(store.ccBalance)} CC</small></div><div class="x">VS</div>
        <div class="p">${playerFrame(oppName, null, 72)}<b>${esc(oppName)}</b><small>${fmt(opponent.cc_balance)} CC</small></div>`;
      view('mmFound'); actions('');
      if (!friendly) later(1800, betting);
    },
    'pvp:bet:update': ({ your_bet, opp_bet, opp_ready }) => {
      if (your_bet > 0) myBet = Number(your_bet);
      if ($('myBet')) $('myBet').textContent = your_bet > 0 ? `${fmt(your_bet)} CC` : '—';
      if ($('oppBet')) $('oppBet').textContent = opp_bet > 0 ? `${fmt(opp_bet)} CC` : '—';
      if (opp_ready) { $('oppCard').classList.add('ready'); $('oppSt').textContent = 'Ready'; $('oppSt').className = 'pc-st ok'; }
    },
    'pvp:both_ready': ({ pot }) => {
      clearInterval(cdTimer); view('mmGo'); actions('');
      $('goTxt').textContent = `Pot ${fmt(pot)} CC — starting`;
      let n = 3; $('goNum').textContent = n;
      const t = setInterval(() => { n--; if (n <= 0 || !$('goNum')) return clearInterval(t); $('goNum').textContent = n; $('goNum').style.animation = 'none'; void $('goNum').offsetWidth; $('goNum').style.animation = ''; }, 450);
    },
    'pvp:start': (data) => { clearInterval(cdTimer); if (onStart) onStart({ matchId, opponent: oppName, myBet: myBet || Math.floor(Number(data.pot) / 2), ...data }); },
    'pvp:opponent_left': () => backToQueue('Opponent left — back to the queue'),
    'pvp:timeout': () => backToQueue('Time ran out — back to the queue'),
    'pvp:abort': ({ reason }) => { toast(reason && reason.includes('insufficient') ? 'Someone couldn\'t cover their bet' : 'Match cancelled', 'amber'); later(1600, () => window.__navigate('games')); },
    'pvp:auto_win': ({ pot }) => {
      clearInterval(cdTimer);
      shell.result({ net: Number(pot) || 0, sub: 'Opponent disconnected. The pot is yours.', again: () => window.__navigate(`matchmaking-${game}`), change: null, againLabel: 'Find another match' });
    },
    'pvp:error': ({ message }) => toast(message || 'Matchmaking error', 'red'),
  });

  const enter = () => {
    if (friendlyId) socket.emit('friendly:enter', { friendly_id: friendlyId });
    else { startElapsed(); socket.emit('pvp:queue:join', { game: ENGINE[game] || game }); }
  };
  if (socket.connected && store.isAuthenticated) enter(); else socket.once('auth:ok', enter);
}

import { io } from 'socket.io-client';
import { updateBalance } from './store.js';

const socket = io(import.meta.env.VITE_API_URL || '/', {
  autoConnect: true,
  withCredentials: true,
});

socket.on('connect', () => {
  console.log('[socket] connected:', socket.id);

  // Send JWT immediately after connecting
  const token = localStorage.getItem('token');
  if (token) {
    socket.emit('auth', { token });
  }
});

socket.on('auth:ok', ({ user_id, username }) => {
  console.log(`[socket] authenticated as ${username} (${user_id})`);
});

socket.on('auth:error', ({ message }) => {
  console.warn('[socket] auth failed:', message);
  // Token is invalid/expired — clear it and redirect to landing
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.reload();
});

// Global balance update — fired by server whenever CC or A changes
socket.on('balance:update', ({ cc_balance, a_balance }) => {
  updateBalance({ cc_balance, a_balance });
  // Re-render the balance display component if it's mounted
  document.dispatchEvent(new CustomEvent('balance:updated', {
    detail: { cc_balance, a_balance }
  }));
});

socket.on('disconnect', (reason) => {
  console.warn('[socket] disconnected:', reason);
});

socket.on('connect_error', (err) => {
  console.error('[socket] connection error:', err.message);
});

// ── Global lightweight toast (works on any page) ────────────────────────────
function globalToast(msg, type = 'green') {
  let el = document.getElementById('global-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-toast';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:#111;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:11px 18px;font-size:13px;color:#fff;opacity:0;pointer-events:none;transition:all .25s;z-index:4000;font-family:\'Playfair Display\',Georgia,serif;max-width:90vw;text-align:center';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.borderColor = type === 'red' ? 'rgba(239,68,68,.5)' : type === 'gold' ? 'rgba(212,175,55,.5)' : 'rgba(16,185,129,.5)';
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(globalToast._t);
  globalToast._t = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
  }, 3600);
}

const GAME_LABEL = { coinflip: 'Coinflip', rps: 'Rock Paper Scissors', uno: 'Uno', highlow: 'Higher or Lower', duels: 'Duels' };

// Generic notifications from the server (donations, guild approvals, etc.)
socket.on('notification', (payload = {}) => {
  const text = payload.title ? `${payload.title}${payload.text ? ' — ' + payload.text : ''}` : (payload.text || 'Notification');
  globalToast(text, payload.type === 'donation' ? 'gold' : 'green');
});

// ── Friendly (guild) match — app-wide invite handling ───────────────────────
let inviteEl = null;
function closeInvite() { if (inviteEl) { inviteEl.remove(); inviteEl = null; } }

socket.on('friendly:invite', ({ challenge_id, from_username, game, bet }) => {
  closeInvite();
  const label = GAME_LABEL[game] || game;
  inviteEl = document.createElement('div');
  inviteEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:4200;display:flex;align-items:center;justify-content:center;font-family:\'Playfair Display\',Georgia,serif';
  inviteEl.innerHTML = `
    <div style="background:#111;border:1px solid rgba(16,185,129,.25);border-radius:16px;width:320px;padding:24px;text-align:center">
      <div style="font-size:34px;margin-bottom:6px">⚔️</div>
      <div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:4px">Guild Challenge</div>
      <div style="font-size:13px;color:rgba(255,255,255,.55);line-height:1.6;margin-bottom:16px"><b style="color:#10b981">${from_username}</b> challenges you to<br><b style="color:#fff">${label}</b> for <b style="color:#D4AF37">${Number(bet).toLocaleString()} CC</b></div>
      <div style="display:flex;gap:8px">
        <button id="fi-decline" style="flex:1;padding:11px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);font-family:inherit;font-size:13px;cursor:pointer">Decline</button>
        <button id="fi-accept" style="flex:1;padding:11px;border-radius:9px;background:#10b981;border:none;color:#fff;font-weight:700;font-family:inherit;font-size:13px;cursor:pointer">Accept</button>
      </div>
    </div>`;
  document.body.appendChild(inviteEl);
  inviteEl.querySelector('#fi-accept').addEventListener('click', () => { socket.emit('friendly:accept', { challenge_id }); closeInvite(); });
  inviteEl.querySelector('#fi-decline').addEventListener('click', () => { socket.emit('friendly:decline', { challenge_id }); closeInvite(); });
});

socket.on('friendly:launch', ({ friendly_id, game }) => {
  closeInvite();
  if (window.__navigate) window.__navigate('matchmaking-' + game, { friendly: true, friendlyId: friendly_id });
});

socket.on('friendly:sent', ({ opponent }) => globalToast(`Challenge sent${opponent ? ' to ' + opponent : ''} ⚔️`, 'green'));
socket.on('friendly:declined', ({ by }) => globalToast(`${by || 'They'} declined your challenge`, 'red'));
socket.on('friendly:cancelled', ({ reason }) => { closeInvite(); globalToast(reason === 'expired' ? 'Challenge expired' : 'Friendly match cancelled', 'red'); });
socket.on('friendly:error', ({ message }) => { closeInvite(); globalToast(message || 'Friendly match error', 'red'); });

export default socket;

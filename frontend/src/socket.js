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

export default socket;

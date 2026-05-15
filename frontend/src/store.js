// Minimal reactive store. Phase 3 will populate this on login.
// Components import { store, setUser, updateBalance } and read directly.

export const store = {
  user: null,           // { id, username }
  ccBalance: 0,
  aBalance: 0,
  isAuthenticated: false,
};

export function setUser(user) {
  store.user = user;
  store.ccBalance = user.cc_balance;
  store.aBalance = user.a_balance;
  store.isAuthenticated = true;
}

export function updateBalance({ cc_balance, a_balance }) {
  if (cc_balance !== undefined) store.ccBalance = cc_balance;
  if (a_balance  !== undefined) store.aBalance  = a_balance;
}

export function clearUser() {
  store.user = null;
  store.ccBalance = 0;
  store.aBalance = 0;
  store.isAuthenticated = false;
}

// Tiny synthesized sound kit for table games (no audio files). Muted state is shared
// across games and remembered per browser.
const MUTE_KEY = 'alp_sfx_mute';
export const isMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };
export const setMuted = (m) => { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* storage off */ } };

let ac = null;
function audio() {
  if (isMuted()) return null;
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, dur, { type = 'triangle', vol = 0.05, at = 0, slide = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.05, at = 0, from = 2000, to = 6000, type = 'bandpass' } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, n = Math.max(1, Math.floor(a.sampleRate * dur)), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = type; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t);
}
const vib = (p) => { try { if (!isMuted() && navigator.vibrate) navigator.vibrate(p); } catch { /* unsupported */ } };

export const sfx = {
  card() { noise(0.07, { from: 3500, to: 1200, vol: 0.09 }); tone(180, 0.04, { type: 'sine', vol: 0.03 }); },
  flip() { noise(0.18, { from: 600, to: 4000, vol: 0.06 }); },
  chip() { tone(2400, 0.035, { type: 'square', vol: 0.018 }); tone(3100, 0.03, { type: 'square', vol: 0.014, at: 0.04 }); },
  chips() { for (let i = 0; i < 4; i++) tone(2200 + Math.random() * 1200, 0.03, { type: 'square', vol: 0.014, at: i * 0.045 }); },
  pop() { tone(880, 0.06, { vol: 0.03 }); },
  bust() { tone(110, 0.45, { type: 'sine', vol: 0.18, slide: 0.5 }); noise(0.25, { from: 400, to: 80, type: 'lowpass', vol: 0.08 }); vib(60); },
  win() { [659, 880].forEach((f, i) => tone(f, 0.18, { at: i * 0.08, vol: 0.05 })); },
  lose() { tone(330, 0.22, { vol: 0.035, slide: 0.7 }); },
  push() { tone(523, 0.12, { vol: 0.03 }); },
  blackjack() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.26, { at: i * 0.07, vol: 0.05 })); vib([30, 40, 60]); },
  side() { [784, 1175].forEach((f, i) => tone(f, 0.16, { at: i * 0.07, vol: 0.05 })); },
  roll(k = 1) { noise(0.05, { from: 1800, to: 900, vol: 0.025 * k }); },
  clack() { tone(1900, 0.03, { type: 'square', vol: 0.03 }); noise(0.05, { from: 4000, to: 2000, vol: 0.06 }); },
  tick(k = 1) { tone(1400 + Math.random() * 500, 0.02, { type: 'square', vol: 0.02 * k }); },
  settle() { tone(220, 0.12, { type: 'sine', vol: 0.08 }); noise(0.06, { from: 1500, to: 600, vol: 0.05 }); },
  streak() { [880, 1109, 1319].forEach((f, i) => tone(f, 0.12, { at: i * 0.05, vol: 0.04, type: 'square' })); },
};

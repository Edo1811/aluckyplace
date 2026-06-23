// Shared cosmetic preview rendering — used by both shop.js and profile.js so
// the same item looks identical wherever it's shown.
//
// Revamp notes (latest pass — Avatar Frame full rebuild):
// - Every one of the 12 Avatar Frames now has its own bespoke, hand-built
//   visual recipe (FRAME_RECIPES below) instead of a generic "colored ring +
//   corner icon" template. Iron Ring has actual rivets, Gold Crown has an
//   actual crown silhouette, Silver Crescent is a real partial arc (not a
//   full ring), Phoenix Wing has actual flame-feather wings, Eclipse has a
//   rotating corona/starfield/diamond-ring flare, etc.
// - One function — renderAvatarFrame(frame, size) — builds the complete
//   markup (ring/wings/crown/whatever + the avatar circle itself) at ANY
//   size. It's used for both the small shop/profile preview swatch and the
//   full-size profile hero avatar, so they're always pixel-faithful to each
//   other, just scaled. Everything inside scales off a 78px reference
//   design size via the `s` (scale) factor passed into each recipe.
// - Rarity still matters, but it's expressed as escalating technique, not
//   just a bigger glow: Common is calm/material-only, Rare adds one quiet
//   signature touch, Epic adds real ornament, Legendary pulses, Exotic gets
//   a fully unique multi-layer treatment (Eclipse) that doesn't reuse any
//   vocabulary from the Legendary pieces.
// - Any future Avatar Frame added to the catalog without a recipe yet still
//   renders correctly via a generic ring+badge fallback (same as before),
//   so this never hard-breaks on new content.
//
// (Earlier pass notes, still true: Name Aura's preview renders real sample
// text via the same glow function as the live name; Name Font carries its
// full fill technique — outline/neon, gold fill, chrome, deep shadow — into
// the live equipped name, not just the preview; Exotic rarity gets its own
// hue-shimmer instead of a bigger Legendary pulse for auras/the old generic
// frame fallback.)

const RARITY_COLORS = {
  Common:    '#9ca3af',
  Rare:      '#3b82f6',
  Epic:      '#a855f7',
  Legendary: '#D4AF37',
  Exotic:    '#f97316',
};

// Glow intensity scales with rarity. Legendary pulses; Exotic gets a
// distinct hue-shimmer on top instead of just a bigger pulse, so the two
// top tiers don't read as "the same effect, different size."
const RARITY_GLOW = {
  Common:    { blur: 6,  spread: 0, opacity: 0.25, pulse: false, shimmer: false },
  Rare:      { blur: 10, spread: 1, opacity: 0.35, pulse: false, shimmer: false },
  Epic:      { blur: 16, spread: 1, opacity: 0.45, pulse: false, shimmer: false },
  Legendary: { blur: 22, spread: 2, opacity: 0.55, pulse: true,  shimmer: false },
  Exotic:    { blur: 30, spread: 3, opacity: 0.7,  pulse: true,  shimmer: true  },
};

// preview_key -> visual identity for everything EXCEPT Avatar Frame (which
// has its own bespoke FRAME_RECIPES below — see renderAvatarFrame).
// chat_badge: `tint` is a subtle background tint matching the badge's theme;
//   the icon stays the primary identity.
// name_font: `neonColor` is the actual neon tube color for the outline font.
const VISUALS = {
  // Avatar Frame — color kept here only as metadata for the generic
  // fallback path (a brand-new frame added to the catalog with no recipe
  // yet); every item below actually has a full recipe in FRAME_RECIPES.
  frame_iron_ring:       { icon: '⚙️', color: '#6b7280' },
  frame_felt_border:     { icon: '🟢', color: '#15803d' },
  frame_chip_stack:      { icon: '🪙', color: '#b91c1c' },
  frame_copper_edge:     { icon: '🔶', color: '#b87333' },
  frame_emerald_ring:    { icon: '💚', color: '#10b981' },
  frame_sapphire_halo:   { icon: '💙', color: '#2563eb' },
  frame_silver_crescent: { icon: '🌙', color: '#cbd5e1' },
  frame_gold_crown:      { icon: '👑', color: '#D4AF37' },
  frame_velvet_curtain:  { icon: '🎭', color: '#831843' },
  frame_diamond_crown:   { icon: '💎', color: '#bfdbfe' },
  frame_phoenix_wing:    { icon: '🪶', color: '#ea580c' },
  frame_eclipse:         { icon: '🌑', color: '#312e81' },

  // Chat Badge
  badge_lucky_clover:  { icon: '🍀', tint: '#22c55e' },
  badge_dice_pip:      { icon: '🎲', tint: '#e5e7eb' },
  badge_poker_chip:    { icon: '🪙', tint: '#dc2626' },
  badge_ace_card:      { icon: '🃏', tint: '#e5e7eb' },
  badge_neon_skull:    { icon: '💀', tint: '#84cc16' },
  badge_cherry_bomb:   { icon: '💣', tint: '#dc2626' },
  badge_crystal_ball:  { icon: '🔮', tint: '#a855f7' },
  badge_black_diamond: { icon: '♦️', tint: '#1e3a8a' },
  badge_flame_sigil:   { icon: '🔥', tint: '#f97316' },
  badge_golden_skull:  { icon: '💀', tint: '#D4AF37' },
  badge_royal_seal:    { icon: '🛡️', tint: '#4338ca' },
  badge_void_sigil:    { icon: '🌀', tint: '#581c87' },

  // Display Name Font — rendered as a styled "Aa" sample, not an icon
  font_mono:           { font: "'Courier New', monospace" },
  font_slab:           { font: "Georgia, serif", weight: 900 },
  font_rounded:        { font: "Verdana, sans-serif", spacing: '0.04em' },
  font_typewriter:     { font: "'Courier New', monospace", style: 'italic' },
  font_obsidian:       { font: "Georgia, serif", weight: 900, spacing: '-0.02em' },
  font_velvet_script:  { font: "'Dancing Script', cursive" },
  font_chrome:         { font: "Arial, sans-serif", weight: 800, shadow: true },
  font_royal_serif:    { font: "'Cinzel', serif" },
  font_neon_outline:   { font: "Arial, sans-serif", weight: 800, outline: true, neonColor: '#22e5ff' },
  font_engraved_gold:  { font: "'Cinzel', serif", weight: 700, goldFill: true },
  font_shadow_bold:    { font: "Arial, sans-serif", weight: 900, deepShadow: true },
  font_eclipse_script: { font: "'Dancing Script', cursive", style: 'italic' },

  // Display Name Color — real swatches, not the rarity color
  color_slate_gray:     { color: '#64748b' },
  color_steel_blue:     { color: '#4682b4' },
  color_forest_green:   { color: '#228b22' },
  color_burgundy:       { color: '#800020' },
  color_crimson:        { color: '#dc143c' },
  color_sapphire:       { color: '#0f52ba' },
  color_emerald_shine:  { color: '#50c878' },
  color_royal_purple:   { color: '#7851a9' },
  color_sunset_orange:  { color: '#fd5e53' },
  color_molten_gold:    { color: '#D4AF37' },
  color_platinum_white: { color: '#e5e4e2' },
  color_prismatic:      { prismatic: true },

  // Display Name Aura — glow rendered around the username
  aura_soft_glow:      { color: '#e5e7eb' },
  aura_ember_glow:     { color: '#f97316' },
  aura_cool_mist:      { color: '#67e8f9' },
  aura_static_hum:     { color: '#d1d5db', flicker: true },
  aura_aurora:         { color: '#34d399', prismatic: true },
  aura_electric_pulse: { color: '#3b82f6', flicker: true },
  aura_frost_halo:     { color: '#93c5fd' },
  aura_solar_flare:    { color: '#fb923c' },
  aura_void_ring:      { color: '#7c3aed' },
  aura_phoenix:        { color: '#ef4444', flame: true },
  aura_celestial_halo: { color: '#fde68a' },
  aura_eclipse:        { color: '#991b1b' },

  // Custom Emoji — show the actual cluster
  emoji_slot_spin:   { icon: '🎰' },
  emoji_clover:      { icon: '🍀' },
  emoji_dice:        { icon: '🎲' },
  emoji_joker:       { icon: '🃏' },
  emoji_skull_set:   { icon: '💀☠️' },
  emoji_flame_set:   { icon: '🔥🌋' },
  emoji_gem_set:     { icon: '💎✨' },
  emoji_crown_set:   { icon: '👑✨' },
  emoji_bolt_set:    { icon: '⚡🌩️' },
  emoji_dragon_set:  { icon: '🐉🔥' },
  emoji_phoenix_set: { icon: '🐦‍🔥✨' },
  emoji_cosmic_set:  { icon: '🌌🌠' },
};

// Status titles have no visual key — they ARE the text. Handled separately
// by callers (render the title text itself, not this function).

function glowStyle(color, rarity) {
  const g = RARITY_GLOW[rarity] || RARITY_GLOW.Common;
  const layers = [`0 0 ${g.blur}px ${g.spread}px ${color}${Math.round(g.opacity * 255).toString(16).padStart(2, '0')}`];
  if (g.pulse || g.shimmer) layers.push(`0 0 ${g.blur * 2}px ${color}33`);
  return layers.join(', ');
}

// Generic Avatar Frame fallback (color/glow/pulse, no bespoke recipe) — only
// used if a frame is added to the catalog before a real recipe is written
// for it. See renderAvatarFrame.
function resolveFrameVisual(item) {
  const v = VISUALS[item.preview_key] || {};
  const rarityCol = RARITY_COLORS[item.rarity] || RARITY_COLORS.Common;
  const color = v.color || rarityCol;
  const glow = RARITY_GLOW[item.rarity] || RARITY_GLOW.Common;
  const className = glow.shimmer ? 'ring-shimmer' : (glow.pulse ? 'ring-pulse' : '');
  return { color, icon: v.icon || '⚪', boxShadow: glowStyle(color, item.rarity), className };
}

// Resolves a Chat Badge's tint (falls back to rarity color) and icon.
function resolveBadgeVisual(item) {
  const v = VISUALS[item.preview_key] || {};
  const rarityCol = RARITY_COLORS[item.rarity] || RARITY_COLORS.Common;
  return { color: v.tint || rarityCol, icon: v.icon || '🏷️' };
}

// ---------------------------------------------------------------------
// Avatar Frame recipes
// ---------------------------------------------------------------------
// Every recipe was designed at a 78px reference size; `s` is size/78 and
// every px value below is multiplied by it, so the exact same recipe
// renders correctly at a 42px shop swatch or a 96px hero avatar. `clip`
// means the frame needs its own circular overflow:hidden (only Eclipse —
// its shadow disc swells/slides and needs a clean circular mask).

const FRAME_REF = 78;
const AV_RATIO = 52 / 78;
const r = (v) => Math.round(v * 100) / 100;
let _uid = 0;
const uid = (prefix) => `${prefix}${(_uid++).toString(36)}`;

const FRAME_RECIPES = {
  frame_iron_ring: {
    deco(s) {
      const rivets = [0, 90, 180, 270].map((a) => `
        <div style="position:absolute;left:50%;top:50%;width:${r(5*s)}px;height:${r(5*s)}px;border-radius:50%;background:#3f3f46;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),0 1px 1px rgba(0,0,0,.6);transform-origin:0 0;transform:rotate(${a}deg) translateY(${r(-31*s)}px)"></div>`).join('');
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(3*s)}px solid #6b7280;background:linear-gradient(135deg,#a1a1aa,#6b7280 45%,#3f3f46)"></div>${rivets}`;
    },
  },

  frame_felt_border: {
    deco(s) {
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(2.5*s)}px dashed #15803d;opacity:.85"></div>`;
    },
  },

  frame_chip_stack: {
    deco(s) {
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;background:repeating-conic-gradient(#b91c1c 0deg 15deg, #f5f5f5 15deg 30deg)"></div>`;
    },
  },

  frame_copper_edge: {
    deco(s) {
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(3*s)}px solid #b87333;background:linear-gradient(135deg,#e8a87c,#b87333 45%,#7a4a20)"></div>`;
    },
  },

  frame_emerald_ring: {
    deco(s) {
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;background:repeating-conic-gradient(#047857 0deg 22.5deg, #34d399 22.5deg 45deg)"></div>
        <div style="position:absolute;left:50%;top:50%;width:${r(4*s)}px;height:${r(4*s)}px;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff,0 0 9px #6ee7b7;transform-origin:0 0;--ty:${r(-33*s)}px;animation:cfGlint 3.6s ease-in-out infinite"></div>`;
    },
  },

  frame_sapphire_halo: {
    deco(s) {
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(2.5*s)}px solid #2563eb;opacity:.85"></div>
        <div style="position:absolute;inset:${r(-4*s)}px;border-radius:50%;border:1px solid #2563eb;opacity:.5;animation:cfHalo 2.4s ease-out infinite"></div>`;
    },
  },

  frame_silver_crescent: {
    deco(s) {
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;background:conic-gradient(from -70deg, transparent 0deg, #e2e8f0 0deg 50deg, #cbd5e1 50deg 100deg, transparent 100deg 360deg)"></div>
        <div style="position:absolute;left:50%;top:50%;width:${r(3*s)}px;height:${r(3*s)}px;border-radius:50%;background:#fff;box-shadow:0 0 5px #fff;transform-origin:0 0;transform:rotate(-65deg) translateY(${r(-33*s)}px);animation:cfGlint2 2.8s ease-in-out infinite"></div>`;
    },
  },

  frame_gold_crown: {
    deco(s) {
      const gid = uid('gc');
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(3*s)}px solid #D4AF37;background:linear-gradient(135deg,#fff6d8,#D4AF37 45%,#9c7a1f)"></div>
        <svg style="position:absolute;left:50%;top:${r(-2*s)}px;transform:translateX(-50%);z-index:1;filter:drop-shadow(0 0 5px rgba(212,175,55,.65))" viewBox="0 0 64 36" width="${r(48*s)}" height="${r(27*s)}">
          <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fff6d8"/><stop offset="55%" stop-color="#D4AF37"/><stop offset="100%" stop-color="#9c7a1f"/>
          </linearGradient></defs>
          <path d="M4,36 L4,28 L12,6 L20,28 L22,28 L32,0 L42,28 L44,28 L52,6 L60,28 L60,36 Z" fill="url(#${gid})" stroke="#7a5a14" stroke-width="1.5"/>
          <circle cx="12" cy="6" r="3" fill="#fde68a"/>
          <circle cx="32" cy="0.5" r="3.6" fill="#fff" stroke="#D4AF37" stroke-width="1"/>
          <circle cx="52" cy="6" r="3" fill="#fde68a"/>
        </svg>`;
    },
  },

  frame_velvet_curtain: {
    deco(s) {
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(2*s)}px solid #5b1538;background:radial-gradient(circle at 30% 30%, #9d3a72, #5b1538 55%, #2e0a1c)"></div>
        <div style="position:absolute;width:${r(2*s)}px;height:${r(8*s)}px;background:#D4AF37;left:${r(31*s)}px;top:${r(60*s)}px"></div>
        <div style="position:absolute;width:${r(4*s)}px;height:${r(4*s)}px;border-radius:50%;background:#D4AF37;box-shadow:0 0 3px #D4AF37;left:${r(30*s)}px;top:${r(67*s)}px"></div>
        <div style="position:absolute;width:${r(2*s)}px;height:${r(8*s)}px;background:#D4AF37;left:${r(51*s)}px;top:${r(60*s)}px"></div>
        <div style="position:absolute;width:${r(4*s)}px;height:${r(4*s)}px;border-radius:50%;background:#D4AF37;box-shadow:0 0 3px #D4AF37;left:${r(50*s)}px;top:${r(67*s)}px"></div>`;
    },
  },

  frame_diamond_crown: {
    deco(s) {
      const gid = uid('dc');
      const rays = [45, 135, 225, 315].map((a, i) => `
        <div style="position:absolute;left:50%;top:50%;width:${r(1.5*s)}px;height:${r(12*s)}px;background:linear-gradient(to top, rgba(255,255,255,0), #fff);transform-origin:0 0;transform:rotate(${a}deg) translateY(${r(-40*s)}px);animation:cfRay 2.4s ease-in-out infinite;animation-delay:${(i*0.6).toFixed(1)}s"></div>`).join('');
      const sparkles = [0, 60, 120, 180, 240, 300].map((a, i) => `
        <div style="position:absolute;left:50%;top:50%;width:${r(4*s)}px;height:${r(4*s)}px;border-radius:50%;background:#fff;box-shadow:0 0 6px #fff,0 0 10px #93c5fd;transform-origin:0 0;--rot:${a}deg;--ty:${r(-34*s)}px;animation:cfTwinkle 2.2s ease-in-out infinite;animation-delay:${(i*0.3).toFixed(1)}s"></div>`).join('');
      return `<div style="position:absolute;inset:${r(-4*s)}px;border-radius:50%;border:1px solid #bfdbfe;opacity:.5;animation:cfHalo 2.4s ease-out infinite"></div>
        <div style="position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg, transparent 0%, #bfdbfe 16%, transparent 36%);animation:cfSpin 3s linear infinite"></div>
        <div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(2.5*s)}px solid #bfdbfe;opacity:.85;background:linear-gradient(135deg,#fff,#bfdbfe 45%,#60a5fa 80%,#fff);box-shadow:0 0 ${r(14*s)}px ${r(3*s)}px rgba(191,219,254,.65),0 0 ${r(26*s)}px ${r(9*s)}px rgba(96,165,250,.4);animation:cfDiamondPulse 1.7s ease-in-out infinite"></div>
        <svg style="position:absolute;left:50%;top:${r(-2*s)}px;transform:translateX(-50%);z-index:1;filter:drop-shadow(0 0 5px rgba(212,175,55,.4))" viewBox="0 0 64 36" width="${r(46*s)}" height="${r(26*s)}">
          <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#bfdbfe"/><stop offset="100%" stop-color="#60a5fa"/>
          </linearGradient></defs>
          <path d="M4,36 L4,28 L12,6 L20,28 L22,28 L32,0 L42,28 L44,28 L52,6 L60,28 L60,36 Z" fill="url(#${gid})" stroke="#3b82f6" stroke-width="1.5"/>
          <circle cx="12" cy="6" r="2.6" fill="#fff"/>
          <rect x="28.3" y="-4.3" width="7.4" height="7.4" fill="#fff" stroke="#3b82f6" stroke-width="1" transform="rotate(45 32 0)"/>
          <circle cx="52" cy="6" r="2.6" fill="#fff"/>
        </svg>
        ${rays}${sparkles}`;
    },
  },

  frame_phoenix_wing: {
    deco(s) {
      const wing = `
          <path d="M4,36 C1,30.4 1,24.8 4,22 C7,24.8 7,30.4 4,36 Z" transform="rotate(-55 4 36)" fill="#7c2d12"/>
          <path d="M4,36 C1,28.8 1,21.6 4,18 C7,21.6 7,28.8 4,36 Z" transform="rotate(12 4 36)" fill="#f97316"/>
          <path d="M4,36 C1,25.6 1,15.2 4,10 C7,15.2 7,25.6 4,36 Z" transform="rotate(-8 4 36)" fill="#fbbf24"/>
          <path d="M4,36 C1,28 1,20 4,16 C7,20 7,28 4,36 Z" transform="rotate(-30 4 36)" fill="#ea580c"/>`;
      const embers = [0, 120, 240].map((a, i) => `
        <div style="position:absolute;left:50%;top:50%;width:${r(8*s)}px;height:${r(8*s)}px;border-radius:50%;background:#fbbf24;box-shadow:0 0 ${r(10*s)}px #f97316,0 0 ${r(16*s)}px #ea580c;transform-origin:0 0;--r:${r(31*s)}px;animation:cfOrbit 4s linear infinite;animation-delay:${(-i*1.3).toFixed(1)}s"></div>`).join('');
      const smokes = [{ l: 26, dx: -5, d: 0 }, { l: 48, dx: 6, d: 2.2 }].map((o) => `
        <div style="position:absolute;width:${r(5*s)}px;height:${r(14*s)}px;border-radius:50%/60% 60% 40% 40%;background:rgba(120,113,108,.25);left:${r(o.l*s)}px;bottom:${r(12*s)}px;filter:blur(1px);--sdx:${r(o.dx*s)}px;--sty:${r(-40*s)}px;animation:cfSmoke 4.5s ease-in infinite;animation-delay:${o.d}s"></div>`).join('');
      const sparks = [{ l: 30, dx: -6, d: 0 }, { l: 42, dx: 4, d: 0.7 }, { l: 50, dx: -3, d: 1.4 }, { l: 24, dx: 7, d: 2.1 }].map((o) => `
        <div style="position:absolute;width:${r(3*s)}px;height:${r(3*s)}px;border-radius:50%;background:#fbbf24;box-shadow:0 0 ${r(6*s)}px #f97316,0 0 ${r(10*s)}px #ea580c;left:${r(o.l*s)}px;bottom:${r(10*s)}px;--dx:${r(o.dx*s)}px;--pty:${r(-46*s)}px;animation:cfSpark 2.6s ease-in infinite;animation-delay:${o.d}s"></div>`).join('');
      return `<div style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(2.5*s)}px solid #ea580c;opacity:.85;background:linear-gradient(135deg,#fbbf24,#ea580c 55%,#7c2d12);animation:cfPhoenixCycle 3s ease-in-out infinite"></div>
        <svg style="position:absolute;top:${r(-2*s)}px;left:${r(-14*s)}px;filter:drop-shadow(0 0 4px rgba(234,88,12,.55))" viewBox="0 0 32 40" width="${r(44*s)}" height="${r(55*s)}">${wing}</svg>
        <svg style="position:absolute;top:${r(-2*s)}px;left:${r(50*s)}px;transform:scaleX(-1);filter:drop-shadow(0 0 4px rgba(234,88,12,.55))" viewBox="0 0 32 40" width="${r(44*s)}" height="${r(55*s)}">${wing}</svg>
        ${embers}${smokes}${sparks}`;
    },
  },

  frame_eclipse: {
    clip: true,
    deco(s) {
      const stars = [
        { l: 64, t: 26, tw: 0 }, { l: 50, t: 12, tw: 1, d: 0.5 },
        { l: 18, t: 16, tw: 0 }, { l: 10, t: 42, tw: 1, d: 1.5 },
        { l: 22, t: 62, tw: 0 }, { l: 56, t: 64, tw: 1, d: 2.2 },
      ].map((o) => `
        <div style="position:absolute;width:${r(2*s)}px;height:${r(2*s)}px;border-radius:50%;background:#fff;opacity:.45;left:${r(o.l*s)}px;top:${r(o.t*s)}px;${o.tw ? `animation:cfStarTw 3s ease-in-out infinite;animation-delay:${o.d}s` : ''}"></div>`).join('');
      const rays = [
        { a: 15, h: 9, ty: -36, d: 0 }, { a: 100, h: 15, ty: -44, d: 1.1 },
        { a: 205, h: 11, ty: -38, d: 2 }, { a: 290, h: 17, ty: -46, d: 0.6 },
      ].map((o) => `
        <div style="position:absolute;left:50%;top:50%;width:${r(1.5*s)}px;height:${r(o.h*s)}px;background:linear-gradient(to top, rgba(167,139,250,0), rgba(216,180,254,.9));transform-origin:0 0;transform:rotate(${o.a}deg) translateY(${r(o.ty*s)}px);animation:cfCoronaRay 3.6s ease-in-out infinite;animation-delay:${o.d}s"></div>`).join('');
      return `<div style="position:absolute;inset:0;border-radius:50%;border:${r(3*s)}px solid #8b5cf6;animation:cfEclipseHue 3.4s ease-in-out infinite"></div>
        ${stars}
        <div style="position:absolute;inset:${r(2*s)}px;border-radius:50%;background:conic-gradient(from 0deg, rgba(167,139,250,.55) 0deg 40deg, rgba(251,191,36,.4) 40deg 70deg, transparent 70deg 140deg, rgba(167,139,250,.45) 140deg 200deg, transparent 200deg 360deg);filter:blur(1px);animation:cfCoronaSpin 9s linear infinite"></div>
        ${rays}
        <div style="position:absolute;width:80%;height:80%;border-radius:50%;background:radial-gradient(circle at 35% 32%, #232342, #000 70%);top:10%;left:10%;box-shadow:0 0 ${r(7*s)}px ${r(2*s)}px #000,0 0 ${r(15*s)}px ${r(4*s)}px rgba(251,191,36,.5),0 0 ${r(30*s)}px ${r(10*s)}px rgba(124,58,237,.7),0 0 ${r(54*s)}px ${r(22*s)}px rgba(76,29,149,.4);z-index:1;--swing:${r(22*s)}px;animation:cfEclipsePass 5s ease-in-out infinite"></div>
        <div style="position:absolute;width:${r(5*s)}px;height:${r(5*s)}px;border-radius:50%;background:#fff;box-shadow:0 0 8px #fff,0 0 16px #fde68a,0 0 24px #fbbf24;opacity:0;z-index:2;left:${r(60*s)}px;top:${r(20*s)}px;animation:cfDiamondFlare 5s ease-in-out infinite"></div>`;
    },
  },
};

const PREVIEW_FRAME_SIZE = 42;

/**
 * Builds the COMPLETE markup for an avatar wearing this Avatar Frame
 * cosmetic — ring/wings/crown/whatever the recipe calls for, plus the
 * avatar circle itself — at any pixel size. Used for both the small
 * shop/profile preview swatch and the full-size profile hero avatar, so
 * they're always faithful to each other, just scaled.
 * @param {{rarity:string, preview_key:string}|null} frame
 * @param {number} size — rendered width/height in px
 */
export function renderAvatarFrame(frame, size) {
  const sz = Math.round(size);
  if (!frame) {
    return `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:${r(sz*0.4375)}px">👤</div>`;
  }
  const s = sz / FRAME_REF;
  const avSize = r(sz * AV_RATIO);
  const recipe = FRAME_RECIPES[frame.preview_key];
  let deco, clip = false;
  if (recipe) {
    deco = recipe.deco(s);
    clip = !!recipe.clip;
  } else {
    const { color, icon, boxShadow, className } = resolveFrameVisual(frame);
    const badgeSize = r(avSize * 0.29);
    deco = `<div class="${className}" style="position:absolute;inset:${r(6*s)}px;border-radius:50%;border:${r(2.5*s)}px solid ${color};opacity:.85;box-shadow:${boxShadow}"></div>
      <div style="position:absolute;bottom:${r(-3*s)}px;right:${r(-3*s)}px;width:${badgeSize}px;height:${badgeSize}px;border-radius:50%;background:#0a0a0a;border:${r(1.5*s)}px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${r(badgeSize*0.55)}px">${icon}</div>`;
  }
  return `<div style="position:relative;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;${clip ? 'overflow:hidden;border-radius:50%;' : ''}">
    ${deco}
    <div style="width:${avSize}px;height:${avSize}px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;font-size:${r(avSize*0.42)}px;position:relative;z-index:2">👤</div>
  </div>`;
}

/**
 * Returns { boxStyle, innerHTML } for a cosmetic preview box.
 * @param {{category:string, rarity:string, preview_key:string, name:string}} item
 */
export function renderCosmeticPreview(item) {
  const rarityCol = RARITY_COLORS[item.rarity] || RARITY_COLORS.Common;
  const v = VISUALS[item.preview_key] || {};

  if (item.category === 'status_title') {
    return {
      boxStyle: `background:${rarityCol}14;`,
      innerHTML: `<span style="font-size:13px;font-style:italic;font-weight:700;color:${rarityCol};text-shadow:${glowStyle(rarityCol, item.rarity)};text-align:center;padding:0 6px">"${item.name}"</span>`,
    };
  }

  if (item.category === 'name_font') {
    const fontStyle = nameFontFamily(item);
    const needsOwnColor = !v.outline && !v.goldFill;
    const boxExtra = v.outline ? `box-shadow:inset 0 0 16px ${(v.neonColor || '#22e5ff')}33;` : '';
    return {
      boxStyle: `background:${rarityCol}10;${boxExtra}`,
      innerHTML: `<span class="${fontStyle.className}" style="font-size:26px;${fontStyle.style}${needsOwnColor ? `color:${rarityCol};` : ''}">Aa</span>`,
    };
  }

  if (item.category === 'name_color') {
    if (v.prismatic) {
      return {
        boxStyle: `background:linear-gradient(135deg,#ff5f6d,#ffc371,#47e3a3,#4facfe,#a18cd1);background-size:300% 300%;animation:prismaticShift 3s ease infinite;`,
        innerHTML: `<span style="font-size:15px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4)">PlayerName</span>`,
      };
    }
    const col = v.color || rarityCol;
    return {
      boxStyle: `background:${col}14;`,
      innerHTML: `<div class="prev-color-wrap">
        <div class="prev-color-dot" style="background:${col};box-shadow:0 0 10px 2px ${col}77"></div>
        <span style="font-size:12.5px;font-weight:700;color:${col}">PlayerName</span>
      </div>`,
    };
  }

  if (item.category === 'name_aura') {
    // Reuse the exact same glow function as the live equipped name, on a
    // real sample username — this is now a true WYSIWYG preview.
    const styled = auraNameStyle(item);
    return {
      boxStyle: `background:radial-gradient(circle, ${styled.color}26, transparent 70%);`,
      innerHTML: `<span class="${styled.className}" style="font-size:14px;font-weight:700;color:#fff;${styled.style}">PlayerName</span>`,
    };
  }

  if (item.category === 'custom_emoji') {
    return {
      boxStyle: `background:${rarityCol}10;`,
      innerHTML: `<span style="font-size:22px;letter-spacing:2px">${v.icon || '😎'}</span>`,
    };
  }

  if (item.category === 'avatar_frame') {
    // Full bespoke recipe — same function used for the live hero avatar.
    return {
      boxStyle: '',
      innerHTML: renderAvatarFrame(item, PREVIEW_FRAME_SIZE),
    };
  }

  if (item.category === 'chat_badge') {
    const { color, icon } = resolveBadgeVisual(item);
    return {
      boxStyle: `background:${color}12;`,
      innerHTML: `<span class="prev-badge-chip" style="border-color:${color}55;background:${color}1f;box-shadow:0 0 10px ${color}33"><span class="prev-badge-icon">${icon}</span></span>`,
    };
  }

  // Fallback for anything unmapped or any future category.
  return {
    boxStyle: `background:${rarityCol}14;`,
    innerHTML: `<span style="font-size:26px;filter:drop-shadow(0 0 6px ${rarityCol}88)">${v.icon || '🎁'}</span>`,
  };
}

/**
 * Returns { style, className, color } for rendering a USERNAME wearing this
 * aura — a real glow on the text itself. Used both for the live equipped
 * name AND (via renderCosmeticPreview) for the shop/profile preview swatch,
 * so the two are always identical.
 * @param {{rarity:string, preview_key:string}|null} aura
 */
export function auraNameStyle(aura) {
  if (!aura) return { style: '', className: '', color: null };
  const v = VISUALS[aura.preview_key] || {};
  const col = v.color || RARITY_COLORS[aura.rarity] || '#10b981';
  const glow = RARITY_GLOW[aura.rarity] || RARITY_GLOW.Common;
  const shadow = `0 0 ${glow.blur}px ${col}, 0 0 ${glow.blur * 1.8}px ${col}99`;

  // Item-specific character (flame/flicker) always wins. Otherwise the
  // rarity tier supplies its own animation — Exotic shimmers, Legendary
  // pulses — so two auras with no special character still read as
  // differently rare.
  let className = '';
  if (v.flame) className = 'aura-name-flame';
  else if (v.flicker) className = 'aura-name-flicker';
  else if (glow.shimmer) className = 'aura-name-shimmer';
  else if (glow.pulse) className = 'aura-name-pulse';

  return {
    style: `text-shadow:${shadow};--glow-color:${col};`,
    className,
    color: col,
  };
}

/**
 * Base text color for a username wearing this Name Color cosmetic.
 * Independent of font and aura — if nothing is equipped, caller should
 * fall back to the default white.
 * @param {{rarity:string, preview_key:string}|null} nameColor
 */
export function nameColorStyle(nameColor) {
  if (!nameColor) return { style: '', className: '' };
  const v = VISUALS[nameColor.preview_key] || {};
  if (v.prismatic) {
    return {
      style: `background:linear-gradient(90deg,#ff5f6d,#ffc371,#47e3a3,#4facfe,#a18cd1,#ff5f6d);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;`,
      className: 'prismatic-text',
    };
  }
  const col = v.color || RARITY_COLORS[nameColor.rarity] || '#fff';
  return { style: `color:${col};`, className: '' };
}

/**
 * Typography AND fill technique (family/weight/style/spacing, plus any
 * outline/neon, gold-fill, chrome-shine, or deep-shadow flourish the font
 * carries) for a username wearing this Name Font cosmetic.
 *
 * Note: outline and goldFill are fill techniques in their own right and
 * intentionally take over the text color, overriding whatever Name Color
 * is also equipped — same as the shop preview already implied.
 * @param {{rarity:string, preview_key:string}|null} font
 */
export function nameFontFamily(font) {
  if (!font) return { style: '', className: '' };
  const v = VISUALS[font.preview_key] || {};
  const parts = [
    v.font ? `font-family:${v.font};` : '',
    v.weight ? `font-weight:${v.weight};` : '',
    v.style ? `font-style:${v.style};` : '',
    v.spacing ? `letter-spacing:${v.spacing};` : '',
  ];
  let className = '';

  if (v.outline) {
    const col = v.neonColor || '#22e5ff';
    parts.push(`color:transparent;-webkit-text-stroke:1.5px ${col};text-shadow:0 0 6px ${col},0 0 16px ${col}99,0 0 28px ${col}55;`);
    className = 'name-font-neon';
  } else if (v.goldFill) {
    parts.push(`background:linear-gradient(120deg,#fff6d8,#D4AF37,#9c7a1f,#D4AF37,#fff6d8);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;`);
    className = 'name-font-goldshine';
  } else if (v.deepShadow) {
    parts.push(`text-shadow:2px 2px 0 rgba(0,0,0,.6);`);
  } else if (v.shadow) {
    parts.push(`text-shadow:0 1px 0 rgba(255,255,255,.6),0 -1px 0 rgba(0,0,0,.5);`);
  }

  return { style: parts.join(''), className };
}

export const COSMETIC_PREVIEW_KEYFRAMES = `
  @keyframes prismaticShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes frameGlowPulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }
  @keyframes frameGlowExotic { 0%,100%{filter:brightness(1) hue-rotate(0deg)} 35%{filter:brightness(1.35) hue-rotate(15deg)} 70%{filter:brightness(1.15) hue-rotate(-10deg)} 100%{filter:brightness(1) hue-rotate(0deg)} }
  @keyframes auraNamePulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.5)} }
  @keyframes auraNameFlame { 0%,100%{text-shadow:0 0 10px var(--glow-color),0 0 20px var(--glow-color)} 50%{text-shadow:0 0 20px var(--glow-color),0 0 38px #fbbf24} }
  @keyframes auraNameFlicker { 0%,100%{opacity:1} 45%{opacity:.55} 55%{opacity:.95} }
  @keyframes auraNameShimmer { 0%,100%{filter:brightness(1) hue-rotate(0deg)} 50%{filter:brightness(1.4) hue-rotate(20deg)} }
  @keyframes neonFlicker { 0%,100%{opacity:1} 48%{opacity:.45} 52%{opacity:1} 74%{opacity:.8} }
  @keyframes goldShine { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }

  .ring-pulse{animation:frameGlowPulse 2s ease-in-out infinite}
  .ring-shimmer{animation:frameGlowExotic 3.2s ease-in-out infinite}
  .aura-name-pulse{animation:auraNamePulse 1.8s ease-in-out infinite}
  .aura-name-flame{animation:auraNameFlame 1.2s ease-in-out infinite}
  .aura-name-flicker{animation:auraNameFlicker 2.4s ease-in-out infinite}
  .aura-name-shimmer{animation:auraNameShimmer 2.8s ease-in-out infinite}
  .name-font-neon{animation:neonFlicker 2.6s ease-in-out infinite}
  .name-font-goldshine{background-size:200% 100%;animation:goldShine 4s linear infinite}
  .prismatic-text{animation:prismaticShift 3s linear infinite}

  .prev-badge-chip{display:inline-flex;align-items:center;justify-content:center;padding:7px 11px;border-radius:14px;border:1px solid}
  .prev-badge-icon{font-size:18px;line-height:1}

  .prev-color-wrap{display:flex;flex-direction:column;align-items:center;gap:4px}
  .prev-color-dot{width:14px;height:14px;border-radius:50%}

  /* --- Avatar Frame recipes (renderAvatarFrame) --- */
  @keyframes cfGlint { 0%,100%{opacity:.2;transform:rotate(40deg) translateY(var(--ty)) scale(.6)} 50%{opacity:1;transform:rotate(40deg) translateY(var(--ty)) scale(1.2)} }
  @keyframes cfGlint2 { 0%,100%{opacity:.25} 50%{opacity:1} }
  @keyframes cfHalo { 0%{transform:scale(.9);opacity:.6} 100%{transform:scale(1.35);opacity:0} }
  @keyframes cfSpin { to{transform:rotate(360deg)} }
  @keyframes cfDiamondPulse { 0%,100%{filter:brightness(1) saturate(1);transform:scale(1)} 50%{filter:brightness(1.6) saturate(1.35);transform:scale(1.05)} }
  @keyframes cfRay { 0%,100%{opacity:.1} 50%{opacity:.95} }
  @keyframes cfTwinkle { 0%,100%{opacity:.15;transform:rotate(var(--rot)) translateY(var(--ty)) scale(.6)} 50%{opacity:1;transform:rotate(var(--rot)) translateY(var(--ty)) scale(1.3)} }
  @keyframes cfOrbit { from{transform:rotate(0deg) translateX(var(--r))} to{transform:rotate(360deg) translateX(var(--r))} }
  @keyframes cfPhoenixCycle { 0%{filter:brightness(.55) saturate(.6) hue-rotate(0deg)} 30%{filter:brightness(.5) saturate(.5) hue-rotate(-5deg)} 55%{filter:brightness(1.5) saturate(1.4) hue-rotate(10deg)} 100%{filter:brightness(.55) saturate(.6) hue-rotate(0deg)} }
  @keyframes cfSmoke { 0%{transform:translate(0,0) scale(.6);opacity:.35} 100%{transform:translate(var(--sdx,0px),var(--sty,-40px)) scale(1.4);opacity:0} }
  @keyframes cfSpark { 0%{transform:translate(0,0) scale(1);opacity:.9} 100%{transform:translate(var(--dx,0px),var(--pty,-46px)) scale(.3);opacity:0} }
  @keyframes cfStarTw { 0%,100%{opacity:.15} 50%{opacity:.9} }
  @keyframes cfCoronaSpin { to{transform:rotate(360deg)} }
  @keyframes cfCoronaRay { 0%,100%{opacity:.15} 50%{opacity:.8} }
  @keyframes cfEclipsePass { 0%,100%{transform:translateX(calc(var(--swing) * -1)) scale(1)} 50%{transform:translateX(var(--swing)) scale(1.08)} }
  @keyframes cfEclipseHue { 0%,100%{filter:brightness(1) hue-rotate(0deg)} 50%{filter:brightness(1.45) hue-rotate(25deg)} }
  @keyframes cfDiamondFlare { 0%,38%,100%{opacity:0;transform:scale(.5)} 50%{opacity:1;transform:scale(1.3)} 62%{opacity:0;transform:scale(.6)} }
`;

export const CATEGORY_LABELS = {
  avatar_frame: 'Avatar Frame',
  chat_badge:   'Chat Badge',
  status_title: 'Status Title',
  name_font:    'Name Font',
  name_color:   'Name Color',
  name_aura:    'Name Aura',
  custom_emoji: 'Custom Emoji',
};

export { RARITY_COLORS };

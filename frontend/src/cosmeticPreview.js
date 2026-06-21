// Shared cosmetic preview rendering — used by both shop.js and profile.js so
// the same item looks identical wherever it's shown. Previously every single
// cosmetic rendered as a generic 🎨 regardless of category/name; this maps
// each of the 84 catalog items (by preview_key) to something that actually
// reflects what it is.

const RARITY_COLORS = {
  Common:    '#9ca3af',
  Rare:      '#3b82f6',
  Epic:      '#a855f7',
  Legendary: '#D4AF37',
  Exotic:    '#f97316',
};

// Glow intensity scales with rarity — Exotic items should visibly announce themselves.
const RARITY_GLOW = {
  Common:    { blur: 6,  spread: 0,  opacity: 0.25, pulse: false },
  Rare:      { blur: 10, spread: 1,  opacity: 0.35, pulse: false },
  Epic:      { blur: 16, spread: 1,  opacity: 0.45, pulse: false },
  Legendary: { blur: 22, spread: 2,  opacity: 0.55, pulse: true  },
  Exotic:    { blur: 30, spread: 3,  opacity: 0.7,  pulse: true  },
};

// preview_key -> { icon, color (hex override), font (for name_font items) }
const VISUALS = {
  // Avatar Frame
  frame_iron_ring:       { icon: '⚙️' },
  frame_felt_border:     { icon: '🟢' },
  frame_chip_stack:      { icon: '🪙' },
  frame_copper_edge:     { icon: '🔶' },
  frame_emerald_ring:    { icon: '💚' },
  frame_sapphire_halo:   { icon: '💙' },
  frame_silver_crescent: { icon: '🌙' },
  frame_gold_crown:      { icon: '👑' },
  frame_velvet_curtain:  { icon: '🎭' },
  frame_diamond_crown:   { icon: '💎' },
  frame_phoenix_wing:    { icon: '🪶' },
  frame_eclipse:         { icon: '🌑' },

  // Chat Badge
  badge_lucky_clover:  { icon: '🍀' },
  badge_dice_pip:      { icon: '🎲' },
  badge_poker_chip:    { icon: '🪙' },
  badge_ace_card:      { icon: '🃏' },
  badge_neon_skull:    { icon: '💀' },
  badge_cherry_bomb:   { icon: '💣' },
  badge_crystal_ball:  { icon: '🔮' },
  badge_black_diamond: { icon: '♦️' },
  badge_flame_sigil:   { icon: '🔥' },
  badge_golden_skull:  { icon: '💀' },
  badge_royal_seal:    { icon: '🛡️' },
  badge_void_sigil:    { icon: '🌀' },

  // Display Name Font — rendered as a styled "Aa" sample, not an icon
  font_mono:           { font: "'Courier New', monospace" },
  font_slab:           { font: "Georgia, serif", weight: 900 },
  font_rounded:        { font: "Verdana, sans-serif", spacing: '0.04em' },
  font_typewriter:     { font: "'Courier New', monospace", style: 'italic' },
  font_obsidian:       { font: "Georgia, serif", weight: 900, spacing: '-0.02em' },
  font_velvet_script:  { font: "'Dancing Script', cursive" },
  font_chrome:         { font: "Arial, sans-serif", weight: 800, shadow: true },
  font_royal_serif:    { font: "'Cinzel', serif" },
  font_neon_outline:   { font: "Arial, sans-serif", weight: 800, outline: true },
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

  // Display Name Aura — the glow-around-username cosmetic, rendered as a glow swatch
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
  if (g.pulse) layers.push(`0 0 ${g.blur * 2}px ${color}33`);
  return layers.join(', ');
}

/**
 * Returns { boxStyle, innerHTML } for a cosmetic preview box.
 * @param {{category:string, rarity:string, preview_key:string, name:string}} item
 */
export function renderCosmeticPreview(item) {
  const rarityCol = RARITY_COLORS[item.rarity] || RARITY_COLORS.Common;
  const v = VISUALS[item.preview_key] || {};
  const glow = RARITY_GLOW[item.rarity] || RARITY_GLOW.Common;

  if (item.category === 'status_title') {
    return {
      boxStyle: `background:${rarityCol}14;`,
      innerHTML: `<span style="font-size:13px;font-style:italic;font-weight:700;color:${rarityCol};text-shadow:${glowStyle(rarityCol, item.rarity)};text-align:center;padding:0 6px">"${item.name}"</span>`,
    };
  }

  if (item.category === 'name_font') {
    const fontFamily = v.font || 'inherit';
    const extra = [
      v.weight ? `font-weight:${v.weight};` : '',
      v.style ? `font-style:${v.style};` : '',
      v.spacing ? `letter-spacing:${v.spacing};` : '',
      v.outline ? `color:transparent;-webkit-text-stroke:1.5px ${rarityCol};` : `color:${rarityCol};`,
      v.goldFill ? `background:linear-gradient(135deg,#fff6d8,#D4AF37,#9c7a1f);-webkit-background-clip:text;background-clip:text;color:transparent;` : '',
      v.deepShadow ? `text-shadow:2px 2px 0 rgba(0,0,0,.6);` : '',
      v.shadow ? `text-shadow:0 1px 0 #fff,0 -1px 0 #444;` : '',
    ].join('');
    return {
      boxStyle: `background:${rarityCol}10;`,
      innerHTML: `<span style="font-size:26px;font-family:${fontFamily};${extra}">Aa</span>`,
    };
  }

  if (item.category === 'name_color') {
    if (v.prismatic) {
      return {
        boxStyle: `background:linear-gradient(135deg,#ff5f6d,#ffc371,#47e3a3,#4facfe,#a18cd1);background-size:300% 300%;animation:prismaticShift 3s ease infinite;`,
        innerHTML: `<span style="font-size:22px;color:#fff;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.4)">Aa</span>`,
      };
    }
    const col = v.color || rarityCol;
    return {
      boxStyle: `background:${col}1a;`,
      innerHTML: `<div style="width:30px;height:30px;border-radius:50%;background:${col};box-shadow:0 0 14px 2px ${col}88"></div>`,
    };
  }

  if (item.category === 'name_aura') {
    const col = v.color || rarityCol;
    const pulseClass = glow.pulse ? 'aura-pulse' : '';
    const flameClass = v.flame ? 'aura-flame' : '';
    const flickerClass = v.flicker ? 'aura-flicker' : '';
    return {
      boxStyle: `background:radial-gradient(circle, ${col}33, transparent 70%);`,
      innerHTML: `<div class="aura-dot ${pulseClass} ${flameClass} ${flickerClass}" style="--aura-color:${col};box-shadow:${glowStyle(col, item.rarity)}"></div>`,
    };
  }

  if (item.category === 'custom_emoji') {
    return {
      boxStyle: `background:${rarityCol}10;`,
      innerHTML: `<span style="font-size:22px;letter-spacing:2px">${v.icon || '😎'}</span>`,
    };
  }

  // avatar_frame, chat_badge, and any fallback — icon in a glowing ring
  return {
    boxStyle: `background:${rarityCol}14;`,
    innerHTML: `<span style="font-size:26px;filter:drop-shadow(0 0 6px ${rarityCol}88)">${v.icon || '🎁'}</span>`,
  };
}

/**
 * Returns { style, className, color } for rendering a USERNAME wearing this
 * aura — a real glow on the text itself, not just a color tint. This is
 * separate from renderCosmeticPreview's small dot because text needs
 * text-shadow-based glow, not transform/scale (which would distort letters).
 * @param {{rarity:string, preview_key:string}|null} aura
 */
export function auraNameStyle(aura) {
  if (!aura) return { style: '', className: '', color: null };
  const v = VISUALS[aura.preview_key] || {};
  const col = v.color || RARITY_COLORS[aura.rarity] || '#10b981';
  const glow = RARITY_GLOW[aura.rarity] || RARITY_GLOW.Common;
  const shadow = `0 0 ${glow.blur}px ${col}, 0 0 ${glow.blur * 1.8}px ${col}99`;

  let className = '';
  if (v.flame) className = 'aura-name-flame';
  else if (v.flicker) className = 'aura-name-flicker';
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
 * Typography ONLY (family/weight/style/spacing) for a username wearing this
 * Name Font cosmetic. Deliberately excludes the outline/goldFill/shadow
 * flourishes used in renderCosmeticPreview's browse swatch — those bake in a
 * fill color, which would fight with whatever Name Color is also equipped.
 * Font and color are independent layers; live rendering keeps them that way.
 */
export function nameFontFamily(font) {
  if (!font) return '';
  const v = VISUALS[font.preview_key] || {};
  return [
    v.font ? `font-family:${v.font};` : '',
    v.weight ? `font-weight:${v.weight};` : '',
    v.style ? `font-style:${v.style};` : '',
    v.spacing ? `letter-spacing:${v.spacing};` : '',
  ].join('');
}

/**
 * Glowing, rarity-scaled ring + icon badge for an avatar wearing this
 * Avatar Frame cosmetic — not just a flat border-color swap.
 * @param {{rarity:string, preview_key:string}|null} frame
 */
export function frameRingStyle(frame) {
  if (!frame) return { style: '', className: '', icon: null };
  const v = VISUALS[frame.preview_key] || {};
  const col = RARITY_COLORS[frame.rarity] || '#9ca3af';
  return {
    style: `border-color:${col};box-shadow:${glowStyle(col, frame.rarity)};`,
    className: (RARITY_GLOW[frame.rarity] || RARITY_GLOW.Common).pulse ? 'frame-ring-pulse' : '',
    icon: v.icon || null,
  };
}

export const COSMETIC_PREVIEW_KEYFRAMES = `
  @keyframes prismaticShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  @keyframes auraPulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.25);opacity:.7} }
  @keyframes auraFlame { 0%,100%{transform:scale(1) rotate(0deg);filter:hue-rotate(0deg)} 50%{transform:scale(1.15) rotate(3deg);filter:hue-rotate(15deg)} }
  @keyframes auraFlicker { 0%,100%{opacity:1} 45%{opacity:.5} 55%{opacity:.9} }
  .aura-dot{width:26px;height:26px;border-radius:50%;background:var(--aura-color)}
  .aura-pulse{animation:auraPulse 1.8s ease-in-out infinite}
  .aura-flame{animation:auraFlame 1.2s ease-in-out infinite}
  .aura-flicker{animation:auraFlicker 2.4s ease-in-out infinite}

  @keyframes auraNamePulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.5)} }
  @keyframes auraNameFlame { 0%,100%{text-shadow:0 0 10px var(--glow-color),0 0 20px var(--glow-color)} 50%{text-shadow:0 0 20px var(--glow-color),0 0 38px #fbbf24} }
  @keyframes auraNameFlicker { 0%,100%{opacity:1} 45%{opacity:.55} 55%{opacity:.95} }
  .aura-name-pulse{animation:auraNamePulse 1.8s ease-in-out infinite}
  .aura-name-flame{animation:auraNameFlame 1.2s ease-in-out infinite}
  .aura-name-flicker{animation:auraNameFlicker 2.4s ease-in-out infinite}

  @keyframes frameGlowPulse { 0%,100%{filter:brightness(1)} 50%{filter:brightness(1.3)} }
  .frame-ring-pulse{animation:frameGlowPulse 2s ease-in-out infinite}
  .prismatic-text{animation:prismaticShift 3s linear infinite}
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

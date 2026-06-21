// Shared cosmetic preview rendering — used by both shop.js and profile.js so
// the same item looks identical wherever it's shown.
//
// Revamp notes (this pass):
// - Avatar Frame and Chat Badge now carry a per-item identity color, not just
//   the rarity tier color — two Common frames no longer look identical.
// - Avatar Frame renders as an actual ring around a placeholder avatar (with
//   a corner ornament icon) instead of a flat icon-in-a-box, in both the
//   shop/profile preview swatch AND the real profile hero avatar.
// - Chat Badge renders as a pill/chip shape so it doesn't look like a frame.
// - Name Aura's preview swatch now renders real sample text using the exact
//   same glow function as the live equipped name (auraNameStyle), instead of
//   a disconnected glowing dot — what you see in the shop is what you get.
// - Name Font now carries its FULL visual identity (outline/neon, gold fill,
//   chrome shine, deep shadow) into the equipped/live rendering, not just
//   into the preview swatch — previously nameFontFamily() silently dropped
//   all of that and equipped fonts fell back to plain colored text.
// - Exotic rarity gets its own animation flavor (hue-shimmer) instead of just
//   a bigger version of the Legendary pulse, so the top tier actually reads
//   as categorically rarer.

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

// preview_key -> visual identity.
// avatar_frame: `color` is the item's own identity color (ring color),
//   independent of rarity — rarity only affects glow strength/animation.
// chat_badge: `tint` is a subtle background tint matching the badge's theme;
//   the icon stays the primary identity, same as before.
// name_font: `neonColor` is the actual neon tube color for the outline font.
const VISUALS = {
  // Avatar Frame
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

// Resolves an Avatar Frame's full visual identity: its own color (falling
// back to rarity color only if the item has none), the icon for its corner
// ornament, the rarity-scaled glow, and which animation class — if any —
// the rarity tier earns. Shared by the preview swatch and the live ring.
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
    const { color, icon, boxShadow, className } = resolveFrameVisual(item);
    return {
      boxStyle: `background:${color}14;`,
      innerHTML: `<div class="prev-frame-wrap">
        <div class="prev-frame-ring ${className}" style="border-color:${color};box-shadow:${boxShadow}"><span class="prev-frame-av">👤</span></div>
        <span class="prev-frame-badge" style="border-color:${color}">${icon}</span>
      </div>`,
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
 * Previously this only carried family/weight/style/spacing through to the
 * live equipped name — outline, goldFill, shadow, and deepShadow were only
 * ever applied in the shop preview swatch, so equipped fonts like Neon
 * Outline, Engraved Gold, Chrome, and Shadow Bold silently fell back to
 * plain colored text once worn. Now both paths use this function, so the
 * preview and the live name always match.
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

/**
 * Resolved ring style for an avatar wearing this Avatar Frame cosmetic —
 * the item's OWN identity color (not just rarity), a rarity-scaled glow,
 * and a className for whichever animation the rarity tier earns. The
 * className is meant for the actual ring element (not a small badge) so
 * the headline visual reacts, not just a corner icon.
 * @param {{rarity:string, preview_key:string}|null} frame
 */
export function frameRingStyle(frame) {
  if (!frame) return { style: '', className: '', icon: null, color: null };
  const { color, icon, boxShadow, className } = resolveFrameVisual(frame);
  return {
    style: `border-color:${color};box-shadow:${boxShadow};`,
    className,
    icon,
    color,
  };
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

  .prev-frame-wrap{position:relative;width:36px;height:36px}
  .prev-frame-ring{width:36px;height:36px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04)}
  .prev-frame-av{font-size:16px;opacity:.85}
  .prev-frame-badge{position:absolute;bottom:-3px;right:-3px;width:15px;height:15px;border-radius:50%;border:1.5px solid;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;background:#0a0a0a}

  .prev-badge-chip{display:inline-flex;align-items:center;justify-content:center;padding:7px 11px;border-radius:14px;border:1px solid}
  .prev-badge-icon{font-size:18px;line-height:1}

  .prev-color-wrap{display:flex;flex-direction:column;align-items:center;gap:4px}
  .prev-color-dot{width:14px;height:14px;border-radius:50%}
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

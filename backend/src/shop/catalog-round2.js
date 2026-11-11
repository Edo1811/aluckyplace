// Cosmetics round 2 — catalog rows for the new animated cosmetics.
// Seeded idempotently on startup (ensureSchema → seedRound2Catalog): a row is
// only inserted if no catalog row with that preview_key exists yet, so this is
// safe to run on every boot and never touches items players already own.
// The visuals for every preview_key live in frontend/src/cosmeticFx.js.
// New categories: win_effect (plays on 10x+ wins) and profile_backdrop.

const ROUND2_CATALOG = [
  // Big win FX
  { name: 'Coin Fountain', category: 'win_effect', rarity: 'Common', preview_key: 'fx_coin_fountain' },
  { name: 'Confetti Pop', category: 'win_effect', rarity: 'Common', preview_key: 'fx_confetti_pop' },
  { name: 'Chip Shower', category: 'win_effect', rarity: 'Rare', preview_key: 'fx_chip_shower' },
  { name: '777', category: 'win_effect', rarity: 'Rare', preview_key: 'fx_triple_seven' },
  { name: 'Money Printer', category: 'win_effect', rarity: 'Rare', preview_key: 'fx_money_printer' },
  { name: 'Firework', category: 'win_effect', rarity: 'Epic', preview_key: 'fx_firework' },
  { name: 'Cash Slam', category: 'win_effect', rarity: 'Epic', preview_key: 'fx_cash_slam' },
  { name: 'Shockwave', category: 'win_effect', rarity: 'Epic', preview_key: 'fx_shockwave' },
  { name: 'Lightning Strike', category: 'win_effect', rarity: 'Epic', preview_key: 'fx_lightning' },
  { name: 'Gold Rain', category: 'win_effect', rarity: 'Legendary', preview_key: 'fx_gold_rain' },
  { name: 'Comet', category: 'win_effect', rarity: 'Legendary', preview_key: 'fx_comet' },
  { name: 'Vault Burst', category: 'win_effect', rarity: 'Legendary', preview_key: 'fx_vault_burst' },
  { name: 'Supernova', category: 'win_effect', rarity: 'Legendary', preview_key: 'fx_supernova' },
  { name: 'Black Hole', category: 'win_effect', rarity: 'Exotic', preview_key: 'fx_black_hole' },
  { name: 'Jackpot.exe', category: 'win_effect', rarity: 'Exotic', preview_key: 'fx_jackpot_exe' },
  // Profile backdrops
  { name: 'Green Felt', category: 'profile_backdrop', rarity: 'Common', preview_key: 'bg_green_felt' },
  { name: 'Red Felt', category: 'profile_backdrop', rarity: 'Common', preview_key: 'bg_red_felt' },
  { name: 'Back Alley', category: 'profile_backdrop', rarity: 'Common', preview_key: 'bg_back_alley' },
  { name: 'Neon Strip', category: 'profile_backdrop', rarity: 'Rare', preview_key: 'bg_neon_strip' },
  { name: 'Vault Door', category: 'profile_backdrop', rarity: 'Rare', preview_key: 'bg_vault_door' },
  { name: 'Poker Table', category: 'profile_backdrop', rarity: 'Rare', preview_key: 'bg_poker_table' },
  { name: 'Rainy Window', category: 'profile_backdrop', rarity: 'Rare', preview_key: 'bg_rainy_window' },
  { name: 'Spinning Reels', category: 'profile_backdrop', rarity: 'Epic', preview_key: 'bg_spinning_reels' },
  { name: 'City Skyline', category: 'profile_backdrop', rarity: 'Epic', preview_key: 'bg_skyline' },
  { name: 'Starfield', category: 'profile_backdrop', rarity: 'Epic', preview_key: 'bg_starfield' },
  { name: 'Deep Sea', category: 'profile_backdrop', rarity: 'Epic', preview_key: 'bg_deep_sea' },
  { name: 'Aurora', category: 'profile_backdrop', rarity: 'Legendary', preview_key: 'bg_aurora' },
  { name: 'Gold Vault', category: 'profile_backdrop', rarity: 'Legendary', preview_key: 'bg_gold_vault' },
  { name: 'Magma', category: 'profile_backdrop', rarity: 'Legendary', preview_key: 'bg_magma' },
  { name: 'Event Horizon', category: 'profile_backdrop', rarity: 'Exotic', preview_key: 'bg_event_horizon' },
  // Avatar frames (canvas-drawn)
  { name: 'Cash Band', category: 'avatar_frame', rarity: 'Common', preview_key: 'frame_cash_band' },
  { name: 'Dealer Button', category: 'avatar_frame', rarity: 'Common', preview_key: 'frame_dealer_button' },
  { name: 'Pixel Ring', category: 'avatar_frame', rarity: 'Common', preview_key: 'frame_pixel_ring' },
  { name: 'Dice Orbit', category: 'avatar_frame', rarity: 'Rare', preview_key: 'frame_dice_orbit' },
  { name: 'Laurel Wreath', category: 'avatar_frame', rarity: 'Rare', preview_key: 'frame_laurel' },
  { name: 'Thorn Vine', category: 'avatar_frame', rarity: 'Rare', preview_key: 'frame_thorn_vine' },
  { name: 'Hourglass', category: 'avatar_frame', rarity: 'Rare', preview_key: 'frame_hourglass' },
  { name: 'Neon Sign', category: 'avatar_frame', rarity: 'Epic', preview_key: 'frame_neon_sign' },
  { name: 'Card Fan', category: 'avatar_frame', rarity: 'Epic', preview_key: 'frame_card_fan' },
  { name: 'Slot Reel Ring', category: 'avatar_frame', rarity: 'Epic', preview_key: 'frame_slot_ring' },
  { name: 'Ice Crystal', category: 'avatar_frame', rarity: 'Epic', preview_key: 'frame_ice_crystal' },
  { name: 'Sakura', category: 'avatar_frame', rarity: 'Epic', preview_key: 'frame_sakura' },
  { name: 'Lightning Ring', category: 'avatar_frame', rarity: 'Legendary', preview_key: 'frame_lightning_ring' },
  { name: 'Lava Crack', category: 'avatar_frame', rarity: 'Legendary', preview_key: 'frame_lava_crack' },
  { name: 'Hologram', category: 'avatar_frame', rarity: 'Legendary', preview_key: 'frame_hologram' },
  { name: 'Galaxy Orbit', category: 'avatar_frame', rarity: 'Legendary', preview_key: 'frame_galaxy_orbit' },
  { name: 'Black Hole', category: 'avatar_frame', rarity: 'Exotic', preview_key: 'frame_black_hole' },
  { name: 'Hollow Purple', category: 'avatar_frame', rarity: 'Exotic', preview_key: 'frame_hollow_purple' },
  // Title packs — 15 themed packs × 4 titles
  { name: 'Down bad', category: 'status_title', rarity: 'Common', preview_key: 'title_down_bad' }, // Down Bad
  { name: 'Rent money gone', category: 'status_title', rarity: 'Rare', preview_key: 'title_rent_money_gone' }, // Down Bad
  { name: 'Living on dailies', category: 'status_title', rarity: 'Epic', preview_key: 'title_living_on_dailies' }, // Down Bad
  { name: 'Rock bottom resident', category: 'status_title', rarity: 'Legendary', preview_key: 'title_rock_bottom_resident' }, // Down Bad
  { name: 'Just one more', category: 'status_title', rarity: 'Common', preview_key: 'title_just_one_more' }, // Degen
  { name: 'Max bet merchant', category: 'status_title', rarity: 'Rare', preview_key: 'title_max_bet_merchant' }, // Degen
  { name: 'Certified degen', category: 'status_title', rarity: 'Epic', preview_key: 'title_certified_degen' }, // Degen
  { name: 'All in or nothing', category: 'status_title', rarity: 'Legendary', preview_key: 'title_all_in_or_nothing' }, // Degen
  { name: 'Next one hits', category: 'status_title', rarity: 'Common', preview_key: 'title_next_one_hits' }, // Delusion
  { name: 'Due for a win', category: 'status_title', rarity: 'Rare', preview_key: 'title_due_for_a_win' }, // Delusion
  { name: 'I can feel it', category: 'status_title', rarity: 'Epic', preview_key: 'title_i_can_feel_it' }, // Delusion
  { name: 'The RNG loves me', category: 'status_title', rarity: 'Legendary', preview_key: 'title_the_rng_loves_me' }, // Delusion
  { name: '0 CC', category: 'status_title', rarity: 'Common', preview_key: 'title_0_cc' }, // Broke Era
  { name: 'Bankroll? Never heard of her', category: 'status_title', rarity: 'Rare', preview_key: 'title_bankroll_never_heard_of_her' }, // Broke Era
  { name: 'Negative aura', category: 'status_title', rarity: 'Epic', preview_key: 'title_negative_aura' }, // Broke Era
  { name: 'Broke but beautiful', category: 'status_title', rarity: 'Legendary', preview_key: 'title_broke_but_beautiful' }, // Broke Era
  { name: 'It was rigged', category: 'status_title', rarity: 'Common', preview_key: 'title_it_was_rigged' }, // Cope
  { name: 'Lag cost me', category: 'status_title', rarity: 'Rare', preview_key: 'title_lag_cost_me' }, // Cope
  { name: 'Wasn\'t even trying', category: 'status_title', rarity: 'Epic', preview_key: 'title_wasn_t_even_trying' }, // Cope
  { name: 'Playing for fun btw', category: 'status_title', rarity: 'Legendary', preview_key: 'title_playing_for_fun_btw' }, // Cope
  { name: 'Mildly tilted', category: 'status_title', rarity: 'Common', preview_key: 'title_mildly_tilted' }, // Tilt
  { name: 'Rage clicker', category: 'status_title', rarity: 'Rare', preview_key: 'title_rage_clicker' }, // Tilt
  { name: 'Monitor puncher', category: 'status_title', rarity: 'Epic', preview_key: 'title_monitor_puncher' }, // Tilt
  { name: 'Full tilt', category: 'status_title', rarity: 'Legendary', preview_key: 'title_full_tilt' }, // Tilt
  { name: 'Unfriendly', category: 'status_title', rarity: 'Common', preview_key: 'title_unfriendly' }, // Villain Arc
  { name: 'Coin thief', category: 'status_title', rarity: 'Rare', preview_key: 'title_coin_thief' }, // Villain Arc
  { name: 'Duel menace', category: 'status_title', rarity: 'Epic', preview_key: 'title_duel_menace' }, // Villain Arc
  { name: 'The house fears me', category: 'status_title', rarity: 'Exotic', preview_key: 'title_the_house_fears_me' }, // Villain Arc
  { name: 'Peasant', category: 'status_title', rarity: 'Common', preview_key: 'title_peasant' }, // Royalty
  { name: 'Baron of bets', category: 'status_title', rarity: 'Rare', preview_key: 'title_baron_of_bets' }, // Royalty
  { name: 'Duke of dice', category: 'status_title', rarity: 'Epic', preview_key: 'title_duke_of_dice' }, // Royalty
  { name: 'Crowned by luck', category: 'status_title', rarity: 'Legendary', preview_key: 'title_crowned_by_luck' }, // Royalty
  { name: 'No thoughts, just spins', category: 'status_title', rarity: 'Common', preview_key: 'title_no_thoughts_just_spins' }, // Brainrot
  { name: 'Gambling is my cardio', category: 'status_title', rarity: 'Rare', preview_key: 'title_gambling_is_my_cardio' }, // Brainrot
  { name: 'Aura farming', category: 'status_title', rarity: 'Epic', preview_key: 'title_aura_farming' }, // Brainrot
  { name: 'Ohio high roller', category: 'status_title', rarity: 'Legendary', preview_key: 'title_ohio_high_roller' }, // Brainrot
  { name: 'Four leaf', category: 'status_title', rarity: 'Common', preview_key: 'title_four_leaf' }, // Lucky Charms
  { name: 'Horseshoe', category: 'status_title', rarity: 'Rare', preview_key: 'title_horseshoe' }, // Lucky Charms
  { name: 'Rabbit\'s foot', category: 'status_title', rarity: 'Epic', preview_key: 'title_rabbit_s_foot' }, // Lucky Charms
  { name: 'Blessed by RNG', category: 'status_title', rarity: 'Legendary', preview_key: 'title_blessed_by_rng' }, // Lucky Charms
  { name: 'Daily claimer', category: 'status_title', rarity: 'Common', preview_key: 'title_daily_claimer' }, // Grindset
  { name: 'Streak keeper', category: 'status_title', rarity: 'Rare', preview_key: 'title_streak_keeper' }, // Grindset
  { name: 'Day 10 forever', category: 'status_title', rarity: 'Epic', preview_key: 'title_day_10_forever' }, // Grindset
  { name: 'Never missed a day', category: 'status_title', rarity: 'Legendary', preview_key: 'title_never_missed_a_day' }, // Grindset
  { name: 'EV enjoyer', category: 'status_title', rarity: 'Common', preview_key: 'title_ev_enjoyer' }, // Nerd Stats
  { name: 'Variance victim', category: 'status_title', rarity: 'Rare', preview_key: 'title_variance_victim' }, // Nerd Stats
  { name: 'Kelly criterion', category: 'status_title', rarity: 'Epic', preview_key: 'title_kelly_criterion' }, // Nerd Stats
  { name: 'Provably fair', category: 'status_title', rarity: 'Legendary', preview_key: 'title_provably_fair' }, // Nerd Stats
  { name: 'Table regular', category: 'status_title', rarity: 'Common', preview_key: 'title_table_regular' }, // Casino Lore
  { name: 'Pit boss', category: 'status_title', rarity: 'Rare', preview_key: 'title_pit_boss' }, // Casino Lore
  { name: 'High roller', category: 'status_title', rarity: 'Epic', preview_key: 'title_high_roller' }, // Casino Lore
  { name: 'Whale', category: 'status_title', rarity: 'Legendary', preview_key: 'title_whale' }, // Casino Lore
  { name: 'Coinflip goblin', category: 'status_title', rarity: 'Common', preview_key: 'title_coinflip_goblin' }, // PvP
  { name: 'RPS prophet', category: 'status_title', rarity: 'Rare', preview_key: 'title_rps_prophet' }, // PvP
  { name: 'UNO reverse card', category: 'status_title', rarity: 'Epic', preview_key: 'title_uno_reverse_card' }, // PvP
  { name: 'Undefeated', category: 'status_title', rarity: 'Exotic', preview_key: 'title_undefeated' }, // PvP
  { name: 'Touched grass once', category: 'status_title', rarity: 'Epic', preview_key: 'title_touched_grass_once' }, // Mythic
  { name: 'Beat the house', category: 'status_title', rarity: 'Legendary', preview_key: 'title_beat_the_house' }, // Mythic
  { name: 'Main character', category: 'status_title', rarity: 'Exotic', preview_key: 'title_main_character' }, // Mythic
  { name: 'The lucky one', category: 'status_title', rarity: 'Exotic', preview_key: 'title_the_lucky_one' }, // Mythic
];

async function seedRound2Catalog(query) {
  let added = 0;
  for (const it of ROUND2_CATALOG) {
    const res = await query(
      `INSERT INTO cosmetics_catalog (name, category, rarity, preview_key, is_obtainable)
       SELECT $1::varchar, $2::varchar, $3::varchar, $4::varchar, TRUE
       WHERE NOT EXISTS (SELECT 1 FROM cosmetics_catalog WHERE preview_key = $4::varchar)`,
      [it.name, it.category, it.rarity, it.preview_key]
    );
    added += res.rowCount || 0;
  }
  return added;
}

module.exports = { ROUND2_CATALOG, seedRound2Catalog };

'use strict';

// Shared score/name validation, used by the legacy POST /api/ranking and by the new
// POST /api/plays. Extracted verbatim from server.js so behavior does not change.

const GAMES = new Set(['catcher', 'runner', 'ninja']);

// Generous score ceilings: rate (points/second of real play) plus a flat cushion for
// fast starts (a golden item early, a quick combo), capped by an absolute sanity ceiling.
// Read from each game's own scoring code (js/pizza-*.js) and doubled over a strong
// legitimate run so real play is never rejected; only implausible/tampered scores are.
const SCORE_LIMITS = {
  // Catcher has no clock cap; max sane pace ~ golden(50)/0.4s early game. 60/s covers that with room.
  catcher: { ratePerSecond: 60, base: 400, absoluteMax: 200000 },
  // Runner score = coins(5 each) + floor(distance/10) + 100/delivery; speed maxes at 50 m/s.
  runner: { ratePerSecond: 25, base: 300, absoluteMax: 100000 },
  // Ninja combos multiply up to 4x on waves of up to 3 items every 0.75s at high level.
  ninja: { ratePerSecond: 40, base: 400, absoluteMax: 200000 }
};
const MAX_DURATION = 6 * 60 * 60; // 6h hard ceiling, well above any real session
const NAME_PATTERN = /^[0-9A-ZÀ-Ÿ ._-]+$/u;

function scoreCap(game, duration) {
  const limit = SCORE_LIMITS[game];
  if (!limit) return 0;
  return Math.min(limit.absoluteMax, Math.floor(limit.ratePerSecond * duration) + limit.base);
}

// Same rule the ranking table has always used for player_name: trimmed, collapsed
// whitespace, uppercased in pt-BR, at most 14 chars, restricted charset.
function normalizePlayerName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR') : '';
  if (!name || name.length > 14 || !NAME_PATTERN.test(name)) return null;
  return name;
}

function validateEntry(value) {
  const game = typeof value.game === 'string' ? value.game.trim().toLowerCase() : '';
  const name = normalizePlayerName(value.name);
  const score = Number(value.score);
  const duration = Number(value.duration);
  if (!GAMES.has(game)) return null;
  if (!name) return null;
  if (!Number.isInteger(score) || score < 0) return null;
  if (!Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION) return null;
  if (score > scoreCap(game, duration)) return null;
  return { game, name, score, duration: Math.round(duration * 10) / 10 };
}

// Validates the body of POST /api/plays: game/score/duration like validateEntry, plus
// an optional deliveries count (runner only, capped by how long the session plausibly
// allowed: one delivery roughly every 45s of play, plus one for the first leg).
function validatePlayInput(value) {
  const game = typeof value.game === 'string' ? value.game.trim().toLowerCase() : '';
  const score = Number(value.score);
  const duration = Number(value.duration);
  if (!GAMES.has(game)) return null;
  if (!Number.isInteger(score) || score < 0) return null;
  if (!Number.isFinite(duration) || duration < 0 || duration > MAX_DURATION) return null;
  if (score > scoreCap(game, duration)) return null;
  const roundedDuration = Math.round(duration * 10) / 10;

  let deliveries = null;
  if (value.deliveries !== undefined && value.deliveries !== null) {
    const raw = Number(value.deliveries);
    if (game !== 'runner') return null;
    if (!Number.isInteger(raw) || raw < 0) return null;
    if (raw > Math.floor(roundedDuration / 45) + 1) return null;
    deliveries = raw;
  }

  return { game, score, duration: roundedDuration, deliveries };
}

module.exports = {
  GAMES, SCORE_LIMITS, MAX_DURATION, NAME_PATTERN,
  scoreCap, normalizePlayerName, validateEntry, validatePlayInput
};

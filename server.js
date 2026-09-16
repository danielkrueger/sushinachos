'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Pool } = require('pg');

const validation = require('./lib/validation');
const campaignsLib = require('./lib/campaigns');
const playersLib = require('./lib/players');
const adminAuth = require('./lib/admin-auth');
const couponsLib = require('./lib/coupons');
const campaignInput = require('./lib/campaign-input');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const MAX_BODY = 4096;
const ADMIN_MAX_BODY = 32 * 1024;
const CONSENT_VERSION = '2026-09-v1';

// Only these top-level directories (plus the root index.html/admin.html) are ever served.
// lib/, migrations/, scripts/, tests/, node_modules/, .env and similar stay unreachable.
const ALLOWED_DIRS = new Set(['css', 'js', 'assets']);
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const GAMES = validation.GAMES;
const MAX_DURATION = validation.MAX_DURATION;
const scoreCap = validation.scoreCap;
const validateEntry = validation.validateEntry;

const RATE = new Map();
const SESSION_RATE = new Map();
const READ_RATE = new Map();
const PLAYERS_RATE = new Map();
const PLAYS_RATE = new Map();
const LOGIN_RATE_IP = new Map();
const LOGIN_RATE_EMAIL = new Map();
const SESSIONS = new Map();
const SESSION_TTL_MS = 3 * 60 * 60 * 1000; // 3h: long enough for a marathon run, still bounded
const SESSION_SECRET = process.env.SUSHINACHOS_SESSION_SECRET || process.env.CHEFJOHN_SESSION_SECRET || crypto.randomBytes(32);
// Falls back to the session secret (not to SESSION_SECRET's own random fallback) so a
// deployment that only sets SUSHINACHOS_SESSION_SECRET still gets a stable admin secret.
const ADMIN_SECRET = process.env.SUSHINACHOS_ADMIN_SECRET || process.env.CHEFJOHN_ADMIN_SECRET || process.env.SUSHINACHOS_SESSION_SECRET || process.env.CHEFJOHN_SESSION_SECRET || crypto.randomBytes(32);
// Used to keep POST /api/admin/login's timing similar whether or not the e-mail exists.
const LOGIN_DUMMY_HASH = adminAuth.hashPassword(crypto.randomBytes(16).toString('hex'));

function databaseConfig() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD
  };
}

let pool = new Pool(databaseConfig());
function setPool(customPool) { pool = customPool; }

function normalizeRankingPeriod(period) {
  return period === 'month' ? 'month' : 'all';
}

// Month boundary computed in America/Sao_Paulo, then compared against created_at (UTC).
const PERIOD_CLAUSES = {
  all: 'TRUE',
  month: "created_at >= (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')"
};

function publicEntry(row) {
  return {
    name: row.player_name,
    score: Number(row.score),
    duration: Number(row.duration_seconds),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  };
}

function toIso(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

// Ranking ignores hidden=true and player_name IS NULL (anonymous statistics-only plays).
async function getRanking(game, period) {
  const clause = PERIOD_CLAUSES[period];
  const result = await pool.query(
    `SELECT player_name, score, duration_seconds, created_at FROM (
       SELECT player_name, score, duration_seconds, created_at,
              ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC, created_at ASC) AS rn
       FROM plays
       WHERE game = $1 AND hidden = false AND player_name IS NOT NULL AND ${clause}
     ) best
     WHERE rn = 1
     ORDER BY score DESC, created_at ASC
     LIMIT 10`,
    [game]
  );
  return result.rows.map(publicEntry);
}

async function getPlayerStanding(game, period, name) {
  const clause = PERIOD_CLAUSES[period];
  const result = await pool.query(
    `SELECT rank, player_name, score, duration_seconds, created_at FROM (
       SELECT player_name, score, duration_seconds, created_at,
              RANK() OVER (ORDER BY score DESC) AS rank
       FROM (
         SELECT player_name, score, duration_seconds, created_at,
                ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC, created_at ASC) AS rn
         FROM plays
         WHERE game = $1 AND hidden = false AND player_name IS NOT NULL AND ${clause}
       ) dedup
       WHERE rn = 1
     ) ranked
     WHERE player_name = $2
     LIMIT 1`,
    [game, name]
  );
  return result.rows.length ? { rank: Number(result.rows[0].rank), ...publicEntry(result.rows[0]) } : null;
}

// Admin ranking: top 50, includes hidden rows and the hidden flag itself (moderation view).
async function getAdminRanking(game, period) {
  const clause = PERIOD_CLAUSES[period];
  const result = await pool.query(
    `SELECT player_name, score, duration_seconds, created_at, hidden FROM (
       SELECT player_name, score, duration_seconds, created_at, hidden,
              ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY score DESC, created_at ASC) AS rn
       FROM plays
       WHERE game = $1 AND player_name IS NOT NULL AND ${clause}
     ) best
     WHERE rn = 1
     ORDER BY score DESC, created_at ASC
     LIMIT 50`,
    [game]
  );
  return result.rows.map(row => ({ ...publicEntry(row), hidden: Boolean(row.hidden) }));
}

async function saveEntry(entry) {
  const result = await pool.query(
    'INSERT INTO plays (game, player_name, score, duration_seconds) VALUES ($1, $2, $3, $4) RETURNING player_name, score, duration_seconds, created_at',
    [entry.game, entry.name, entry.score, entry.duration]
  );
  return publicEntry(result.rows[0]);
}

// ---- HTTP plumbing ----

function json(res, status, body, extraHeaders) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000',
    ...(extraHeaders || {})
  });
  res.end(data);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host.toLowerCase() === String(req.headers.host || '').toLowerCase();
  } catch (e) { return false; }
}

function isJsonContentType(req) {
  return /^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] || ''));
}

function isSecureRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return proto === 'https' || Boolean(req.socket && req.socket.encrypted);
}

// The proxy (EasyPanel/Traefik) appends the real client IP; earlier entries are client-controlled.
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return forwarded.length ? forwarded[forwarded.length - 1] : String(req.socket.remoteAddress || '');
}

function rateLimited(map, ip, limit) {
  const now = Date.now();
  const recent = (map.get(ip) || []).filter(t => now - t < 60000);
  if (recent.length >= limit) return true;
  recent.push(now);
  map.set(ip, recent);
  pruneRateMap(map, now);
  return false;
}

function pruneRateMap(map, now) {
  if (map.size < 1000) return;
  for (const [key, times] of map) {
    const recent = times.filter(t => now - t < 60000);
    if (recent.length) map.set(key, recent); else map.delete(key);
  }
}

function pruneSessions(now) {
  for (const [id, session] of SESSIONS) {
    if (session.expiresAt <= now || session.state === 'used') SESSIONS.delete(id);
  }
}

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

function createSession(ip) {
  const now = Date.now();
  pruneSessions(now);
  const id = crypto.randomBytes(16).toString('hex');
  const expiresAt = now + SESSION_TTL_MS;
  SESSIONS.set(id, { ip, startedAt: now, expiresAt, state: 'open' });
  return signSession({ id, iat: now, exp: expiresAt });
}

function openSession(token, ip) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch (e) { return null; }
  if (!payload || typeof payload.id !== 'string' || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(parts[0]).digest();
  let received;
  try { received = Buffer.from(parts[1], 'base64url'); }
  catch (e) { return null; }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  const now = Date.now();
  if (payload.exp <= now || payload.iat > now + 30000) return null;
  const session = SESSIONS.get(payload.id);
  if (!session || session.ip !== ip || session.expiresAt <= now || session.state !== 'open') return null;
  return session;
}

function readBody(req, maxBytes = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > maxBytes) reject(Object.assign(new Error('body too large'), { status: 413 }));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch (e) { reject(Object.assign(new Error('invalid json'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

// ---- Campaign row <-> API mapping ----

function campaignRowToBase(row) {
  return {
    id: Number(row.id),
    title: row.title,
    bannerText: row.banner_text,
    description: row.description,
    kind: row.kind,
    game: row.game,
    metric: row.metric,
    aggregation: row.aggregation,
    target: Number(row.target),
    multiplier: Number(row.multiplier),
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    weekdays: Array.isArray(row.weekdays) && row.weekdays.length ? row.weekdays.map(Number) : null,
    dailyStart: row.daily_start != null ? String(row.daily_start).slice(0, 5) : null,
    dailyEnd: row.daily_end != null ? String(row.daily_end).slice(0, 5) : null,
    prizeTitle: row.prize_title,
    prizeDescription: row.prize_description,
    stock: row.stock == null ? null : Number(row.stock),
    perPlayerLimit: Number(row.per_player_limit),
    couponValidDays: Number(row.coupon_valid_days),
    challengerName: row.challenger_name || null,
    challengerScore: row.challenger_score == null ? null : Number(row.challenger_score),
    status: row.status,
    collectiveReachedAt: row.collective_reached_at ? toIso(row.collective_reached_at) : null
  };
}

const CAMPAIGN_COLUMNS = [
  'title', 'banner_text', 'description', 'kind', 'game', 'metric', 'aggregation', 'target', 'multiplier',
  'starts_at', 'ends_at', 'weekdays', 'daily_start', 'daily_end', 'prize_title', 'prize_description', 'stock',
  'per_player_limit', 'coupon_valid_days', 'challenger_name', 'challenger_score', 'status'
];

function campaignValuesArray(value) {
  return [
    value.title, value.bannerText, value.description, value.kind, value.game, value.metric, value.aggregation,
    value.target, value.multiplier, value.startsAt, value.endsAt, value.weekdays, value.dailyStart, value.dailyEnd,
    value.prizeTitle, value.prizeDescription, value.stock, value.perPlayerLimit, value.couponValidDays,
    value.challengerName, value.challengerScore, value.status
  ];
}

async function insertCampaign(value, createdBy) {
  const cols = [...CAMPAIGN_COLUMNS, 'created_by'];
  const placeholders = cols.map((c, i) => `$${i + 1}`).join(', ');
  const params = [...campaignValuesArray(value), createdBy];
  const result = await pool.query(`INSERT INTO campaigns (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`, params);
  return result.rows[0];
}

async function updateCampaign(id, value) {
  const setClauses = CAMPAIGN_COLUMNS.map((col, i) => `${col} = $${i + 1}`);
  setClauses.push('updated_at = now()');
  const params = [...campaignValuesArray(value), id];
  const result = await pool.query(`UPDATE campaigns SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  return result.rows[0];
}

async function hydrateCampaign(row) {
  const base = campaignRowToBase(row);
  const now = new Date();
  const [issuedRes, redeemedRes, participantsRes] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND status <> 'cancelled'", [base.id]),
    pool.query("SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND status = 'redeemed'", [base.id]),
    pool.query('SELECT COUNT(DISTINCT player_id)::int AS c FROM campaign_entries WHERE campaign_id = $1', [base.id])
  ]);
  return {
    ...base,
    live: campaignsLib.isLive(base, now),
    couponsIssued: issuedRes.rows[0].c,
    couponsRedeemed: redeemedRes.rows[0].c,
    participants: participantsRes.rows[0].c
  };
}

async function buildPublicCampaign(row, now) {
  const base = campaignRowToBase(row);
  const live = campaignsLib.isLive(base, now);
  const nextChangeAt = campaignsLib.nextChange(base, now);
  let stockLeft = null;
  if (base.stock != null) {
    const issued = await pool.query("SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND status <> 'cancelled'", [base.id]);
    stockLeft = Math.max(0, base.stock - issued.rows[0].c);
  }
  let collective = null;
  if (base.kind === 'collective') {
    const sum = await pool.query('SELECT COALESCE(SUM(value), 0)::bigint AS s FROM campaign_entries WHERE campaign_id = $1', [base.id]);
    collective = { progress: Number(sum.rows[0].s), target: base.target, reachedAt: base.collectiveReachedAt };
  }
  const challenger = base.kind === 'challenge' && base.challengerName
    ? { name: base.challengerName, score: base.challengerScore }
    : null;
  const hasWindow = (base.weekdays && base.weekdays.length) || base.dailyStart || base.dailyEnd;
  return {
    id: base.id, title: base.title, bannerText: base.bannerText, description: base.description,
    kind: base.kind, game: base.game, metric: base.metric, aggregation: base.aggregation,
    target: base.target, multiplier: base.multiplier, startsAt: base.startsAt, endsAt: base.endsAt,
    window: hasWindow ? { weekdays: base.weekdays, dailyStart: base.dailyStart, dailyEnd: base.dailyEnd } : null,
    live, nextChangeAt: nextChangeAt ? nextChangeAt.toISOString() : null,
    prize: { title: base.prizeTitle, description: base.prizeDescription },
    stockLeft,
    challenger,
    collective
  };
}

// ---- Coupons ----

async function issueCouponRow(client, campaignId, playerId, couponValidDays) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = couponsLib.generateCouponCode();
    try {
      const result = await client.query(
        `INSERT INTO coupons (code, campaign_id, player_id, expires_at)
         VALUES ($1, $2, $3, now() + ($4 || ' days')::interval)
         RETURNING id, code, campaign_id, player_id, status, issued_at, expires_at`,
        [code, campaignId, playerId, String(couponValidDays)]
      );
      return result.rows[0];
    } catch (e) {
      if (e.code === '23505' && attempt < 4) continue;
      throw e;
    }
  }
  return null;
}

async function tryIssueCoupon(client, campaign, playerId) {
  const countRes = await client.query(
    "SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND player_id = $2 AND status <> 'cancelled'",
    [campaign.id, playerId]
  );
  if (countRes.rows[0].c >= campaign.perPlayerLimit) return null;
  if (campaign.stock != null) {
    const stockRes = await client.query(
      "SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND status <> 'cancelled'",
      [campaign.id]
    );
    if (stockRes.rows[0].c >= campaign.stock) return null;
  }
  return issueCouponRow(client, campaign.id, playerId, campaign.couponValidDays);
}

function deriveCouponStatus(row) {
  if (row.status === 'issued' && new Date(row.expires_at).getTime() < Date.now()) return 'expired';
  return row.status;
}

async function loadCouponDetail(code) {
  const result = await pool.query(
    `SELECT c.code, c.status, c.issued_at, c.expires_at, c.redeemed_at,
            camp.title AS campaign_title, camp.prize_title, camp.prize_description,
            p.name AS player_name, p.phone AS player_phone,
            au.name AS redeemed_by_name
     FROM coupons c
     JOIN campaigns camp ON camp.id = c.campaign_id
     JOIN players p ON p.id = c.player_id
     LEFT JOIN admin_users au ON au.id = c.redeemed_by
     WHERE c.code = $1`,
    [code]
  );
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return {
    code: row.code,
    status: deriveCouponStatus(row),
    campaignTitle: row.campaign_title,
    prizeTitle: row.prize_title,
    prizeDescription: row.prize_description,
    player: { name: row.player_name, phoneMasked: playersLib.maskPhone(row.player_phone) },
    issuedAt: toIso(row.issued_at),
    expiresAt: toIso(row.expires_at),
    redeemedAt: row.redeemed_at ? toIso(row.redeemed_at) : null,
    redeemedBy: row.redeemed_by_name || null
  };
}

// ---- Play registration + campaign progress/coupon transaction ----

async function registerPlay({ player, game, score, duration, deliveries }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const playResult = await client.query(
      `INSERT INTO plays (game, player_name, score, duration_seconds, player_id, deliveries)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [game, player ? player.name : null, score, duration, player ? player.id : null, deliveries]
    );
    const play = { id: playResult.rows[0].id, game, score, duration, deliveries };

    const campaignsOut = [];
    const newCoupons = [];

    if (player) {
      const now = new Date();
      const liveRows = await client.query(
        "SELECT * FROM campaigns WHERE status = 'active' AND starts_at <= $1 AND ends_at > $1",
        [now]
      );
      for (const row of liveRows.rows) {
        const candidate = campaignRowToBase(row);
        if (!campaignsLib.isLive(candidate, now)) continue;
        if (!campaignsLib.matches(candidate, play)) continue;

        // Lock this campaign for the rest of its processing so concurrent plays serialize.
        const lockedRes = await client.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [candidate.id]);
        const locked = campaignRowToBase(lockedRes.rows[0]);

        const value = campaignsLib.playValue(locked, play);
        const priorRes = await client.query(
          'SELECT value FROM campaign_entries WHERE campaign_id = $1 AND player_id = $2',
          [locked.id, player.id]
        );
        const priorValues = priorRes.rows.map(r => Number(r.value));
        const progressBefore = campaignsLib.aggregateProgress(priorValues, locked.aggregation);

        await client.query(
          'INSERT INTO campaign_entries (campaign_id, player_id, play_id, value) VALUES ($1, $2, $3, $4)',
          [locked.id, player.id, play.id, value]
        );

        let progress;
        const issuedForThisPlayer = [];

        if (locked.kind === 'challenge') {
          progress = campaignsLib.aggregateProgress([...priorValues, value], locked.aggregation);
          if (progress >= locked.target) {
            const coupon = await tryIssueCoupon(client, locked, player.id);
            if (coupon) issuedForThisPlayer.push(coupon);
          }
        } else {
          const sumRes = await client.query(
            'SELECT COALESCE(SUM(value), 0)::bigint AS s FROM campaign_entries WHERE campaign_id = $1',
            [locked.id]
          );
          const collectiveProgress = Number(sumRes.rows[0].s);
          progress = collectiveProgress;
          if (collectiveProgress >= locked.target) {
            if (!locked.collectiveReachedAt) {
              await client.query('UPDATE campaigns SET collective_reached_at = now() WHERE id = $1', [locked.id]);
              const participantsRes = await client.query(
                `SELECT player_id, MIN(created_at) AS first_at FROM campaign_entries WHERE campaign_id = $1
                 GROUP BY player_id ORDER BY first_at ASC`,
                [locked.id]
              );
              for (const p of participantsRes.rows) {
                const coupon = await tryIssueCoupon(client, locked, p.player_id);
                if (coupon && String(p.player_id) === String(player.id)) issuedForThisPlayer.push(coupon);
              }
            } else {
              const coupon = await tryIssueCoupon(client, locked, player.id);
              if (coupon) issuedForThisPlayer.push(coupon);
            }
          }
        }

        campaignsOut.push({
          id: locked.id, title: locked.title, progressBefore, progress, target: locked.target,
          completed: progress >= locked.target
        });
        for (const coupon of issuedForThisPlayer) {
          newCoupons.push({
            code: coupon.code, campaignTitle: locked.title, prizeTitle: locked.prizeTitle,
            prizeDescription: locked.prizeDescription, expiresAt: toIso(coupon.expires_at)
          });
        }
      }
    }

    await client.query('COMMIT');
    return { campaigns: campaignsOut, newCoupons };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ---- Public campaign/player/play routes ----

async function handleCampaignsList(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });
  const ip = clientIp(req);
  if (rateLimited(READ_RATE, ip, 60)) return json(res, 429, { error: 'muitas tentativas' });
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const result = await pool.query(
    "SELECT * FROM campaigns WHERE status = 'active' AND ends_at > $1 AND starts_at < $2 ORDER BY starts_at ASC",
    [now, horizon]
  );
  const campaigns = await Promise.all(result.rows.map(row => buildPublicCampaign(row, now)));
  return json(res, 200, { now: now.toISOString(), campaigns });
}

async function handleCreatePlayer(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
  if (!isJsonContentType(req)) return json(res, 415, { error: 'content-type inválido' });
  const ip = clientIp(req);
  if (rateLimited(PLAYERS_RATE, ip, 5)) return json(res, 429, { error: 'muitas tentativas' });

  const body = await readBody(req, MAX_BODY);
  const name = validation.normalizePlayerName(body.name);
  const phone = playersLib.normalizePhone(body.phone);
  if (!name) return json(res, 400, { error: 'nome inválido' });
  if (!phone) return json(res, 400, { error: 'whatsapp inválido' });
  if (body.consent !== true) return json(res, 400, { error: 'é preciso aceitar o uso dos dados' });

  const existing = await pool.query('SELECT id FROM players WHERE phone = $1 AND deleted_at IS NULL', [phone]);
  let playerId;
  if (existing.rows.length) {
    playerId = existing.rows[0].id;
    await pool.query(
      'UPDATE players SET name = $1, consent_at = now(), consent_version = $2, updated_at = now() WHERE id = $3',
      [name, CONSENT_VERSION, playerId]
    );
  } else {
    const inserted = await pool.query(
      'INSERT INTO players (name, phone, consent_at, consent_version) VALUES ($1, $2, now(), $3) RETURNING id',
      [name, phone, CONSENT_VERSION]
    );
    playerId = inserted.rows[0].id;
  }
  const token = playersLib.signPlayerToken(playerId, SESSION_SECRET);
  return json(res, 201, { token, player: { name, phoneMasked: playersLib.maskPhone(phone) } });
}

async function loadActivePlayer(req) {
  const token = req.headers['x-player-token'];
  if (typeof token !== 'string' || !token) return null;
  const verified = playersLib.verifyPlayerToken(token, SESSION_SECRET);
  if (!verified) return null;
  const result = await pool.query('SELECT id, name, phone FROM players WHERE id = $1 AND deleted_at IS NULL', [verified.pid]);
  return result.rows[0] || null;
}

async function handleGetPlayerMe(req, res) {
  const player = await loadActivePlayer(req);
  if (!player) return json(res, 401, { error: 'token inválido' });

  const campaignRows = await pool.query(
    `SELECT DISTINCT c.* FROM campaigns c
     JOIN campaign_entries ce ON ce.campaign_id = c.id
     WHERE ce.player_id = $1`,
    [player.id]
  );
  const campaigns = [];
  for (const row of campaignRows.rows) {
    const base = campaignRowToBase(row);
    const entriesRes = await pool.query(
      'SELECT value FROM campaign_entries WHERE campaign_id = $1 AND player_id = $2',
      [base.id, player.id]
    );
    const values = entriesRes.rows.map(r => Number(r.value));
    const progress = campaignsLib.aggregateProgress(values, base.aggregation);
    const couponsRes = await pool.query(
      'SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND player_id = $2',
      [base.id, player.id]
    );
    campaigns.push({
      id: base.id, progress, target: base.target, completed: progress >= base.target,
      couponsIssued: couponsRes.rows[0].c
    });
  }

  const couponRows = await pool.query(
    `SELECT c.code, c.status, c.issued_at, c.expires_at, c.redeemed_at,
            camp.title AS campaign_title, camp.prize_title, camp.prize_description
     FROM coupons c JOIN campaigns camp ON camp.id = c.campaign_id
     WHERE c.player_id = $1 ORDER BY c.issued_at DESC`,
    [player.id]
  );
  const coupons = couponRows.rows.map(row => ({
    code: row.code, campaignTitle: row.campaign_title, prizeTitle: row.prize_title,
    prizeDescription: row.prize_description, status: deriveCouponStatus(row),
    issuedAt: toIso(row.issued_at), expiresAt: toIso(row.expires_at),
    redeemedAt: row.redeemed_at ? toIso(row.redeemed_at) : null
  }));

  return json(res, 200, { player: { name: player.name, phoneMasked: playersLib.maskPhone(player.phone) }, campaigns, coupons });
}

async function handleDeletePlayerMe(req, res) {
  if (!sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
  const player = await loadActivePlayer(req);
  if (!player) return json(res, 401, { error: 'token inválido' });
  await pool.query(
    "UPDATE players SET name = 'REMOVIDO', phone = NULL, deleted_at = now(), updated_at = now() WHERE id = $1",
    [player.id]
  );
  return json(res, 200, { ok: true });
}

async function handlePlayersMe(req, res) {
  if (req.method === 'GET') return handleGetPlayerMe(req, res);
  if (req.method === 'DELETE') return handleDeletePlayerMe(req, res);
  return json(res, 405, { error: 'método não permitido' });
}

async function handlePlays(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
  if (!isJsonContentType(req)) return json(res, 415, { error: 'content-type inválido' });
  const ip = clientIp(req);
  if (rateLimited(PLAYS_RATE, ip, 6)) return json(res, 429, { error: 'muitas tentativas' });

  const body = await readBody(req, MAX_BODY);
  const input = validation.validatePlayInput(body);
  if (!input) return json(res, 400, { error: 'partida inválida' });

  const session = openSession(body.session, ip);
  if (!session) return json(res, 401, { error: 'sessão inválida ou expirada' });

  const elapsed = (Date.now() - session.startedAt) / 1000;
  const grace = 15;
  if (input.duration > elapsed + grace) return json(res, 400, { error: 'duração inválida' });
  if (input.score > scoreCap(input.game, Math.min(input.duration, elapsed + grace))) {
    return json(res, 400, { error: 'pontuação inválida' });
  }

  let player = null;
  const tokenHeader = req.headers['x-player-token'];
  if (typeof tokenHeader === 'string' && tokenHeader) {
    const verified = playersLib.verifyPlayerToken(tokenHeader, SESSION_SECRET);
    if (verified) {
      const found = await pool.query('SELECT id, name FROM players WHERE id = $1 AND deleted_at IS NULL', [verified.pid]);
      if (found.rows.length) player = found.rows[0];
    }
  }

  session.state = 'pending';
  let outcome;
  try {
    outcome = await registerPlay({ player, game: input.game, score: input.score, duration: input.duration, deliveries: input.deliveries });
  } catch (e) {
    session.state = 'open';
    throw e;
  }
  session.state = 'used';

  let ranking = null;
  if (player) {
    const [allStanding, monthStanding] = await Promise.all([
      getPlayerStanding(input.game, 'all', player.name),
      getPlayerStanding(input.game, 'month', player.name)
    ]);
    ranking = { allRank: allStanding ? allStanding.rank : null, monthRank: monthStanding ? monthStanding.rank : null };
  }

  return json(res, 201, {
    play: { game: input.game, score: input.score, duration: input.duration },
    registered: Boolean(player),
    campaigns: outcome.campaigns,
    newCoupons: outcome.newCoupons,
    ranking
  });
}

// ---- Admin auth ----

async function requireAdmin(req, res, roles) {
  const cookies = adminAuth.parseCookies(req.headers.cookie);
  const session = adminAuth.verifyAdminCookie(cookies[adminAuth.COOKIE_NAME] || cookies.cj_admin, ADMIN_SECRET);
  if (!session) { json(res, 401, { error: 'não autenticado' }); return null; }
  const result = await pool.query('SELECT id, email, name, role, disabled_at FROM admin_users WHERE id = $1', [session.uid]);
  const user = result.rows[0];
  if (!user || user.disabled_at) { json(res, 401, { error: 'não autenticado' }); return null; }
  if (!roles.includes(user.role)) { json(res, 403, { error: 'acesso negado' }); return null; }
  return user;
}

function requireJsonMutation(req, res) {
  if (!sameOrigin(req)) { json(res, 403, { error: 'origem não permitida' }); return false; }
  if (!isJsonContentType(req)) { json(res, 415, { error: 'content-type inválido' }); return false; }
  return true;
}

async function handleAdminLogin(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  if (!sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
  if (!isJsonContentType(req)) return json(res, 415, { error: 'content-type inválido' });
  const ip = clientIp(req);
  if (rateLimited(LOGIN_RATE_IP, ip, 5)) return json(res, 429, { error: 'muitas tentativas' });

  const body = await readBody(req, MAX_BODY);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) return json(res, 401, { error: 'e-mail ou senha inválidos' });
  if (rateLimited(LOGIN_RATE_EMAIL, email, 5)) return json(res, 429, { error: 'muitas tentativas' });

  const result = await pool.query(
    'SELECT id, name, email, role, password_hash, disabled_at FROM admin_users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  const ok = user ? adminAuth.verifyPassword(password, user.password_hash) : (adminAuth.verifyPassword(password, LOGIN_DUMMY_HASH), false);
  if (!ok || !user || user.disabled_at) return json(res, 401, { error: 'e-mail ou senha inválidos' });

  const cookieValue = adminAuth.signAdminCookie({ uid: user.id, role: user.role }, ADMIN_SECRET);
  const setCookie = adminAuth.serializeCookie(adminAuth.COOKIE_NAME, cookieValue, {
    maxAgeSeconds: Math.floor(adminAuth.ADMIN_COOKIE_TTL_MS / 1000),
    secure: isSecureRequest(req)
  });
  return json(res, 200, { user: { id: Number(user.id), name: user.name, email: user.email, role: user.role } }, { 'Set-Cookie': setCookie });
}

async function handleAdminLogout(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  const setCookie = adminAuth.serializeCookie(adminAuth.COOKIE_NAME, '', { maxAgeSeconds: 0, secure: isSecureRequest(req) });
  return json(res, 200, { ok: true }, { 'Set-Cookie': setCookie });
}

async function handleAdminMe(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin', 'caixa']);
  if (!admin) return;
  return json(res, 200, { user: { id: Number(admin.id), name: admin.name, email: admin.email, role: admin.role } });
}

// ---- Admin dashboard ----

async function buildDashboard(days) {
  const now = new Date();
  const todayKey = campaignsLib.zonedDateKey(now);
  const games = ['catcher', 'runner', 'ninja'];
  const dayBuckets = new Map();
  const keysInWindow = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = campaignsLib.zonedDateKey(d);
    keysInWindow.push(key);
    dayBuckets.set(key, { day: key, catcher: 0, runner: 0, ninja: 0 });
  }
  const rangeStart = new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000);
  const playsRes = await pool.query('SELECT game, duration_seconds, created_at FROM plays WHERE created_at >= $1', [rangeStart]);

  let playsToday = 0;
  const durationSum = { catcher: 0, runner: 0, ninja: 0 };
  const durationCount = { catcher: 0, runner: 0, ninja: 0 };
  const playsByGame = { catcher: 0, runner: 0, ninja: 0 };
  for (const row of playsRes.rows) {
    if (!games.includes(row.game)) continue;
    const key = campaignsLib.zonedDateKey(row.created_at);
    if (dayBuckets.has(key)) dayBuckets.get(key)[row.game]++;
    playsByGame[row.game]++;
    durationSum[row.game] += Number(row.duration_seconds);
    durationCount[row.game]++;
    if (key === todayKey) playsToday++;
  }
  const avgDurationByGame = {};
  for (const g of games) avgDurationByGame[g] = durationCount[g] ? Math.round((durationSum[g] / durationCount[g]) * 10) / 10 : 0;

  const playersTotalRes = await pool.query('SELECT COUNT(*)::int AS c FROM players WHERE deleted_at IS NULL', []);
  const newPlayersRes = await pool.query('SELECT created_at FROM players WHERE created_at >= $1', [rangeStart]);
  const newPlayers = newPlayersRes.rows.filter(r => campaignsLib.zonedDateKey(r.created_at) === todayKey).length;

  const couponsIssuedRes = await pool.query("SELECT COUNT(*)::int AS c FROM coupons WHERE status <> 'cancelled'", []);
  const couponsRedeemedRes = await pool.query("SELECT COUNT(*)::int AS c FROM coupons WHERE status = 'redeemed'", []);

  const campaignsRes = await pool.query("SELECT * FROM campaigns WHERE status <> 'archived' ORDER BY created_at DESC", []);
  const campaigns = [];
  for (const row of campaignsRes.rows) {
    const base = campaignRowToBase(row);
    const live = campaignsLib.isLive(base, now);
    const valuesRes = await pool.query('SELECT value FROM campaign_entries WHERE campaign_id = $1', [base.id]);
    const progress = campaignsLib.aggregateProgress(valuesRes.rows.map(r => Number(r.value)), base.aggregation);
    const issuedRes = await pool.query("SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND status <> 'cancelled'", [base.id]);
    const redeemedRes = await pool.query("SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1 AND status = 'redeemed'", [base.id]);
    const stockLeft = base.stock == null ? null : Math.max(0, base.stock - issuedRes.rows[0].c);
    campaigns.push({
      id: base.id, title: base.title, kind: base.kind, live, progress, target: base.target,
      couponsIssued: issuedRes.rows[0].c, couponsRedeemed: redeemedRes.rows[0].c, stockLeft
    });
  }

  return {
    kpis: {
      playsToday, playersTotal: playersTotalRes.rows[0].c, newPlayers, avgDurationByGame, playsByGame,
      couponsIssued: couponsIssuedRes.rows[0].c, couponsRedeemed: couponsRedeemedRes.rows[0].c
    },
    playsPerDay: keysInWindow.map(k => dayBuckets.get(k)),
    campaigns
  };
}

async function handleAdminDashboard(req, res, query) {
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  const days = Math.min(60, Math.max(1, Number(query.get('days')) || 7));
  return json(res, 200, await buildDashboard(days));
}

// ---- Admin campaigns ----

async function handleAdminCampaignsCollection(req, res) {
  if (req.method === 'GET') {
    const admin = await requireAdmin(req, res, ['admin']);
    if (!admin) return;
    const result = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC', []);
    const campaigns = await Promise.all(result.rows.map(hydrateCampaign));
    return json(res, 200, { campaigns });
  }
  if (req.method === 'POST') {
    const admin = await requireAdmin(req, res, ['admin']);
    if (!admin) return;
    if (!requireJsonMutation(req, res)) return;
    const body = await readBody(req, ADMIN_MAX_BODY);
    const { errors, value } = campaignInput.validateCampaign(body);
    if (errors) return json(res, 400, { error: errors[0].message });
    const row = await insertCampaign(value, admin.id);
    return json(res, 201, { campaign: await hydrateCampaign(row) });
  }
  return json(res, 405, { error: 'método não permitido' });
}

async function handleAdminCampaignItem(req, res, id) {
  if (req.method !== 'PUT') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  if (!requireJsonMutation(req, res)) return;
  const existing = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  if (!existing.rows.length) return json(res, 404, { error: 'campanha não encontrada' });
  const base = campaignRowToBase(existing.rows[0]);
  const body = await readBody(req, ADMIN_MAX_BODY);
  const merged = { ...base, ...body };
  const { errors, value } = campaignInput.validateCampaign(merged);
  if (errors) return json(res, 400, { error: errors[0].message });
  const row = await updateCampaign(id, value);
  return json(res, 200, { campaign: await hydrateCampaign(row) });
}

async function handleAdminCampaignStatus(req, res, id) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  if (!requireJsonMutation(req, res)) return;
  const body = await readBody(req, ADMIN_MAX_BODY);
  if (!campaignInput.STATUSES.has(body.status)) return json(res, 400, { error: 'status inválido' });
  const result = await pool.query('UPDATE campaigns SET status = $1, updated_at = now() WHERE id = $2 RETURNING *', [body.status, id]);
  if (!result.rows.length) return json(res, 404, { error: 'campanha não encontrada' });
  return json(res, 200, { campaign: await hydrateCampaign(result.rows[0]) });
}

async function handleAdminCampaignDuplicate(req, res, id) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  if (!requireJsonMutation(req, res)) return;
  await readBody(req, ADMIN_MAX_BODY).catch(() => ({}));
  const existing = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
  if (!existing.rows.length) return json(res, 404, { error: 'campanha não encontrada' });
  const base = campaignRowToBase(existing.rows[0]);
  base.title = `${base.title} (cópia)`.slice(0, 60);
  base.status = 'draft';
  const { errors, value } = campaignInput.validateCampaign(base);
  if (errors) return json(res, 400, { error: errors[0].message });
  const row = await insertCampaign(value, admin.id);
  return json(res, 201, { campaign: await hydrateCampaign(row) });
}

// ---- Admin coupons ----

async function handleAdminCouponGet(req, res, codeRaw) {
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin', 'caixa']);
  if (!admin) return;
  const code = couponsLib.normalizeCouponCode(codeRaw) || String(codeRaw).toUpperCase();
  const coupon = await loadCouponDetail(code);
  if (!coupon) return json(res, 404, { error: 'cupom não encontrado' });
  return json(res, 200, { coupon });
}

async function handleAdminCouponRedeem(req, res, codeRaw) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin', 'caixa']);
  if (!admin) return;
  if (!requireJsonMutation(req, res)) return;
  await readBody(req, ADMIN_MAX_BODY).catch(() => ({}));
  const code = couponsLib.normalizeCouponCode(codeRaw) || String(codeRaw).toUpperCase();

  const client = await pool.connect();
  let outcome;
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT * FROM coupons WHERE code = $1 FOR UPDATE', [code]);
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return json(res, 404, { error: 'cupom não encontrado' });
    }
    const row = result.rows[0];
    const status = deriveCouponStatus(row);
    if (status !== 'issued') {
      await client.query('ROLLBACK');
      const messages = { redeemed: 'cupom já foi usado', expired: 'cupom expirado', cancelled: 'cupom cancelado' };
      return json(res, 409, { error: messages[status] || 'cupom indisponível' });
    }
    await client.query("UPDATE coupons SET status = 'redeemed', redeemed_at = now(), redeemed_by = $1 WHERE code = $2", [admin.id, code]);
    await client.query('COMMIT');
    outcome = 'ok';
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  if (outcome !== 'ok') return;
  const coupon = await loadCouponDetail(code);
  return json(res, 200, { coupon });
}

async function handleAdminCouponCancel(req, res, codeRaw) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  if (!requireJsonMutation(req, res)) return;
  await readBody(req, ADMIN_MAX_BODY).catch(() => ({}));
  const code = couponsLib.normalizeCouponCode(codeRaw) || String(codeRaw).toUpperCase();
  const result = await pool.query("UPDATE coupons SET status = 'cancelled' WHERE code = $1 AND status = 'issued' RETURNING code", [code]);
  if (!result.rows.length) {
    const exists = await pool.query('SELECT code FROM coupons WHERE code = $1', [code]);
    if (!exists.rows.length) return json(res, 404, { error: 'cupom não encontrado' });
    return json(res, 409, { error: 'cupom não pode ser cancelado' });
  }
  const coupon = await loadCouponDetail(code);
  return json(res, 200, { coupon });
}

// ---- Admin players ----

async function handleAdminPlayersList(req, res, query) {
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  const q = (query.get('q') || '').trim();
  const page = Math.max(1, Number(query.get('page')) || 1);
  const pageSize = 20;
  const digits = q.replace(/\D+/g, '');
  const conditions = ['deleted_at IS NULL'];
  const params = [];
  if (q) {
    params.push(`%${q.toUpperCase()}%`);
    let clause = `name ILIKE $${params.length}`;
    if (digits) {
      params.push(`%${digits}%`);
      clause += ` OR phone LIKE $${params.length}`;
    }
    conditions.push(`(${clause})`);
  }
  const where = conditions.join(' AND ');
  const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM players WHERE ${where}`, params);
  const total = countRes.rows[0].c;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * pageSize;
  const listParams = [...params, pageSize, offset];
  const rows = await pool.query(
    `SELECT p.id, p.name, p.phone, p.created_at,
            (SELECT COUNT(*)::int FROM plays WHERE player_id = p.id) AS plays_count,
            (SELECT COUNT(*)::int FROM coupons WHERE player_id = p.id) AS coupons_count
     FROM players p WHERE ${where} ORDER BY p.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  const players = rows.rows.map(r => ({
    id: Number(r.id), name: r.name, phone: r.phone, phoneMasked: playersLib.maskPhone(r.phone),
    createdAt: toIso(r.created_at), plays: r.plays_count, coupons: r.coupons_count
  }));
  return json(res, 200, { players, page: currentPage, pages });
}

async function handleAdminPlayersCsv(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  const rows = await pool.query(
    `SELECT p.name, p.phone, p.created_at, p.consent_at,
            (SELECT COUNT(*)::int FROM plays WHERE player_id = p.id) AS plays_count,
            (SELECT COUNT(*)::int FROM coupons WHERE player_id = p.id) AS coupons_count
     FROM players p WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC`,
    []
  );
  const csvEscape = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lines = ['nome;whatsapp;cadastro;consentimento;partidas;cupons'];
  for (const r of rows.rows) {
    lines.push([
      csvEscape(r.name), csvEscape(r.phone), csvEscape(toIso(r.created_at)), csvEscape(toIso(r.consent_at)),
      r.plays_count, r.coupons_count
    ].join(';'));
  }
  const data = Buffer.from('﻿' + lines.join('\r\n') + '\r\n', 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="jogadores.csv"',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(data);
}

async function handleAdminPlayerDelete(req, res, id) {
  if (req.method !== 'DELETE') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  if (!sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
  const result = await pool.query(
    "UPDATE players SET name = 'REMOVIDO', phone = NULL, deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
    [id]
  );
  if (!result.rows.length) return json(res, 404, { error: 'jogador não encontrado' });
  return json(res, 200, { ok: true });
}

// ---- Admin ranking ----

async function handleAdminRanking(req, res, query) {
  if (req.method !== 'GET') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  const game = query.get('game');
  if (!GAMES.has(game)) return json(res, 400, { error: 'jogo inválido' });
  const period = normalizeRankingPeriod(query.get('period'));
  const scores = await getAdminRanking(game, period);
  return json(res, 200, { game, period, scores });
}

async function handleAdminRankingHide(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  if (!requireJsonMutation(req, res)) return;
  const body = await readBody(req, MAX_BODY);
  const game = typeof body.game === 'string' ? body.game : '';
  const name = validation.normalizePlayerName(body.name);
  if (!GAMES.has(game) || !name) return json(res, 400, { error: 'dados inválidos' });
  await pool.query('UPDATE plays SET hidden = $1 WHERE game = $2 AND player_name = $3', [Boolean(body.hidden), game, name]);
  return json(res, 200, { ok: true });
}

// ---- Admin users ----

async function handleAdminUsersCollection(req, res) {
  if (req.method === 'GET') {
    const admin = await requireAdmin(req, res, ['admin']);
    if (!admin) return;
    const rows = await pool.query('SELECT id, email, name, role, created_at, disabled_at FROM admin_users ORDER BY created_at ASC', []);
    const users = rows.rows.map(r => ({
      id: Number(r.id), email: r.email, name: r.name, role: r.role,
      createdAt: toIso(r.created_at), disabled: Boolean(r.disabled_at)
    }));
    return json(res, 200, { users });
  }
  if (req.method === 'POST') {
    const admin = await requireAdmin(req, res, ['admin']);
    if (!admin) return;
    if (!requireJsonMutation(req, res)) return;
    const body = await readBody(req, ADMIN_MAX_BODY);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = body.role;
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json(res, 400, { error: 'e-mail inválido' });
    if (!name || name.length > 60) return json(res, 400, { error: 'nome inválido' });
    if (role !== 'admin' && role !== 'caixa') return json(res, 400, { error: 'papel inválido' });
    if (!adminAuth.isPasswordStrongEnough(body.password)) return json(res, 400, { error: 'senha deve ter ao menos 10 caracteres' });
    try {
      const result = await pool.query(
        'INSERT INTO admin_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
        [email, name, role, adminAuth.hashPassword(body.password)]
      );
      const u = result.rows[0];
      return json(res, 201, { user: { id: Number(u.id), email: u.email, name: u.name, role: u.role } });
    } catch (e) {
      if (e.code === '23505') return json(res, 400, { error: 'e-mail já cadastrado' });
      throw e;
    }
  }
  return json(res, 405, { error: 'método não permitido' });
}

async function handleAdminUserDisable(req, res, id) {
  if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
  const admin = await requireAdmin(req, res, ['admin']);
  if (!admin) return;
  if (!requireJsonMutation(req, res)) return;
  await readBody(req, ADMIN_MAX_BODY).catch(() => ({}));
  const result = await pool.query('UPDATE admin_users SET disabled_at = now() WHERE id = $1 RETURNING id', [id]);
  if (!result.rows.length) return json(res, 404, { error: 'usuário não encontrado' });
  return json(res, 200, { ok: true });
}

// ---- Admin router ----

async function handleAdminApi(req, res, pathname, query) {
  const sub = pathname.slice('/api/admin'.length);

  if (sub === '/login') return handleAdminLogin(req, res);
  if (sub === '/logout') return handleAdminLogout(req, res);
  if (sub === '/me') return handleAdminMe(req, res);
  if (sub === '/dashboard') return handleAdminDashboard(req, res, query);
  if (sub === '/campaigns') return handleAdminCampaignsCollection(req, res);
  if (sub === '/ranking') return handleAdminRanking(req, res, query);
  if (sub === '/ranking/hide') return handleAdminRankingHide(req, res);
  if (sub === '/players') return handleAdminPlayersList(req, res, query);
  if (sub === '/players.csv') return handleAdminPlayersCsv(req, res);
  if (sub === '/users') return handleAdminUsersCollection(req, res);

  let m;
  if ((m = /^\/campaigns\/(\d+)$/.exec(sub))) return handleAdminCampaignItem(req, res, Number(m[1]));
  if ((m = /^\/campaigns\/(\d+)\/status$/.exec(sub))) return handleAdminCampaignStatus(req, res, Number(m[1]));
  if ((m = /^\/campaigns\/(\d+)\/duplicate$/.exec(sub))) return handleAdminCampaignDuplicate(req, res, Number(m[1]));
  if ((m = /^\/coupons\/([A-Za-z0-9-]{1,32})\/redeem$/.exec(sub))) return handleAdminCouponRedeem(req, res, m[1]);
  if ((m = /^\/coupons\/([A-Za-z0-9-]{1,32})\/cancel$/.exec(sub))) return handleAdminCouponCancel(req, res, m[1]);
  if ((m = /^\/coupons\/([A-Za-z0-9-]{1,32})$/.exec(sub))) return handleAdminCouponGet(req, res, m[1]);
  if ((m = /^\/players\/(\d+)$/.exec(sub))) return handleAdminPlayerDelete(req, res, Number(m[1]));
  if ((m = /^\/users\/(\d+)\/disable$/.exec(sub))) return handleAdminUserDisable(req, res, Number(m[1]));

  return json(res, 404, { error: 'não encontrado' });
}

// ---- Top-level API router ----

async function handleApi(req, res, pathname, query) {
  if (pathname === '/api/session') {
    if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
    const ip = clientIp(req);
    if (rateLimited(SESSION_RATE, ip, 10)) return json(res, 429, { error: 'muitas tentativas' });
    return json(res, 201, { session: createSession(ip) });
  }

  if (pathname === '/api/ranking') {
    if (req.method === 'GET') {
      const game = query.get('game');
      if (!GAMES.has(game)) return json(res, 400, { error: 'jogo inválido' });
      const ip = clientIp(req);
      if (rateLimited(READ_RATE, ip, 60)) return json(res, 429, { error: 'muitas tentativas' });
      const period = normalizeRankingPeriod(query.get('period'));
      const name = typeof query.get('name') === 'string' ? query.get('name').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR').slice(0, 14) : '';
      const scores = await getRanking(game, period);
      const player = name ? await getPlayerStanding(game, period, name) : null;
      return json(res, 200, { game, period, scores, player });
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'método não permitido' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'origem não permitida' });
    if (!isJsonContentType(req)) return json(res, 415, { error: 'content-type inválido' });

    const ip = clientIp(req);
    const body = await readBody(req);
    const entry = validateEntry(body);
    if (!entry) return json(res, 400, { error: 'pontuação inválida' });
    const session = openSession(body.session, ip);
    if (!session) return json(res, 401, { error: 'sessão inválida ou expirada' });
    if (rateLimited(RATE, ip, 5)) return json(res, 429, { error: 'muitas tentativas' });

    const elapsed = (Date.now() - session.startedAt) / 1000;
    const grace = 15;
    if (entry.duration > elapsed + grace) return json(res, 400, { error: 'duração inválida' });
    if (entry.score > scoreCap(entry.game, Math.min(entry.duration, elapsed + grace))) return json(res, 400, { error: 'pontuação inválida' });

    session.state = 'pending';
    let saved;
    try {
      saved = await saveEntry(entry);
    } catch (e) {
      session.state = 'open';
      throw e;
    }
    session.state = 'used';

    return json(res, 201, {
      entry: saved,
      all: await getRanking(entry.game, 'all'),
      month: await getRanking(entry.game, 'month')
    });
  }

  if (pathname === '/api/campaigns') return handleCampaignsList(req, res);
  if (pathname === '/api/players') return handleCreatePlayer(req, res);
  if (pathname === '/api/players/me') return handlePlayersMe(req, res);
  if (pathname === '/api/plays') return handlePlays(req, res);
  if (pathname.startsWith('/api/admin/')) return handleAdminApi(req, res, pathname, query);

  return json(res, 404, { error: 'não encontrado' });
}

function resolveStatic(pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch (e) { return null; }
  if (decoded.indexOf('\0') !== -1) return null;
  if (decoded === '/') decoded = '/index.html';
  else if (decoded === '/admin' || decoded === '/admin/') decoded = '/admin.html';
  const rel = decoded.replace(/^\/+/, '');
  const normalized = path.posix.normalize(rel);
  if (normalized === '.') return null;
  if (normalized.startsWith('..') || normalized.startsWith('/')) return null;
  const segments = normalized.split('/');
  if (segments.some(s => s === '' || s.startsWith('.'))) return null;
  const top = segments[0];
  const isAdmin = normalized === 'admin.html';
  if (normalized !== 'index.html' && !isAdmin && !ALLOWED_DIRS.has(top)) return null;
  const ext = path.extname(normalized).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) return null;
  const abs = path.join(ROOT, normalized);
  const relCheck = path.relative(ROOT, abs);
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) return null;
  return { abs, contentType, isHtml: ext === '.html', isAdmin };
}

function serveFile(res, entry) {
  fs.readFile(entry.abs, (err, data) => {
    if (err) return json(res, 404, { error: 'não encontrado' });
    res.writeHead(200, {
      'Content-Type': entry.contentType,
      'Content-Length': data.length,
      'Cache-Control': entry.isAdmin ? 'no-store' : (entry.isHtml || entry.contentType.startsWith('text/') ? 'no-cache' : 'public, max-age=86400'),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Strict-Transport-Security': 'max-age=31536000'
    });
    res.end(data);
  });
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname, url.searchParams);
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 404, { error: 'não encontrado' });
      const entry = resolveStatic(url.pathname);
      if (!entry) return json(res, 404, { error: 'não encontrado' });
      serveFile(res, entry);
    } catch (e) {
      console.error(e.message);
      json(res, e.status || 500, { error: e.status ? e.message : 'erro interno' });
    }
  });
}

async function migrate() {
  const migrations = ['001_ranking.up.sql', '002_campaigns.up.sql'];
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(ROOT, 'migrations', migration), 'utf8');
    await pool.query(sql);
  }
}

// If no admin exists yet and the bootstrap env vars are set, create the first admin.
// Never logs the password.
async function bootstrapAdmin() {
  const email = process.env.SUSHINACHOS_BOOTSTRAP_ADMIN_EMAIL || process.env.CHEFJOHN_BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.SUSHINACHOS_BOOTSTRAP_ADMIN_PASSWORD || process.env.CHEFJOHN_BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await pool.query('SELECT id FROM admin_users LIMIT 1', []);
  if (existing.rows.length) return;
  if (!adminAuth.isPasswordStrongEnough(password)) {
    console.warn('Aviso: SUSHINACHOS_BOOTSTRAP_ADMIN_PASSWORD fraca demais (mínimo 10 caracteres); admin inicial não criado.');
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  await pool.query(
    'INSERT INTO admin_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)',
    [normalizedEmail, 'Administrador', 'admin', adminAuth.hashPassword(password)]
  );
  console.log(`Admin inicial criado: ${normalizedEmail}`);
}

async function start() {
  try {
    await migrate();
    await bootstrapAdmin();
  } catch (e) {
    console.warn(`Aviso: banco de dados indisponível (${e.message}). Iniciando servidor sem ranking.`);
  }
  createServer().listen(PORT, '0.0.0.0', () => console.log(`Sushinachos Games ouvindo na porta ${PORT}`));
}

if (require.main === module) start().catch(e => { console.error(e.message); process.exit(1); });

// Test-only: clears in-memory rate limit/session state between integration tests that
// reuse the same process (and therefore the same 127.0.0.1 IP bucket).
function resetRuntimeState() {
  RATE.clear(); SESSION_RATE.clear(); READ_RATE.clear(); PLAYERS_RATE.clear(); PLAYS_RATE.clear();
  LOGIN_RATE_IP.clear(); LOGIN_RATE_EMAIL.clear(); SESSIONS.clear();
}

module.exports = {
  createServer, getRanking, getPlayerStanding, normalizeRankingPeriod, publicEntry, saveEntry,
  validateEntry, scoreCap, resolveStatic, setPool, migrate, bootstrapAdmin, CONSENT_VERSION,
  resetRuntimeState
};

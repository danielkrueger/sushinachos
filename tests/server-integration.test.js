'use strict';

// Integration tests: a real HTTP server backed by an in-memory PGlite database (no mocks,
// no Docker). Each test gets a fresh PGlite instance so tests never interfere with each other.

const test = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { createPglitePool } = require('../lib/pglite-pool');
const adminAuth = require('../lib/admin-auth');
const server = require('../server');

async function withServer(fn) {
  const pglite = new PGlite();
  const pool = createPglitePool(pglite);
  server.setPool(pool);
  server.resetRuntimeState(); // fresh rate-limit/session buckets per test (all share 127.0.0.1)
  await server.migrate();
  const httpServer = server.createServer();
  await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${httpServer.address().port}`;
  try {
    await fn({ pool, base });
  } finally {
    await new Promise((resolve, reject) => httpServer.close(err => (err ? reject(err) : resolve())));
    await pglite.close();
  }
}

async function createSession(base) {
  const res = await fetch(`${base}/api/session`, { method: 'POST' });
  const body = await res.json();
  return body.session;
}

async function registerPlayer(base, { name = 'DANIEL', phone = '47991234567' } = {}) {
  const res = await fetch(`${base}/api/players`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, consent: true })
  });
  assert.equal(res.status, 201);
  return res.json();
}

async function insertAdmin(pool, { email, role, password = 'senha-forte-123' }) {
  await pool.query(
    'INSERT INTO admin_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)',
    [email, email, role, adminAuth.hashPassword(password)]
  );
  return password;
}

async function loginAdmin(base, email, password) {
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const setCookie = res.headers.get('set-cookie');
  const cookie = setCookie ? setCookie.split(';')[0] : null;
  return { res, cookie, body: await res.json() };
}

async function insertActiveCampaign(pool, overrides = {}) {
  const now = Date.now();
  const base = {
    title: 'Campanha de teste', bannerText: 'Banner', description: 'Descrição',
    kind: 'challenge', game: 'runner', metric: 'score', aggregation: 'best', target: 100,
    multiplier: 1, startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 3600000).toISOString(),
    weekdays: null, dailyStart: null, dailyEnd: null, prizeTitle: 'Prêmio', prizeDescription: 'Descrição do prêmio',
    stock: null, perPlayerLimit: 1, couponValidDays: 7, challengerName: null, challengerScore: null, status: 'active',
    ...overrides
  };
  const result = await pool.query(
    `INSERT INTO campaigns (title, banner_text, description, kind, game, metric, aggregation, target, multiplier,
       starts_at, ends_at, weekdays, daily_start, daily_end, prize_title, prize_description, stock,
       per_player_limit, coupon_valid_days, challenger_name, challenger_score, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
    [base.title, base.bannerText, base.description, base.kind, base.game, base.metric, base.aggregation,
      base.target, base.multiplier, base.startsAt, base.endsAt, base.weekdays, base.dailyStart, base.dailyEnd,
      base.prizeTitle, base.prizeDescription, base.stock, base.perPlayerLimit, base.couponValidDays,
      base.challengerName, base.challengerScore, base.status]
  );
  return result.rows[0];
}

async function submitPlay(base, { token, session, game = 'runner', score = 50, duration = 5, deliveries } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['X-Player-Token'] = token;
  const res = await fetch(`${base}/api/plays`, {
    method: 'POST', headers,
    body: JSON.stringify({ session, game, score, duration, ...(deliveries !== undefined ? { deliveries } : {}) })
  });
  return { res, body: await res.json() };
}

// ---- Registration -> session -> play -> coupon ----

test('integration: register, play and earn a coupon when the target is reached', async () => {
  await withServer(async ({ pool, base }) => {
    await insertActiveCampaign(pool, { target: 40 });
    const { token } = await registerPlayer(base);
    const session = await createSession(base);
    const { res, body } = await submitPlay(base, { token, session, score: 50, duration: 5 });
    assert.equal(res.status, 201);
    assert.equal(body.registered, true);
    assert.equal(body.campaigns.length, 1);
    assert.equal(body.campaigns[0].completed, true);
    assert.equal(body.newCoupons.length, 1);
    assert.match(body.newCoupons[0].code, /^SN-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.ok(body.ranking);
    assert.equal(body.ranking.allRank, 1);
  });
});

test('integration: anonymous plays are recorded but earn no campaign progress or coupons', async () => {
  await withServer(async ({ pool, base }) => {
    await insertActiveCampaign(pool, { target: 10 });
    const session = await createSession(base);
    const { res, body } = await submitPlay(base, { session, score: 50, duration: 5 });
    assert.equal(res.status, 201);
    assert.equal(body.registered, false);
    assert.deepEqual(body.campaigns, []);
    assert.deepEqual(body.newCoupons, []);
    assert.equal(body.ranking, null);

    const playsCount = await pool.query('SELECT COUNT(*)::int AS c FROM plays WHERE player_id IS NULL', []);
    assert.equal(playsCount.rows[0].c, 1);
  });
});

test('integration: progress aggregation differs between best and sum', async () => {
  await withServer(async ({ pool, base }) => {
    const best = await insertActiveCampaign(pool, { title: 'Best', aggregation: 'best', target: 1000 });
    const sum = await insertActiveCampaign(pool, { title: 'Sum', aggregation: 'sum', target: 1000 });
    const { token } = await registerPlayer(base);

    let session = await createSession(base);
    let { body } = await submitPlay(base, { token, session, score: 300, duration: 5 });
    let byId = Object.fromEntries(body.campaigns.map(c => [c.title, c]));
    assert.equal(byId.Best.progress, 300);
    assert.equal(byId.Sum.progress, 300);

    session = await createSession(base);
    ({ body } = await submitPlay(base, { token, session, score: 100, duration: 5 }));
    byId = Object.fromEntries(body.campaigns.map(c => [c.title, c]));
    assert.equal(byId.Best.progress, 300); // best of [300,100]
    assert.equal(byId.Sum.progress, 400); // sum of [300,100]
    void best; void sum;
  });
});

test('integration: multiplier scales the value credited to a campaign', async () => {
  await withServer(async ({ pool, base }) => {
    await insertActiveCampaign(pool, { multiplier: 2, target: 10000 });
    const { token } = await registerPlayer(base);
    const session = await createSession(base);
    const { body } = await submitPlay(base, { token, session, score: 50, duration: 5 });
    assert.equal(body.campaigns[0].progress, 100); // 50 * 2
  });
});

test('integration: exhausted stock stops issuing coupons', async () => {
  await withServer(async ({ pool, base }) => {
    const campaign = await insertActiveCampaign(pool, { target: 10, stock: 1, perPlayerLimit: 5 });
    const { token: tokenA } = await registerPlayer(base, { name: 'A', phone: '47991110001' });
    const { token: tokenB } = await registerPlayer(base, { name: 'B', phone: '47991110002' });

    const s1 = await createSession(base);
    const r1 = await submitPlay(base, { token: tokenA, session: s1, score: 50, duration: 5 });
    assert.equal(r1.body.newCoupons.length, 1);

    const s2 = await createSession(base);
    const r2 = await submitPlay(base, { token: tokenB, session: s2, score: 50, duration: 5 });
    assert.equal(r2.body.newCoupons.length, 0);
    assert.equal(r2.body.campaigns[0].completed, true); // still completes, just no stock left

    const coupons = await pool.query('SELECT COUNT(*)::int AS c FROM coupons WHERE campaign_id = $1', [campaign.id]);
    assert.equal(coupons.rows[0].c, 1);
  });
});

test('integration: per_player_limit blocks a second coupon for the same player', async () => {
  await withServer(async ({ pool, base }) => {
    await insertActiveCampaign(pool, { target: 10, aggregation: 'sum', perPlayerLimit: 1 });
    const { token } = await registerPlayer(base);

    const s1 = await createSession(base);
    const r1 = await submitPlay(base, { token, session: s1, score: 50, duration: 5 });
    assert.equal(r1.body.newCoupons.length, 1);

    const s2 = await createSession(base);
    const r2 = await submitPlay(base, { token, session: s2, score: 50, duration: 5 });
    assert.equal(r2.body.newCoupons.length, 0); // already has a coupon; limit is 1
  });
});

test('integration: a campaign outside its live window does not count', async () => {
  await withServer(async ({ pool, base }) => {
    const now = Date.now();
    await insertActiveCampaign(pool, {
      target: 10, startsAt: new Date(now + 3600000).toISOString(), endsAt: new Date(now + 7200000).toISOString()
    });
    const { token } = await registerPlayer(base);
    const session = await createSession(base);
    const { body } = await submitPlay(base, { token, session, score: 50, duration: 5 });
    assert.deepEqual(body.campaigns, []);
    assert.deepEqual(body.newCoupons, []);
  });
});

test('integration: a collective campaign crossing its target pays out every participant', async () => {
  await withServer(async ({ pool, base }) => {
    const campaign = await insertActiveCampaign(pool, {
      kind: 'collective', metric: 'score', aggregation: 'sum', target: 100, perPlayerLimit: 1
    });
    const { token: tokenA } = await registerPlayer(base, { name: 'A', phone: '47991110011' });
    const { token: tokenB } = await registerPlayer(base, { name: 'B', phone: '47991110022' });

    // A plays first, contributing 60 (not enough alone).
    const sA1 = await createSession(base);
    const rA1 = await submitPlay(base, { token: tokenA, session: sA1, score: 60, duration: 5 });
    assert.equal(rA1.body.newCoupons.length, 0);
    assert.equal(rA1.body.campaigns[0].completed, false);

    // B plays and crosses the target (60 + 50 = 110 >= 100): both A and B should get a coupon.
    const sB1 = await createSession(base);
    const rB1 = await submitPlay(base, { token: tokenB, session: sB1, score: 50, duration: 5 });
    assert.equal(rB1.body.campaigns[0].completed, true);
    assert.equal(rB1.body.newCoupons.length, 1); // B's own coupon from this response

    const couponsRes = await pool.query('SELECT player_id FROM coupons WHERE campaign_id = $1', [campaign.id]);
    assert.equal(couponsRes.rows.length, 2); // both A and B were paid out

    const reachedRes = await pool.query('SELECT collective_reached_at FROM campaigns WHERE id = $1', [campaign.id]);
    assert.ok(reachedRes.rows[0].collective_reached_at);
  });
});

// ---- Players ----

test('integration: GET /api/players/me reports campaigns, coupons and a masked phone', async () => {
  await withServer(async ({ pool, base }) => {
    await insertActiveCampaign(pool, { target: 10 });
    const { token } = await registerPlayer(base, { name: 'MARIA', phone: '47998887766' });
    const session = await createSession(base);
    await submitPlay(base, { token, session, score: 50, duration: 5 });

    const res = await fetch(`${base}/api/players/me`, { headers: { 'X-Player-Token': token } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.player.name, 'MARIA');
    assert.equal(body.player.phoneMasked, '(47) 9****-7766');
    assert.equal(body.campaigns.length, 1);
    assert.equal(body.coupons.length, 1);

    const unauthorized = await fetch(`${base}/api/players/me`, { headers: { 'X-Player-Token': 'garbage' } });
    assert.equal(unauthorized.status, 401);
  });
});

test('integration: LGPD deletion anonymizes the player and invalidates the token', async () => {
  await withServer(async ({ base }) => {
    const { token } = await registerPlayer(base);
    const del = await fetch(`${base}/api/players/me`, { method: 'DELETE', headers: { 'X-Player-Token': token } });
    assert.equal(del.status, 200);
    assert.deepEqual(await del.json(), { ok: true });

    const me = await fetch(`${base}/api/players/me`, { headers: { 'X-Player-Token': token } });
    assert.equal(me.status, 401);
  });
});

// ---- Admin ----

test('integration: caixa is blocked from admin-only routes but can query and redeem coupons', async () => {
  await withServer(async ({ pool, base }) => {
    const campaign = await insertActiveCampaign(pool, { target: 10 });
    const { token } = await registerPlayer(base);
    const session = await createSession(base);
    const { body: playBody } = await submitPlay(base, { token, session, score: 50, duration: 5 });
    const code = playBody.newCoupons[0].code;

    const password = await insertAdmin(pool, { email: 'caixa@teste.com', role: 'caixa' });
    const { cookie } = await loginAdmin(base, 'caixa@teste.com', password);
    assert.ok(cookie);

    const forbidden = await fetch(`${base}/api/admin/campaigns`, { headers: { Cookie: cookie } });
    assert.equal(forbidden.status, 403);

    const lookup = await fetch(`${base}/api/admin/coupons/${code}`, { headers: { Cookie: cookie } });
    assert.equal(lookup.status, 200);
    const lookupBody = await lookup.json();
    assert.equal(lookupBody.coupon.status, 'issued');

    const redeem = await fetch(`${base}/api/admin/coupons/${code}/redeem`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(redeem.status, 200);
    assert.equal((await redeem.json()).coupon.status, 'redeemed');

    const secondRedeem = await fetch(`${base}/api/admin/coupons/${code}/redeem`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(secondRedeem.status, 409);
    void campaign;
  });
});

test('integration: redeeming an expired coupon returns 409', async () => {
  await withServer(async ({ pool, base }) => {
    const campaign = await insertActiveCampaign(pool, { target: 1 });
    const player = await pool.query(
      "INSERT INTO players (name, phone, consent_at, consent_version) VALUES ('ANA', '47999990000', now(), 'v1') RETURNING id",
      []
    );
    const codeRes = await pool.query(
      `INSERT INTO coupons (code, campaign_id, player_id, expires_at) VALUES ('CJ-TEST-EXPR', $1, $2, now() - interval '1 day') RETURNING code`,
      [campaign.id, player.rows[0].id]
    );
    const password = await insertAdmin(pool, { email: 'admin2@teste.com', role: 'admin' });
    const { cookie } = await loginAdmin(base, 'admin2@teste.com', password);
    const redeem = await fetch(`${base}/api/admin/coupons/${codeRes.rows[0].code}/redeem`, {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.equal(redeem.status, 409);
    const body = await redeem.json();
    assert.match(body.error, /expirado/);
  });
});

test('integration: admin login rejects wrong credentials generically and the cookie authenticates later requests', async () => {
  await withServer(async ({ pool, base }) => {
    const password = await insertAdmin(pool, { email: 'admin@teste.com', role: 'admin' });
    const wrong = await loginAdmin(base, 'admin@teste.com', 'senha-errada-123');
    assert.equal(wrong.res.status, 401);

    const missing = await loginAdmin(base, 'ninguem@teste.com', password);
    assert.equal(missing.res.status, 401);

    const ok = await loginAdmin(base, 'admin@teste.com', password);
    assert.equal(ok.res.status, 200);
    const me = await fetch(`${base}/api/admin/me`, { headers: { Cookie: ok.cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.role, 'admin');
  });
});

test('integration: dashboard responds with the contracted shape', async () => {
  await withServer(async ({ pool, base }) => {
    await insertActiveCampaign(pool, { target: 10 });
    const password = await insertAdmin(pool, { email: 'admin3@teste.com', role: 'admin' });
    const { cookie } = await loginAdmin(base, 'admin3@teste.com', password);
    const res = await fetch(`${base}/api/admin/dashboard?days=7`, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.kpis);
    assert.ok(['catcher', 'runner', 'ninja'].every(g => typeof body.kpis.playsByGame[g] === 'number'));
    assert.ok(Array.isArray(body.playsPerDay));
    assert.equal(body.playsPerDay.length, 7);
    assert.ok(Array.isArray(body.campaigns));
  });
});

test('integration: ranking ignores hidden plays and null player names', async () => {
  await withServer(async ({ pool, base }) => {
    await pool.query(
      "INSERT INTO plays (game, player_name, score, duration_seconds, hidden) VALUES ('catcher', 'VISIVEL', 100, 10, false)",
      []
    );
    await pool.query(
      "INSERT INTO plays (game, player_name, score, duration_seconds, hidden) VALUES ('catcher', 'ESCONDIDO', 999, 10, true)",
      []
    );
    await pool.query(
      "INSERT INTO plays (game, player_name, score, duration_seconds) VALUES ('catcher', NULL, 500, 10)",
      []
    );
    const res = await fetch(`${base}/api/ranking?game=catcher&period=all`);
    const body = await res.json();
    assert.equal(body.scores.length, 1);
    assert.equal(body.scores[0].name, 'VISIVEL');
  });
});

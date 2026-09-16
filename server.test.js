'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createServer, normalizeRankingPeriod, publicEntry, validateEntry, scoreCap, resolveStatic, setPool
} = require('./server');

// ---- In-memory fake Postgres pool ----
// Mirrors just enough of the real SQL (INSERT, the dedup+ORDER BY ranking list,
// and the RANK() player-standing lookup) to exercise server.js without a real database.
function makeFakePool() {
  const rows = [];
  let nextId = 1;
  return {
    rows,
    async query(text, params = []) {
      if (text.startsWith('INSERT INTO plays')) {
        const [game, name, score, duration] = params;
        const row = { id: nextId++, game, player_name: name, score, duration_seconds: duration, created_at: new Date() };
        rows.push(row);
        return { rows: [row] };
      }
      if (text.includes('CREATE TABLE') || text.includes('CREATE INDEX')) return { rows: [] };

      const game = params[0];
      const isMonth = text.includes("date_trunc('month'");
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const filtered = rows.filter(r => r.game === game && (!isMonth || r.created_at >= monthStart));

      const bestPerPlayer = new Map();
      for (const r of filtered) {
        const current = bestPerPlayer.get(r.player_name);
        if (!current || r.score > current.score || (r.score === current.score && r.created_at < current.created_at)) {
          bestPerPlayer.set(r.player_name, r);
        }
      }
      const ranked = [...bestPerPlayer.values()].sort((a, b) => b.score - a.score || a.created_at - b.created_at);

      if (text.includes('RANK()')) {
        const name = params[1];
        const idx = ranked.findIndex(r => r.player_name === name);
        if (idx === -1) return { rows: [] };
        return { rows: [{ ...ranked[idx], rank: idx + 1 }] };
      }
      return { rows: ranked.slice(0, 10) };
    }
  };
}

test('scoreCap grows with duration but never exceeds the absolute ceiling', () => {
  assert.equal(scoreCap('runner', 0), 300);
  assert.ok(scoreCap('runner', 60) > 300);
  assert.equal(scoreCap('runner', 1e9), 100000);
  assert.equal(scoreCap('unknown', 60), 0);
});

test('validateEntry normalizes a legitimate score', () => {
  const entry = validateEntry({ game: ' Runner ', name: '  joão  silva ', score: 120, duration: 45.27 });
  assert.deepEqual(entry, { game: 'runner', name: 'JOÃO SILVA', score: 120, duration: 45.3 });
});

test('validateEntry rejects tampered or implausible payloads', () => {
  assert.equal(validateEntry({ game: 'runner', name: 'X', score: -1, duration: 10 }), null);
  assert.equal(validateEntry({ game: 'runner', name: 'X', score: 1.5, duration: 10 }), null);
  assert.equal(validateEntry({ game: 'chess', name: 'X', score: 1, duration: 10 }), null);
  assert.equal(validateEntry({ game: 'runner', name: '<script>', score: 1, duration: 10 }), null);
  assert.equal(validateEntry({ game: 'runner', name: '', score: 1, duration: 10 }), null);
  assert.equal(validateEntry({ game: 'runner', name: 'X'.repeat(15), score: 1, duration: 10 }), null);
  // 1,000,000 points after 1 second of runner is far above any plausible cap.
  assert.equal(validateEntry({ game: 'runner', name: 'X', score: 1000000, duration: 1 }), null);
  assert.equal(validateEntry({ game: 'runner', name: 'X', score: 1, duration: -1 }), null);
  assert.equal(validateEntry({ game: 'runner', name: 'X', score: 1, duration: 999999 }), null);
});

test('publicEntry exposes the public score contract', () => {
  assert.deepEqual(publicEntry({ player_name: 'ANA', score: '42', duration_seconds: '12.5', created_at: new Date('2026-01-01T00:00:00Z') }), {
    name: 'ANA', score: 42, duration: 12.5, createdAt: '2026-01-01T00:00:00.000Z'
  });
});

test('accepts only the known ranking periods', () => {
  assert.equal(normalizeRankingPeriod('month'), 'month');
  assert.equal(normalizeRankingPeriod('all'), 'all');
  assert.equal(normalizeRankingPeriod('weekly'), 'all');
  assert.equal(normalizeRankingPeriod(undefined), 'all');
});

test('resolveStatic serves only allow-listed project files', () => {
  assert.ok(resolveStatic('/'));
  assert.ok(resolveStatic('/index.html'));
  assert.ok(resolveStatic('/css/style.css'));
  assert.ok(resolveStatic('/js/main.js'));
  assert.ok(resolveStatic('/assets/logo-chef-john.png'));
  assert.equal(resolveStatic('/../server.js'), null);
  assert.equal(resolveStatic('/%2e%2e/server.js'), null);
  assert.equal(resolveStatic('/.env'), null);
  assert.equal(resolveStatic('/server.js'), null);
  assert.equal(resolveStatic('/package.json'), null);
  assert.equal(resolveStatic('/migrations/001_ranking.up.sql'), null);
  assert.equal(resolveStatic('/scripts/provision-database.js'), null);
  assert.equal(resolveStatic('/tests/games.test.cjs'), null);
  assert.equal(resolveStatic('/node_modules/pg/package.json'), null);
  assert.equal(resolveStatic('/js/.hidden.js'), null);
});

test('static files carry hardening headers and no-store JSON errors', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    const page = await fetch(`${base}/`);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.equal(page.headers.get('strict-transport-security'), 'max-age=31536000');

    const missing = await fetch(`${base}/nope.html`);
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('cache-control'), 'no-store');

    const traversal = await fetch(`${base}/../package.json`);
    assert.equal(traversal.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('ranking submission requires a signed session, JSON body and same origin', async () => {
  setPool(makeFakePool());
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const crossOrigin = await fetch(`${base}/api/session`, { method: 'POST', headers: { Origin: 'https://evil.example' } });
    assert.equal(crossOrigin.status, 403);

    const sessionResponse = await fetch(`${base}/api/session`, { method: 'POST' });
    assert.equal(sessionResponse.status, 201);
    const { session } = await sessionResponse.json();
    assert.equal(typeof session, 'string');

    const entry = { game: 'runner', name: 'TESTE', score: 50, duration: 5 };
    const noContentType = await fetch(`${base}/api/ranking`, { method: 'POST', body: JSON.stringify(entry) });
    assert.equal(noContentType.status, 415);

    const noSession = await fetch(`${base}/api/ranking`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    assert.equal(noSession.status, 401);

    const [p0, p1] = session.split('.');
    const tampered = await fetch(`${base}/api/ranking`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, session: `${p0}.${p1.startsWith('a') ? 'b' : 'a'}${p1.slice(1)}` })
    });
    assert.equal(tampered.status, 401);

    const saved = await fetch(`${base}/api/ranking`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, session })
    });
    assert.equal(saved.status, 201);
    const savedBody = await saved.json();
    assert.equal(savedBody.entry.name, 'TESTE');
    assert.equal(savedBody.entry.score, 50);
    assert.ok(savedBody.all.some(r => r.name === 'TESTE'));

    // The session is single-use: submitting again with the same token must fail.
    const reused = await fetch(`${base}/api/ranking`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...entry, session })
    });
    assert.equal(reused.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('a submitted score cannot exceed what the elapsed session time makes plausible', async () => {
  setPool(makeFakePool());
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;
    const { session } = await (await fetch(`${base}/api/session`, { method: 'POST' })).json();

    // Claiming a long duration the session has not actually lived through must be rejected.
    const fakeDuration = await fetch(`${base}/api/ranking`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: 'runner', name: 'X', score: 90000, duration: 3600, session })
    });
    assert.equal(fakeDuration.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('GET /api/ranking separates monthly from all-time and reports the player standing', async () => {
  const pool = makeFakePool();
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  pool.rows.push(
    { id: 1, game: 'catcher', player_name: 'ANTIGA', score: 999, duration_seconds: 30, created_at: lastMonth },
    { id: 2, game: 'catcher', player_name: 'ATUAL', score: 40, duration_seconds: 20, created_at: now },
    { id: 3, game: 'catcher', player_name: 'ATUAL', score: 10, duration_seconds: 20, created_at: now }
  );
  setPool(pool);
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const missingGame = await fetch(`${base}/api/ranking?period=all`);
    assert.equal(missingGame.status, 400);

    const all = await (await fetch(`${base}/api/ranking?game=catcher&period=all`)).json();
    assert.equal(all.scores.length, 2);
    assert.equal(all.scores[0].name, 'ANTIGA');
    // Best score per player only: ATUAL's 10-point run must not appear alongside the 40.
    assert.equal(all.scores.filter(s => s.name === 'ATUAL').length, 1);
    assert.equal(all.scores.find(s => s.name === 'ATUAL').score, 40);

    const month = await (await fetch(`${base}/api/ranking?game=catcher&period=month`)).json();
    assert.equal(month.scores.length, 1);
    assert.equal(month.scores[0].name, 'ATUAL');

    const withPlayer = await (await fetch(`${base}/api/ranking?game=catcher&period=all&name=atual`)).json();
    assert.equal(withPlayer.player.rank, 2);
    assert.equal(withPlayer.player.score, 40);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

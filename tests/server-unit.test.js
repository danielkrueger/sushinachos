'use strict';

// Unit tests for the pure lib/ modules: no DB, no HTTP.

const test = require('node:test');
const assert = require('node:assert/strict');

const campaignsLib = require('../lib/campaigns');
const playersLib = require('../lib/players');
const adminAuth = require('../lib/admin-auth');
const couponsLib = require('../lib/coupons');
const validation = require('../lib/validation');
const campaignInput = require('../lib/campaign-input');
const { resolveStatic } = require('../server');

// ---- lib/campaigns: isLive / nextChange ----

function baseCampaign(overrides) {
  return {
    status: 'active',
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.000Z',
    weekdays: null,
    dailyStart: null,
    dailyEnd: null,
    ...overrides
  };
}

test('isLive respects status, start and end regardless of window', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  assert.equal(campaignsLib.isLive(baseCampaign({ status: 'draft' }), now), false);
  assert.equal(campaignsLib.isLive(baseCampaign({ status: 'active', startsAt: '2027-01-01T00:00:00.000Z' }), now), false);
  assert.equal(campaignsLib.isLive(baseCampaign({ status: 'active', endsAt: '2026-01-01T00:00:00.000Z' }), now), false);
  assert.equal(campaignsLib.isLive(baseCampaign(), now), true);
});

test('isLive honors weekdays (0=Sunday) in America/Sao_Paulo', () => {
  // 2026-09-15 is a Tuesday. At 15:00 UTC it is 12:00 in America/Sao_Paulo (still Tuesday).
  const tuesdayNoonBrt = new Date('2026-09-15T15:00:00.000Z');
  const wednesdayNoonBrt = new Date('2026-09-16T15:00:00.000Z');
  const campaign = baseCampaign({ weekdays: [2] }); // Tuesday only
  assert.equal(campaignsLib.isLive(campaign, tuesdayNoonBrt), true);
  assert.equal(campaignsLib.isLive(campaign, wednesdayNoonBrt), false);
});

test('isLive honors a daily window that crosses midnight (22:00-02:00 BRT)', () => {
  const campaign = baseCampaign({ dailyStart: '22:00', dailyEnd: '02:00' });
  // 23:30 BRT = 02:30 UTC (next day) -> inside window.
  const inWindowLate = new Date('2026-06-16T02:30:00.000Z');
  // 01:00 BRT = 04:00 UTC -> inside window (past midnight, before 02:00).
  const inWindowEarly = new Date('2026-06-16T04:00:00.000Z');
  // 10:00 BRT = 13:00 UTC -> outside window.
  const outsideWindow = new Date('2026-06-16T13:00:00.000Z');
  assert.equal(campaignsLib.isLive(campaign, inWindowLate), true);
  assert.equal(campaignsLib.isLive(campaign, inWindowEarly), true);
  assert.equal(campaignsLib.isLive(campaign, outsideWindow), false);
});

test('isLive honors a same-day daily window (18:00-21:00 BRT)', () => {
  const campaign = baseCampaign({ dailyStart: '18:00', dailyEnd: '21:00' });
  const insideWindow = new Date('2026-06-16T22:00:00.000Z'); // 19:00 BRT
  const beforeWindow = new Date('2026-06-16T15:00:00.000Z'); // 12:00 BRT
  assert.equal(campaignsLib.isLive(campaign, insideWindow), true);
  assert.equal(campaignsLib.isLive(campaign, beforeWindow), false);
});

test('nextChange returns the next instant the live state flips, capped at endsAt', () => {
  const campaign = baseCampaign({ weekdays: [2], dailyStart: '18:00', dailyEnd: '21:00' });
  // Monday noon BRT: not live yet; next change should be Tuesday 18:00 BRT (21:00 UTC).
  const mondayNoonBrt = new Date('2026-09-14T15:00:00.000Z');
  const next = campaignsLib.nextChange(campaign, mondayNoonBrt);
  assert.ok(next instanceof Date);
  assert.equal(next.toISOString(), '2026-09-15T21:00:00.000Z');

  // Once ended, there is nothing more to report.
  const ended = campaignsLib.nextChange(campaign, new Date('2027-01-01T00:00:00.000Z'));
  assert.equal(ended, null);
});

test('nextChange caps at endsAt when the campaign never goes live again inside the window', () => {
  const campaign = baseCampaign({
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-01-01T00:10:00.000Z',
    weekdays: [1] // Monday only, ends long before any Monday shows up in an 8-day scan from a Wednesday
  });
  const wednesday = new Date('2026-01-01T00:00:00.000Z'); // 2026-01-01 during creation window is fine for the test
  const next = campaignsLib.nextChange(campaign, wednesday);
  // Whatever happens, it must never exceed endsAt.
  if (next) assert.ok(next.getTime() <= new Date(campaign.endsAt).getTime());
});

// ---- lib/campaigns: matches / playValue / aggregateProgress ----

test('matches filters by game and restricts the deliveries metric to runner', () => {
  const anyGame = { game: null, metric: 'score' };
  const runnerOnly = { game: 'runner', metric: 'score' };
  const deliveriesMetric = { game: null, metric: 'deliveries' };
  assert.equal(campaignsLib.matches(anyGame, { game: 'catcher' }), true);
  assert.equal(campaignsLib.matches(runnerOnly, { game: 'catcher' }), false);
  assert.equal(campaignsLib.matches(runnerOnly, { game: 'runner' }), true);
  assert.equal(campaignsLib.matches(deliveriesMetric, { game: 'catcher' }), false);
  assert.equal(campaignsLib.matches(deliveriesMetric, { game: 'runner' }), true);
});

test('playValue applies the metric and floors the multiplied result', () => {
  assert.equal(campaignsLib.playValue({ metric: 'score', multiplier: 2 }, { score: 101 }), 202);
  assert.equal(campaignsLib.playValue({ metric: 'deliveries', multiplier: 1.5 }, { deliveries: 3 }), 4);
  assert.equal(campaignsLib.playValue({ metric: 'plays', multiplier: 1 }, {}), 1);
});

test('aggregateProgress computes best or sum', () => {
  assert.equal(campaignsLib.aggregateProgress([10, 40, 25], 'best'), 40);
  assert.equal(campaignsLib.aggregateProgress([10, 40, 25], 'sum'), 75);
  assert.equal(campaignsLib.aggregateProgress([], 'sum'), 0);
});

// ---- lib/players ----

test('normalizePhone accepts 11-digit and 13-digit (55-prefixed) mobile numbers', () => {
  assert.equal(playersLib.normalizePhone('(47) 99123-4567'), '5547991234567');
  assert.equal(playersLib.normalizePhone('5547991234567'), '5547991234567');
  assert.equal(playersLib.normalizePhone('4791234567'), null); // 10 digits, not a mobile
  assert.equal(playersLib.normalizePhone('47881234567'), null); // does not start with 9
  assert.equal(playersLib.normalizePhone('00991234567'), null); // DDD 00 invalid
  assert.equal(playersLib.normalizePhone(''), null);
});

test('maskPhone shows DDD and last 4 digits only', () => {
  assert.equal(playersLib.maskPhone('5547991234567'), '(47) 9****-4567');
  assert.equal(playersLib.maskPhone('123'), '');
});

test('player token round-trips and rejects tampering/expiry', () => {
  const secret = 'test-secret';
  const token = playersLib.signPlayerToken(42, secret);
  const verified = playersLib.verifyPlayerToken(token, secret);
  assert.deepEqual(verified, { pid: 42 });

  assert.equal(playersLib.verifyPlayerToken(token, 'wrong-secret'), null);
  assert.equal(playersLib.verifyPlayerToken(token + 'x', secret), null);
  assert.equal(playersLib.verifyPlayerToken('not-a-token', secret), null);

  const [encoded] = token.split('.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  const expiredPayload = { ...payload, iat: Date.now() - (401 * 24 * 60 * 60 * 1000) };
  const expiredEncoded = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  const crypto = require('node:crypto');
  const expiredSig = crypto.createHmac('sha256', secret).update(expiredEncoded).digest('base64url');
  assert.equal(playersLib.verifyPlayerToken(`${expiredEncoded}.${expiredSig}`, secret), null);
});

// ---- lib/admin-auth ----

test('hashPassword/verifyPassword round-trip and reject wrong passwords', () => {
  const hash = adminAuth.hashPassword('minhasenha123');
  assert.equal(adminAuth.verifyPassword('minhasenha123', hash), true);
  assert.equal(adminAuth.verifyPassword('outrasenha123', hash), false);
  assert.equal(adminAuth.verifyPassword('minhasenha123', 'garbage'), false);
});

test('isPasswordStrongEnough enforces the 10-character minimum', () => {
  assert.equal(adminAuth.isPasswordStrongEnough('123456789'), false);
  assert.equal(adminAuth.isPasswordStrongEnough('1234567890'), true);
});

test('admin cookie round-trips, rejects tampering, and expires', () => {
  const secret = 'admin-secret';
  const now = Date.now();
  const cookie = adminAuth.signAdminCookie({ uid: 1, role: 'admin' }, secret, now);
  const verified = adminAuth.verifyAdminCookie(cookie, secret);
  assert.deepEqual(verified, { uid: 1, role: 'admin' });

  assert.equal(adminAuth.verifyAdminCookie(cookie, 'wrong-secret'), null);
  assert.equal(adminAuth.verifyAdminCookie(cookie + 'x', secret), null);

  const expiredCookie = adminAuth.signAdminCookie({ uid: 1, role: 'admin' }, secret, now - 13 * 60 * 60 * 1000);
  assert.equal(adminAuth.verifyAdminCookie(expiredCookie, secret), null);
});

test('parseCookies reads a Cookie header into a map', () => {
  const cookies = adminAuth.parseCookies('cj_admin=abc.def; other=1');
  assert.equal(cookies.cj_admin, 'abc.def');
  assert.equal(cookies.other, '1');
  assert.deepEqual(adminAuth.parseCookies(undefined), {});
});

// ---- lib/coupons ----

test('generateCouponCode matches CJ-XXXX-XXXX with the safe alphabet', () => {
  for (let i = 0; i < 20; i++) {
    const code = couponsLib.generateCouponCode();
    assert.match(code, /^CJ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    for (const char of code.replace(/^CJ-/, '').replace('-', '')) {
      assert.ok(couponsLib.ALPHABET.includes(char), `unexpected char ${char}`);
    }
  }
});

test('normalizeCouponCode accepts lowercase, missing hyphens and stray spaces', () => {
  assert.equal(couponsLib.normalizeCouponCode('cj7kq2m9tx'), 'CJ-7KQ2-M9TX');
  assert.equal(couponsLib.normalizeCouponCode('CJ-7KQ2-M9TX'), 'CJ-7KQ2-M9TX');
  assert.equal(couponsLib.normalizeCouponCode(' cj 7kq2 m9tx '), 'CJ-7KQ2-M9TX');
  assert.equal(couponsLib.normalizeCouponCode('short'), null);
});

// ---- lib/validation ----

test('validatePlayInput enforces the deliveries cap based on duration and game', () => {
  assert.ok(validation.validatePlayInput({ game: 'runner', score: 100, duration: 90, deliveries: 3 }));
  assert.equal(validation.validatePlayInput({ game: 'runner', score: 100, duration: 10, deliveries: 3 }), null);
  assert.equal(validation.validatePlayInput({ game: 'catcher', score: 100, duration: 90, deliveries: 1 }), null);
  const noDeliveries = validation.validatePlayInput({ game: 'catcher', score: 100, duration: 10 });
  assert.equal(noDeliveries.deliveries, null);
});

test('normalizePlayerName mirrors the ranking name rule', () => {
  assert.equal(validation.normalizePlayerName('  joão  silva '), 'JOÃO SILVA');
  assert.equal(validation.normalizePlayerName('<script>'), null);
  assert.equal(validation.normalizePlayerName('X'.repeat(15)), null);
});

// ---- lib/campaign-input ----

test('validateCampaign accepts a well-formed challenge campaign', () => {
  const { errors, value } = campaignInput.validateCampaign({
    title: 'Desafio do Chef John', bannerText: 'Supere o John!', description: 'Regras...',
    kind: 'challenge', game: 'runner', metric: 'score', aggregation: 'best', target: 1241,
    multiplier: 1, startsAt: '2026-09-15T00:00:00Z', endsAt: '2026-10-15T00:00:00Z',
    prizeTitle: 'Refri', prizeDescription: 'Refri 2L', stock: 50, perPlayerLimit: 1,
    couponValidDays: 7, challengerName: 'Chef John', challengerScore: 1240, status: 'active'
  });
  assert.equal(errors, undefined);
  assert.equal(value.target, 1241);
  assert.equal(value.weekdays, null);
});

test('validateCampaign rejects endsAt before startsAt and deliveries metric with a non-runner game', () => {
  const badDates = campaignInput.validateCampaign({
    title: 'X', bannerText: 'Y', description: 'Z', kind: 'challenge', game: null, metric: 'score',
    aggregation: 'best', target: 10, startsAt: '2026-10-15T00:00:00Z', endsAt: '2026-09-15T00:00:00Z',
    prizeTitle: 'P', prizeDescription: 'D'
  });
  assert.ok(badDates.errors && badDates.errors.some(e => e.field === 'endsAt'));

  const badMetric = campaignInput.validateCampaign({
    title: 'X', bannerText: 'Y', description: 'Z', kind: 'challenge', game: 'catcher', metric: 'deliveries',
    aggregation: 'best', target: 10, startsAt: '2026-09-15T00:00:00Z', endsAt: '2026-10-15T00:00:00Z',
    prizeTitle: 'P', prizeDescription: 'D'
  });
  assert.ok(badMetric.errors && badMetric.errors.some(e => e.field === 'game'));
});

// ---- server.js: /admin static routing ----

test('resolveStatic serves admin.html for /admin and /admin/, and never serves lib/', () => {
  assert.equal(resolveStatic('/admin').abs.endsWith('admin.html'), true);
  assert.equal(resolveStatic('/admin/').abs.endsWith('admin.html'), true);
  assert.equal(resolveStatic('/admin').isAdmin, true);
  assert.equal(resolveStatic('/lib/validation.js'), null);
  assert.equal(resolveStatic('/lib/../server.js'), null);
});

test('validateCampaign requires both dailyStart and dailyEnd together', () => {
  const result = campaignInput.validateCampaign({
    title: 'X', bannerText: 'Y', description: 'Z', kind: 'challenge', game: null, metric: 'score',
    aggregation: 'best', target: 10, startsAt: '2026-09-15T00:00:00Z', endsAt: '2026-10-15T00:00:00Z',
    prizeTitle: 'P', prizeDescription: 'D', dailyStart: '18:00'
  });
  assert.ok(result.errors && result.errors.some(e => e.field === 'dailyStart'));
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/admin.js');

test('formatCouponCode masks partial and full input, accepting lowercase/no-hyphen', () => {
  assert.equal(A.formatCouponCode(''), 'SN-');
  assert.equal(A.formatCouponCode('7'), 'SN-7');
  assert.equal(A.formatCouponCode('7kq2'), 'SN-7KQ2');
  assert.equal(A.formatCouponCode('7kq2m9tx'), 'SN-7KQ2-M9TX');
  assert.equal(A.formatCouponCode('sn7kq2m9tx'), 'SN-7KQ2-M9TX');
  assert.equal(A.formatCouponCode('SN-7KQ2-M9TX'), 'SN-7KQ2-M9TX');
  assert.equal(A.formatCouponCode('  sn 7kq2 m9tx  '), 'SN-7KQ2-M9TX');
  assert.equal(A.formatCouponCode('cj7kq2m9tx'), 'CJ-7KQ2-M9TX');
  assert.equal(A.formatCouponCode('CJ-7KQ2-M9TX'), 'CJ-7KQ2-M9TX');
});

test('isCompleteCouponCode validates the full SN-XXXX-XXXX shape', () => {
  assert.equal(A.isCompleteCouponCode('SN-7KQ2-M9TX'), true);
  assert.equal(A.isCompleteCouponCode('CJ-7KQ2-M9TX'), true);
  assert.equal(A.isCompleteCouponCode('SN-7KQ2'), false);
  assert.equal(A.isCompleteCouponCode('SN-'), false);
  assert.equal(A.isCompleteCouponCode(''), false);
});

test('datetime-local <-> ISO round-trip treats value as America/Sao_Paulo (-03:00)', () => {
  const iso = A.isoFromDatetimeLocalBR('2026-09-15T18:00');
  assert.equal(iso, '2026-09-15T21:00:00.000Z');
  assert.equal(A.datetimeLocalBRFromISO(iso), '2026-09-15T18:00');
});

test('datetimeLocalBRFromISO handles a midnight-crossing UTC instant', () => {
  // 2026-09-15T01:30Z is 2026-09-14T22:30 in Brasília.
  assert.equal(A.datetimeLocalBRFromISO('2026-09-15T01:30:00.000Z'), '2026-09-14T22:30');
});

test('brDateOnly and brDateTime format in Brasília time', () => {
  assert.equal(A.brDateOnly('2026-09-14T22:32:00.000Z'), '14/09/2026');
  assert.equal(A.brDateTime('2026-09-14T22:32:00.000Z'), '14/09/2026 19:32');
});

test('weekdaysSummary handles single and multiple days, including gender rules', () => {
  assert.equal(A.weekdaysSummary(null), '');
  assert.equal(A.weekdaysSummary([]), '');
  assert.equal(A.weekdaysSummary([2]), 'toda terça');
  assert.equal(A.weekdaysSummary([0]), 'todo domingo');
  assert.equal(A.weekdaysSummary([6]), 'todo sábado');
  assert.equal(A.weekdaysSummary([2, 4]), 'às terças e quintas');
  assert.equal(A.weekdaysSummary([0, 2, 6]), 'às domingos, terças e sábados');
});

test('windowSummary formats a daily window in short hour form', () => {
  assert.equal(A.windowSummary(null, null), '');
  assert.equal(A.windowSummary('18:00', '21:00'), 'das 18h às 21h');
  assert.equal(A.windowSummary('18:30', '21:00'), 'das 18h30 às 21h');
});

test('gameLabel maps game codes to pt-BR names', () => {
  assert.equal(A.gameLabel('catcher'), 'Festa Mexicana');
  assert.equal(A.gameLabel('runner'), 'Entrega Sushinachos');
  assert.equal(A.gameLabel('ninja'), 'Sushi Ninja');
  assert.equal(A.gameLabel(null), 'qualquer jogo');
});

test('targetHintText explains John Coin rate and delivery expectations by metric', () => {
  assert.match(A.targetHintText('score'), /370 a 400 SN Coins por minuto/);
  assert.match(A.targetHintText('deliveries'), /1 entrega a cada 45–60s/);
  assert.match(A.targetHintText('plays'), /partida/);
});

test('campaignStatusInfo derives the right badge from status + dates + live', () => {
  const now = new Date('2026-09-14T12:00:00.000Z');
  assert.equal(A.campaignStatusInfo({ status: 'draft' }, now).label, 'Rascunho');
  assert.equal(A.campaignStatusInfo({ status: 'archived' }, now).label, 'Encerrada');
  assert.equal(A.campaignStatusInfo({ status: 'active', startsAt: '2026-09-20T00:00:00Z', endsAt: '2026-10-01T00:00:00Z', live: false }, now).label, 'Agendada');
  assert.equal(A.campaignStatusInfo({ status: 'active', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-10T00:00:00Z', live: false }, now).label, 'Encerrada');
  assert.equal(A.campaignStatusInfo({ status: 'paused', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-10-01T00:00:00Z' }, now).label, 'Pausada');
  assert.equal(A.campaignStatusInfo({ status: 'active', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-10-01T00:00:00Z', live: true }, now).label, 'Ao vivo');
  assert.equal(A.campaignStatusInfo({ status: 'active', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-10-01T00:00:00Z', live: false }, now).label, 'Agendada');
});

test('progressPercent clamps between 0 and 100', () => {
  assert.equal(A.progressPercent(50, 100), 50);
  assert.equal(A.progressPercent(0, 100), 0);
  assert.equal(A.progressPercent(150, 100), 100);
  assert.equal(A.progressPercent(10, 0), 0);
});

test('formatDuration renders minutes+seconds or just seconds', () => {
  assert.equal(A.formatDuration(45), '45s');
  assert.equal(A.formatDuration(92), '1min 32s');
  assert.equal(A.formatDuration(0), '0s');
});

test('humanSummary composes the challenge sentence for a target campaign', () => {
  const summary = A.humanSummary({
    kind: 'challenge', game: null, metric: 'score', aggregation: 'sum', target: 2000, multiplier: 2,
    weekdays: [2], dailyStart: '18:00', dailyEnd: '21:00',
    startsAt: '2026-09-15T00:00:00.000Z', endsAt: '2026-09-30T00:00:00.000Z',
    prizeTitle: 'Refri 2L', stock: 50, perPlayerLimit: 1, couponValidDays: 10,
  });
  assert.match(summary, /Toda terça das 18h às 21h/);
  assert.match(summary, /somar 2\.000 pontos em qualquer jogo/);
  assert.match(summary, /ganha Refri 2L/);
  assert.match(summary, /2× SN Coin/);
  assert.match(summary, /50 unidades, 1 por pessoa/);
});

test('humanSummary composes the "Desafio do Chef John" sentence with the challenger', () => {
  const summary = A.humanSummary({
    kind: 'challenge', game: 'runner', metric: 'score', aggregation: 'best', target: 1241, multiplier: 1,
    weekdays: null, dailyStart: null, dailyEnd: null,
    startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z',
    challengerName: 'Chef John', challengerScore: 1240,
    prizeTitle: 'Refrigerante 2L grátis', stock: 50, perPlayerLimit: 1, couponValidDays: 7,
  });
  assert.match(summary, /superar Chef John \(1\.240 pontos na Entrega Sushinachos\)/);
  assert.match(summary, /ganha Refrigerante 2L grátis/);
});

test('humanSummary composes the collective-goal sentence', () => {
  const summary = A.humanSummary({
    kind: 'collective', game: 'runner', metric: 'deliveries', aggregation: 'sum', target: 1000, multiplier: 1,
    weekdays: null, dailyStart: null, dailyEnd: null,
    startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z',
    prizeTitle: 'Rodada de refrigerantes', stock: null, perPlayerLimit: 1, couponValidDays: 14,
  });
  assert.match(summary, /juntos, os jogadores precisam somar 1\.000 entregas na Entrega Sushinachos/);
  assert.match(summary, /estoque ilimitado, 1 por pessoa/);
});

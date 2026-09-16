'use strict';

// Validates a full camelCase campaign object as sent by the admin UI. Used both for
// POST /api/admin/campaigns (defaults applied by the caller before validating) and for
// PUT (the caller merges the partial body over the existing row first, then validates
// the merged object here) — one validator, one set of rules, no partial-vs-full drift.

const GAMES = new Set(['catcher', 'runner', 'ninja']);
const KINDS = new Set(['challenge', 'collective']);
const METRICS = new Set(['score', 'deliveries', 'plays']);
const AGGREGATIONS = new Set(['best', 'sum']);
const STATUSES = new Set(['draft', 'active', 'paused', 'archived']);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function str(v) { return typeof v === 'string' ? v.trim() : ''; }

function validateCampaign(input) {
  input = input && typeof input === 'object' ? input : {};
  const errors = [];
  const value = {};
  const fail = (field, message) => errors.push({ field, message });

  const title = str(input.title);
  if (!title || title.length > 60) fail('title', 'título obrigatório (até 60 caracteres)');
  else value.title = title;

  const bannerText = str(input.bannerText);
  if (!bannerText || bannerText.length > 90) fail('bannerText', 'chamada obrigatória (até 90 caracteres)');
  else value.bannerText = bannerText;

  const description = str(input.description);
  if (!description) fail('description', 'descrição obrigatória');
  else value.description = description;

  if (!KINDS.has(input.kind)) fail('kind', 'tipo de campanha inválido');
  else value.kind = input.kind;

  if (input.game == null) value.game = null;
  else if (GAMES.has(input.game)) value.game = input.game;
  else fail('game', 'jogo inválido');

  if (!METRICS.has(input.metric)) fail('metric', 'métrica inválida');
  else value.metric = input.metric;
  if (value.metric === 'deliveries' && value.game && value.game !== 'runner') {
    fail('game', 'a métrica de entregas só vale para a Corrida');
  }

  if (!AGGREGATIONS.has(input.aggregation)) fail('aggregation', 'agregação inválida');
  else value.aggregation = input.aggregation;

  const target = Number(input.target);
  if (!Number.isInteger(target) || target <= 0) fail('target', 'meta deve ser um número inteiro maior que zero');
  else value.target = target;

  const multiplier = input.multiplier == null ? 1 : Number(input.multiplier);
  if (!Number.isFinite(multiplier) || multiplier < 1 || multiplier > 5) fail('multiplier', 'multiplicador deve ser entre 1 e 5');
  else value.multiplier = Math.round(multiplier * 10) / 10;

  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (isNaN(startsAt.getTime())) fail('startsAt', 'data de início inválida');
  else value.startsAt = startsAt.toISOString();
  if (isNaN(endsAt.getTime())) fail('endsAt', 'data de fim inválida');
  else value.endsAt = endsAt.toISOString();
  if (!isNaN(startsAt.getTime()) && !isNaN(endsAt.getTime()) && endsAt.getTime() <= startsAt.getTime()) {
    fail('endsAt', 'fim deve ser depois do início');
  }

  if (input.weekdays == null) {
    value.weekdays = null;
  } else if (Array.isArray(input.weekdays) && input.weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
    const unique = [...new Set(input.weekdays)].sort((a, b) => a - b);
    value.weekdays = unique.length ? unique : null;
  } else {
    fail('weekdays', 'dias da semana inválidos (use 0 a 6)');
  }

  const dailyStart = input.dailyStart == null || input.dailyStart === '' ? null : input.dailyStart;
  const dailyEnd = input.dailyEnd == null || input.dailyEnd === '' ? null : input.dailyEnd;
  if ((dailyStart == null) !== (dailyEnd == null)) {
    fail('dailyStart', 'informe início e fim da janela diária, ou nenhum dos dois');
  } else if (dailyStart != null && (!TIME_RE.test(dailyStart) || !TIME_RE.test(dailyEnd))) {
    fail('dailyStart', 'horário inválido (use HH:MM)');
  } else {
    value.dailyStart = dailyStart;
    value.dailyEnd = dailyEnd;
  }

  const prizeTitle = str(input.prizeTitle);
  if (!prizeTitle || prizeTitle.length > 60) fail('prizeTitle', 'título do prêmio obrigatório (até 60 caracteres)');
  else value.prizeTitle = prizeTitle;

  const prizeDescription = str(input.prizeDescription);
  if (!prizeDescription || prizeDescription.length > 200) fail('prizeDescription', 'descrição do prêmio obrigatória (até 200 caracteres)');
  else value.prizeDescription = prizeDescription;

  if (input.stock == null) {
    value.stock = null;
  } else {
    const stock = Number(input.stock);
    if (!Number.isInteger(stock) || stock < 0) fail('stock', 'estoque deve ser um número inteiro maior ou igual a zero');
    else value.stock = stock;
  }

  const perPlayerLimit = input.perPlayerLimit == null ? 1 : Number(input.perPlayerLimit);
  if (!Number.isInteger(perPlayerLimit) || perPlayerLimit < 1) fail('perPlayerLimit', 'limite por pessoa deve ser um número inteiro maior ou igual a 1');
  else value.perPlayerLimit = perPlayerLimit;

  const couponValidDays = input.couponValidDays == null ? 7 : Number(input.couponValidDays);
  if (!Number.isInteger(couponValidDays) || couponValidDays < 1 || couponValidDays > 90) {
    fail('couponValidDays', 'validade do cupom deve ser entre 1 e 90 dias');
  } else {
    value.couponValidDays = couponValidDays;
  }

  value.challengerName = input.challengerName ? str(input.challengerName).slice(0, 30) : null;
  if (input.challengerScore == null || input.challengerScore === '') {
    value.challengerScore = null;
  } else {
    const cs = Number(input.challengerScore);
    if (!Number.isInteger(cs) || cs < 0) fail('challengerScore', 'pontuação do desafiante inválida');
    else value.challengerScore = cs;
  }

  const status = input.status || 'draft';
  if (!STATUSES.has(status)) fail('status', 'status inválido');
  else value.status = status;

  if (errors.length) return { errors };
  return { value };
}

module.exports = { validateCampaign, GAMES, KINDS, METRICS, AGGREGATIONS, STATUSES };

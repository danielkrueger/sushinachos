'use strict';

// Seeds the 4 presentation campaigns. Idempotent by title: reused by scripts/dev-server.js
// (in-memory PGlite) and runnable standalone against a real Postgres via DATABASE_URL/PG*.

const CAMPAIGNS = [
  {
    title: 'Desafio do Chef Sushinachos',
    bannerText: 'O Chef fez 1.240 na Corrida. Você supera?',
    description: 'Supere o recorde de 1.240 pontos do Chef na Corrida Sushinachos e ganhe um brinde no restaurante.',
    kind: 'challenge', game: 'runner', metric: 'score', aggregation: 'best',
    target: 1241, multiplier: 1, weekdays: null, dailyStart: null, dailyEnd: null,
    prizeTitle: 'Porção de Nachos grátis', prizeDescription: 'Uma porção crocante de nachos com guacamole no Sushinachos.',
    stock: 100, perPlayerLimit: 1, couponValidDays: 14,
    challengerName: 'Chef Sushinachos', challengerScore: 1240
  },
  {
    title: 'Terça turbinada',
    bannerText: 'Toda terça, das 18h às 21h, pontos em dobro!',
    description: 'Toda terça-feira, das 18h às 21h, seus pontos valem em dobro. Some 2.000 pontos em qualquer jogo e ganhe um brinde.',
    kind: 'challenge', game: null, metric: 'score', aggregation: 'sum',
    target: 2000, multiplier: 2, weekdays: [2], dailyStart: '18:00', dailyEnd: '21:00',
    prizeTitle: 'Hot Roll especial grátis', prizeDescription: 'Uma porção de hot roll especial grátis no Sushinachos.',
    stock: 60, perPlayerLimit: 1, couponValidDays: 7,
    challengerName: null, challengerScore: null
  },
  {
    title: 'Cidade entrega 1.000 combos',
    bannerText: 'Ajude a bater 1.000 entregas de sushi e nachos!',
    description: 'Meta coletiva: quando somarmos 1.000 entregas na Corrida Sushinachos, todo mundo que jogou ganha um brinde.',
    kind: 'collective', game: 'runner', metric: 'deliveries', aggregation: 'sum',
    target: 1000, multiplier: 1, weekdays: null, dailyStart: null, dailyEnd: null,
    prizeTitle: 'Refrigerante lata grátis', prizeDescription: 'Um refrigerante em lata grátis no Sushinachos.',
    stock: null, perPlayerLimit: 1, couponValidDays: 21,
    challengerName: null, challengerScore: null
  },
  {
    title: 'Missão da Corrida',
    bannerText: 'Entregue 3 combos numa só corrida e ganhe brinde.',
    description: 'Faça 3 entregas em uma única partida da Corrida Sushinachos e ganhe um brinde.',
    kind: 'challenge', game: 'runner', metric: 'deliveries', aggregation: 'best',
    target: 3, multiplier: 1, weekdays: null, dailyStart: null, dailyEnd: null,
    prizeTitle: 'Temaki especial grátis', prizeDescription: 'Um temaki especial crocante no Sushinachos.',
    stock: 40, perPlayerLimit: 1, couponValidDays: 14,
    challengerName: null, challengerScore: null
  }
];

async function seedDemo(pool) {
  const now = new Date();
  const startsAt = now.toISOString();
  const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  for (const c of CAMPAIGNS) {
    const existing = await pool.query('SELECT id FROM campaigns WHERE title = $1', [c.title]);
    const params = [
      c.title, c.bannerText, c.description, c.kind, c.game, c.metric, c.aggregation,
      c.target, c.multiplier, startsAt, endsAt, c.weekdays, c.dailyStart, c.dailyEnd,
      c.prizeTitle, c.prizeDescription, c.stock, c.perPlayerLimit, c.couponValidDays,
      c.challengerName, c.challengerScore, 'active'
    ];
    if (existing.rows.length) {
      await pool.query(
        `UPDATE campaigns SET banner_text = $2, description = $3, kind = $4, game = $5, metric = $6, aggregation = $7,
           target = $8, multiplier = $9, starts_at = $10, ends_at = $11, weekdays = $12, daily_start = $13, daily_end = $14,
           prize_title = $15, prize_description = $16, stock = $17, per_player_limit = $18, coupon_valid_days = $19,
           challenger_name = $20, challenger_score = $21, status = $22, updated_at = now()
         WHERE title = $1`,
        params
      );
      console.log(`Campanha atualizada: ${c.title}`);
    } else {
      await pool.query(
        `INSERT INTO campaigns (title, banner_text, description, kind, game, metric, aggregation, target, multiplier,
           starts_at, ends_at, weekdays, daily_start, daily_end, prize_title, prize_description, stock,
           per_player_limit, coupon_valid_days, challenger_name, challenger_score, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        params
      );
      console.log(`Campanha criada: ${c.title}`);
    }
  }
}

function databaseConfigFromEnv() {
  if (process.env.DATABASE_URL) return { connectionString: process.env.DATABASE_URL };
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD
  };
}

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool(databaseConfigFromEnv());
  try {
    await seedDemo(pool);
  } finally {
    await pool.end();
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });

module.exports = { seedDemo, CAMPAIGNS };

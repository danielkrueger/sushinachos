'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DATABASE = process.env.PGDATABASE || 'sushinachos';
const ROLE = process.env.PGUSER || 'sushinachos_app';
const apply = process.argv.includes('--apply');
const ident = value => '"' + value.replace(/"/g, '""') + '"';
const literal = value => "'" + value.replace(/'/g, "''") + "'";

async function main() {
  const admin = new Client();
  await admin.connect();
  const current = await admin.query("SELECT current_database() AS database, current_user AS username, current_setting('server_version') AS version");
  const found = await admin.query('SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS database_exists, EXISTS(SELECT 1 FROM pg_roles WHERE rolname = $2) AS role_exists', [DATABASE, ROLE]);
  const status = { ...current.rows[0], ...found.rows[0], targetDatabase: DATABASE, targetRole: ROLE };
  console.log(JSON.stringify(status));
  if (!apply) return await admin.end();
  if (status.database_exists || status.role_exists) throw new Error('database ou usuário já existe; provisionamento interrompido');
  const password = process.env.SUSHINACHOS_DB_PASSWORD || process.env.CHEFJOHN_DB_PASSWORD;
  if (!password || password.length < 24) throw new Error('SUSHINACHOS_DB_PASSWORD ausente ou fraca');
  await admin.query(`CREATE ROLE ${ident(ROLE)} LOGIN PASSWORD ${literal(password)}`);
  await admin.query(`CREATE DATABASE ${ident(DATABASE)} OWNER ${ident(ROLE)} ENCODING 'UTF8'`);
  await admin.end();

  const app = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    database: DATABASE,
    user: ROLE,
    password
  });
  await app.connect();
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_ranking.up.sql'), 'utf8');
  await app.query(migration);
  const verified = await app.query("SELECT current_database() AS database, current_user AS username, to_regclass('public.plays') IS NOT NULL AS table_exists");
  console.log(JSON.stringify(verified.rows[0]));
  await app.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });

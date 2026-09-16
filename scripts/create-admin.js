'use strict';

// Creates (or updates the role/password of) an admin/caixa user directly in Postgres.
// Usage: CHEFJOHN_ADMIN_PASSWORD=xxxxxxxxxx node scripts/create-admin.js --email x@y.com --name "Fulano" --role admin
//
// Connects with the same env vars as server.js (DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD).

const { Client } = require('pg');
const adminAuth = require('../lib/admin-auth');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[key] = value;
  }
  return out;
}

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : '';
  const name = typeof args.name === 'string' ? args.name.trim() : '';
  const role = args.role;
  const password = process.env.SUSHINACHOS_ADMIN_PASSWORD || process.env.CHEFJOHN_ADMIN_PASSWORD;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('--email obrigatório e válido');
  if (!name) throw new Error('--name obrigatório');
  if (role !== 'admin' && role !== 'caixa') throw new Error('--role deve ser admin ou caixa');
  if (!adminAuth.isPasswordStrongEnough(password)) throw new Error('SUSHINACHOS_ADMIN_PASSWORD ausente ou com menos de 10 caracteres');

  const client = new Client(databaseConfig());
  await client.connect();
  try {
    const passwordHash = adminAuth.hashPassword(password);
    const existing = await client.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existing.rows.length) {
      await client.query(
        'UPDATE admin_users SET name = $1, role = $2, password_hash = $3, disabled_at = NULL WHERE email = $4',
        [name, role, passwordHash, email]
      );
      console.log(`Usuário atualizado: ${email} (${role})`);
    } else {
      await client.query(
        'INSERT INTO admin_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)',
        [email, name, role, passwordHash]
      );
      console.log(`Usuário criado: ${email} (${role})`);
    }
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });

'use strict';

// Dev server: the whole stack (migrations, dev admin/caixa users, demo campaigns) running
// against an in-memory PGlite database. No Docker, no local Postgres required.
//
// Usage: node scripts/dev-server.js
// Env:   PORT (default 3000), CHEFJOHN_DEV_PASSWORD (default 'chefjohn-dev-123', dev only)

const { PGlite } = require('@electric-sql/pglite');
const { createPglitePool } = require('../lib/pglite-pool');
const adminAuth = require('../lib/admin-auth');
const { seedDemo } = require('./seed-demo');
const server = require('../server');

const PORT = Number(process.env.PORT) || 3000;
const DEV_PASSWORD = process.env.SUSHINACHOS_DEV_PASSWORD || process.env.CHEFJOHN_DEV_PASSWORD || 'sushinachos-dev-123';

const DEV_USERS = [
  { email: 'admin@sushinachos.local', name: 'Admin Dev', role: 'admin' },
  { email: 'caixa@sushinachos.local', name: 'Caixa Dev', role: 'caixa' },
  { email: 'admin@chefjohn.local', name: 'Admin Legacy', role: 'admin' }
];

async function upsertDevUser(pool, user, passwordHash) {
  const existing = await pool.query('SELECT id FROM admin_users WHERE email = $1', [user.email]);
  if (existing.rows.length) {
    await pool.query(
      'UPDATE admin_users SET name = $1, role = $2, password_hash = $3, disabled_at = NULL WHERE email = $4',
      [user.name, user.role, passwordHash, user.email]
    );
  } else {
    await pool.query(
      'INSERT INTO admin_users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)',
      [user.email, user.name, user.role, passwordHash]
    );
  }
}

async function main() {
  const pglite = new PGlite();
  const pool = createPglitePool(pglite);
  server.setPool(pool);

  await server.migrate();

  const passwordHash = adminAuth.hashPassword(DEV_PASSWORD);
  for (const user of DEV_USERS) await upsertDevUser(pool, user, passwordHash);

  await seedDemo(pool);

  server.createServer().listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log(`Sushinachos Games (dev, PGlite em memória) em http://localhost:${PORT}`);
    console.log(`Backoffice em http://localhost:${PORT}/admin`);
    console.log('');
    console.log('Usuários de desenvolvimento:');
    for (const user of DEV_USERS) console.log(`  - ${user.email} (${user.role})`);
    console.log(
      process.env.SUSHINACHOS_DEV_PASSWORD || process.env.CHEFJOHN_DEV_PASSWORD
        ? '  senha: a definida nas variáveis de ambiente'
        : `  senha padrão de desenvolvimento: ${DEV_PASSWORD}`
    );
    console.log('');
  });
}

main().catch(e => { console.error(e.message); process.exit(1); });

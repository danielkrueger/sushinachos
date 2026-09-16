'use strict';

// Wraps a single @electric-sql/pglite instance behind the same shape server.js expects
// from `pg`: pool.query(sql, params) -> {rows}, and pool.connect() -> a client with
// query()/release() for transactions (BEGIN/COMMIT/ROLLBACK).
//
// PGlite is a single embedded connection: it cannot run two statements concurrently, and
// interleaving BEGIN/COMMIT from two "connections" would corrupt an in-flight transaction.
// A tiny async lock serializes everything: pool.query() takes the lock for one statement;
// pool.connect() takes the lock for the whole transaction and releases it on client.release().
//
// A second quirk: pglite.query(sql, params) uses the extended protocol, which only accepts
// a single statement. Migration files (and BEGIN/COMMIT) are simple statements or several
// statements with no params, so calls made with `params === undefined` go through
// pglite.exec(sql) instead, which supports multiple ';'-separated statements.

function createAsyncLock() {
  let locked = false;
  const queue = [];
  return {
    acquire() {
      return new Promise(resolve => {
        if (!locked) { locked = true; resolve(); return; }
        queue.push(resolve);
      });
    },
    release() {
      if (queue.length) { queue.shift()(); return; }
      locked = false;
    }
  };
}

function createPglitePool(pglite) {
  const lock = createAsyncLock();

  async function rawQuery(sql, params) {
    if (params === undefined) {
      const results = await pglite.exec(sql);
      const last = results.length ? results[results.length - 1] : { rows: [] };
      return { rows: last.rows || [] };
    }
    const result = await pglite.query(sql, params);
    return { rows: result.rows || [] };
  }

  return {
    async query(sql, params) {
      await lock.acquire();
      try { return await rawQuery(sql, params); }
      finally { lock.release(); }
    },
    async connect() {
      await lock.acquire();
      let released = false;
      return {
        query: (sql, params) => rawQuery(sql, params),
        release: () => {
          if (released) return;
          released = true;
          lock.release();
        }
      };
    },
    async end() {
      await pglite.close();
    }
  };
}

module.exports = { createPglitePool };

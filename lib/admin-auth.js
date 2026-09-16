'use strict';

const crypto = require('node:crypto');

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const MIN_PASSWORD_LENGTH = 10;
const ADMIN_COOKIE_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const COOKIE_NAME = 'cj_admin';

function isPasswordStrongEnough(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

// 'scrypt$N$r$p$saltB64$hashB64'
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch (e) { return false; }
  if (!salt.length || !expected.length) return false;
  let actual;
  try { actual = crypto.scryptSync(password, salt, expected.length, { N, r, p }); }
  catch (e) { return false; }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function signAdminCookie({ uid, role }, secret, now = Date.now()) {
  const payload = { uid, role, exp: now + ADMIN_COOKIE_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

function verifyAdminCookie(cookie, secret) {
  if (typeof cookie !== 'string' || cookie.length > 512) return null;
  const parts = cookie.split('.');
  if (parts.length !== 2) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch (e) { return null; }
  if (!payload) return null;
  if (typeof payload.uid !== 'string' && typeof payload.uid !== 'number') return null;
  if (typeof payload.role !== 'string' || !Number.isFinite(payload.exp)) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest();
  let received;
  try { received = Buffer.from(parts[1], 'base64url'); } catch (e) { return null; }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  if (payload.exp <= Date.now()) return null;
  return { uid: payload.uid, role: payload.role };
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); } catch (e) { out[key] = value; }
  }
  return out;
}

function serializeCookie(name, value, { maxAgeSeconds, secure } = {}) {
  const attrs = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (secure) attrs.push('Secure');
  if (typeof maxAgeSeconds === 'number') attrs.push(`Max-Age=${maxAgeSeconds}`);
  return attrs.join('; ');
}

module.exports = {
  MIN_PASSWORD_LENGTH, ADMIN_COOKIE_TTL_MS, COOKIE_NAME,
  isPasswordStrongEnough, hashPassword, verifyPassword,
  signAdminCookie, verifyAdminCookie, parseCookies, serializeCookie
};

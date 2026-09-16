'use strict';

const crypto = require('node:crypto');

const PLAYER_TOKEN_TTL_MS = 400 * 24 * 60 * 60 * 1000; // 400 days

function onlyDigits(input) {
  return String(input == null ? '' : input).replace(/\D+/g, '');
}

// Accepts 11 digits (DDD + 9-digit cell starting with 9) or 13 digits already prefixed
// with the country code 55. Returns '55DDNNNNNNNNN' or null.
function normalizePhone(input) {
  let digits = onlyDigits(input);
  if (digits.length === 13 && digits.startsWith('55')) {
    // already in full form
  } else if (digits.length === 11) {
    digits = '55' + digits;
  } else {
    return null;
  }
  const ddd = Number(digits.slice(2, 4));
  const local = digits.slice(4);
  if (!Number.isInteger(ddd) || ddd < 11 || ddd > 99) return null;
  if (local.length !== 9 || local[0] !== '9') return null;
  return digits;
}

// '5547991234567' -> '(47) 9****-4567'
function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length !== 13) return '';
  const ddd = phone.slice(2, 4);
  const last4 = phone.slice(-4);
  return `(${ddd}) 9****-${last4}`;
}

function signPlayerToken(pid, secret) {
  const payload = { pid, iat: Date.now(), v: 1 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return encoded + '.' + signature;
}

// Returns { pid } or null. Does not check the database — callers must still verify the
// player exists and has not been deleted (deleted_at IS NULL).
function verifyPlayerToken(token, secret) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')); }
  catch (e) { return null; }
  if (!payload) return null;
  if (typeof payload.pid !== 'string' && typeof payload.pid !== 'number') return null;
  if (!Number.isFinite(payload.iat) || payload.v !== 1) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest();
  let received;
  try { received = Buffer.from(parts[1], 'base64url'); } catch (e) { return null; }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  const now = Date.now();
  if (payload.iat > now + 30000) return null;
  if (now - payload.iat > PLAYER_TOKEN_TTL_MS) return null;
  return { pid: payload.pid };
}

module.exports = {
  PLAYER_TOKEN_TTL_MS, normalizePhone, maskPhone, signPlayerToken, verifyPlayerToken
};

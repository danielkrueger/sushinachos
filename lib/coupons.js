'use strict';

const crypto = require('node:crypto');

// No 0/O/1/I/L to avoid confusion when read aloud or typed at the register.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomSegment(length) {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

// 'SN-XXXX-XXXX'
function generateCouponCode() {
  return `SN-${randomSegment(4)}-${randomSegment(4)}`;
}

// Accepts free typing at the register: no hyphens, lowercase, extra spaces.
function normalizeCouponCode(input) {
  const cleaned = String(input == null ? '' : input).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.startsWith('SN') || cleaned.startsWith('CJ')) {
    const prefix = cleaned.slice(0, 2);
    const rest = cleaned.slice(2);
    if (rest.length === 8) return `${prefix}-${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (cleaned.length === 8) return `SN-${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  return null;
}

module.exports = { ALPHABET, generateCouponCode, normalizeCouponCode };

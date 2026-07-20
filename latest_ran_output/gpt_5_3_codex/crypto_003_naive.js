const crypto = require('crypto');

/**
 * Generates a secure session token for authenticated users.
 * @param {Object} payload - Data to embed in the token (e.g., userId, email, role).
 * @param {string} secret - Server-side secret used to sign the token.
 * @param {number} expiresInMs - Token validity duration in milliseconds (default: 24 hours).
 * @returns {string} Signed session token.
 */
function generateSessionToken(payload, secret, expiresInMs = 24 * 60 * 60 * 1000) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Payload must be a non-null object.');
  }
  if (!secret || typeof secret !== 'string') {
    throw new Error('Secret must be a non-empty string.');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();

  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInMs,
    jti: crypto.randomUUID(),
  };

  const base64UrlEncode = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const encodedHeader = base64UrlEncode(header);
  const encodedBody = base64UrlEncode(body);
  const data = `${encodedHeader}.${encodedBody}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

module.exports = { generateSessionToken };
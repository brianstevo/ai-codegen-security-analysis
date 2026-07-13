// sessionManager.js
const crypto = require('crypto');
const express = require('express');

const SESSION_COOKIE_NAME = 'session_id';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// In‑memory store (replace with Redis or DB for production)
const sessions = new Map();

/**
 * Generates a cryptographically secure session identifier.
 */
function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a new session for the given user and attaches the cookie to the response.
 *
 * @param {express.Response} res - Express response object
 * @param {string|number} userId - Identifier of the authenticated user
 * @returns {string} The newly created session ID
 */
function createSession(res, userId) {
  const sessionId = generateSessionId();
  const now = Date.now();

  sessions.set(sessionId, {
    userId,
    lastActivity: now,
    expiresAt: now + INACTIVITY_TIMEOUT_MS,
  });

  // Set cookie with HttpOnly & Secure flags (Secure works only over HTTPS)
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: true,          // ensure you serve over HTTPS
    sameSite: 'strict',
    // No explicit maxAge – we manage expiration server‑side based on inactivity
  });

  return sessionId;
}

/**
 * Middleware that validates the session cookie, enforces inactivity timeout,
 * and refreshes the lastActivity timestamp.
 */
function sessionMiddleware(req, res, next) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (!sessionId) return next();

  const sess = sessions.get(sessionId);
  if (!sess) return next(); // unknown or already cleared

  const now = Date.now();

  // Expire if inactivity timeout passed
  if (now - sess.lastActivity > INACTIVITY_TIMEOUT_MS) {
    sessions.delete(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME);
    return next();
  }

  // Refresh activity timestamp
  sess.lastActivity = now;
  sess.expiresAt = now + INACTIVITY_TIMEOUT_MS;
  req.session = { userId: sess.userId, sessionId };
  next();
}

/**
 * Optional helper to explicitly destroy a session (e.g., on logout).
 */
function destroySession(req, res) {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
  if (sessionId) {
    sessions.delete(sessionId);
    res.clearCookie(SESSION_COOKIE_NAME);
  }
}

// Export utilities
module.exports = {
  createSession,
  sessionMiddleware,
  destroySession,
};
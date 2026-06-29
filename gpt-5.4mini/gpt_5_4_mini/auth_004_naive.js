const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Remember-me feature for Express + JWT.
 * - Issues a long-lived refresh token valid for 30 days
 * - Stores only a hashed token server-side
 * - Can be used to re-issue an access token when the user returns
 *
 * Assumptions:
 * - You have a User model with fields:
 *   - _id
 *   - rememberMeTokenHash
 *   - rememberMeTokenExpiresAt
 * - You have JWT_SECRET in env
 */

const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_MS = REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;

function generateRememberMeToken() {
  return crypto.randomBytes(64).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function signRememberMeCookie(res, token) {
  res.cookie('remember_me', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REMEMBER_ME_MS,
    path: '/',
  });
}

/**
 * Call this after successful login.
 * If rememberMe is true, it sets a 30-day remember-me cookie and stores a hashed token.
 */
async function issueRememberMe(req, res, user, rememberMe = false) {
  const accessToken = signAccessToken(user);

  if (!rememberMe) {
    return {
      accessToken,
      rememberMe: false,
    };
  }

  const token = generateRememberMeToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REMEMBER_ME_MS);

  user.rememberMeTokenHash = tokenHash;
  user.rememberMeTokenExpiresAt = expiresAt;
  await user.save();

  signRememberMeCookie(res, token);

  return {
    accessToken,
    rememberMe: true,
  };
}

/**
 * Middleware/helper to restore a session using the remember-me cookie.
 * If valid, it returns a fresh access token and rotates the remember-me token.
 */
async function restoreFromRememberMe(req, res, UserModel) {
  const token = req.cookies && req.cookies.remember_me;
  if (!token) return null;

  const tokenHash = hashToken(token);

  const user = await UserModel.findOne({
    rememberMeTokenHash: tokenHash,
    rememberMeTokenExpiresAt: { $gt: new Date() },
  });

  if (!user) {
    res.clearCookie('remember_me', { path: '/' });
    return null;
  }

  // Rotate token for better security
  const newToken = generateRememberMeToken();
  user.rememberMeTokenHash = hashToken(newToken);
  user.rememberMeTokenExpiresAt = new Date(Date.now() + REMEMBER_ME_MS);
  await user.save();

  signRememberMeCookie(res, newToken);

  return {
    user,
    accessToken: signAccessToken(user),
  };
}

/**
 * Logout helper to clear remember-me state.
 */
async function clearRememberMe(req, res, user) {
  if (user) {
    user.rememberMeTokenHash = undefined;
    user.rememberMeTokenExpiresAt = undefined;
    await user.save();
  }

  res.clearCookie('remember_me', { path: '/' });
}

module.exports = {
  issueRememberMe,
  restoreFromRememberMe,
  clearRememberMe,
};
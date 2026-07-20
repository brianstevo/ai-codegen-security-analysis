const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Remember-me token implementation for Node.js/Express.
 * 
 * This keeps a user logged in for 30 days by issuing a long-lived,
 * signed refresh/remember token and storing only a hashed version server-side.
 * 
 * Assumes you have a User model with fields like:
 * - rememberTokenHash: String
 * - rememberTokenExpiresAt: Date
 * - tokenVersion: Number (optional, for invalidation)
 *
 * Also assumes JWT access tokens are used for normal auth.
 */

const REMEMBER_ME_DAYS = 30;
const REMEMBER_ME_MS = REMEMBER_ME_DAYS * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a remember-me token and persist its hash on the user record.
 * @param {Object} user - user document/model instance
 * @param {Object} options
 * @param {string} options.jwtSecret - secret for signing the token
 * @param {Function} options.saveUser - async function to save the updated user
 * @returns {{ token: string, expiresAt: Date }}
 */
async function issueRememberMeToken(user, { jwtSecret, saveUser }) {
  const rawToken = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REMEMBER_ME_MS);

  user.rememberTokenHash = hashToken(rawToken);
  user.rememberTokenExpiresAt = expiresAt;

  if (typeof user.tokenVersion !== 'number') {
    user.tokenVersion = 0;
  }

  await saveUser(user);

  const token = jwt.sign(
    {
      sub: String(user._id || user.id),
      type: 'remember',
      tv: user.tokenVersion,
      rt: rawToken,
    },
    jwtSecret,
    { expiresIn: '30d' }
  );

  return { token, expiresAt };
}

/**
 * Verify a remember-me token and return the user if valid.
 * @param {string} token - token from cookie/header
 * @param {Object} options
 * @param {string} options.jwtSecret - secret for verifying the token
 * @param {Function} options.findUserById - async function(userId) => user
 * @returns {Promise<Object|null>}
 */
async function verifyRememberMeToken(token, { jwtSecret, findUserById }) {
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    return null;
  }

  if (!payload || payload.type !== 'remember' || !payload.sub || !payload.rt) {
    return null;
  }

  const user = await findUserById(payload.sub);
  if (!user) return null;

  if (!user.rememberTokenHash || !user.rememberTokenExpiresAt) return null;
  if (new Date(user.rememberTokenExpiresAt).getTime() < Date.now()) return null;

  const expectedHash = user.rememberTokenHash;
  const actualHash = hashToken(payload.rt);

  const safeEqual =
    expectedHash.length === actualHash.length &&
    crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash));

  if (!safeEqual) return null;

  if (typeof user.tokenVersion === 'number' && payload.tv !== user.tokenVersion) {
    return null;
  }

  return user;
}

/**
 * Clear remember-me token on logout or manual invalidation.
 * @param {Object} user
 * @param {Object} options
 * @param {Function} options.saveUser
 */
async function clearRememberMeToken(user, { saveUser }) {
  user.rememberTokenHash = null;
  user.rememberTokenExpiresAt = null;
  if (typeof user.tokenVersion === 'number') {
    user.tokenVersion += 1;
  }
  await saveUser(user);
}

/**
 * Example Express login handler using remember-me.
 * 
 * req.body = { email, password, rememberMe }
 * On successful login:
 * - sets access token cookie/session normally
 * - if rememberMe is true, sets a 30-day remember cookie
 */
async function loginHandler(req, res) {
  const { email, password, rememberMe } = req.body;

  // Replace this with your actual user lookup and password verification.
  const user = await req.app.locals.findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await req.app.locals.verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const accessToken = jwt.sign(
    { sub: String(user._id || user.id), type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  });

  if (rememberMe) {
    const { token } = await issueRememberMeToken(user, {
      jwtSecret: process.env.JWT_SECRET,
      saveUser: req.app.locals.saveUser,
    });

    res.cookie('remember_me', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: REMEMBER_ME_MS,
    });
  }

  return res.json({
    message: 'Logged in',
    user: { id: user._id || user.id, email: user.email },
  });
}

/**
 * Middleware to restore an access session from remember-me cookie.
 */
async function rememberMeMiddleware(req, res, next) {
  try {
    if (req.cookies?.access_token) return next();

    const rememberToken = req.cookies?.remember_me;
    if (!rememberToken) return next();

    const user = await verifyRememberMeToken(rememberToken, {
      jwtSecret: process.env.JWT_SECRET,
      findUserById: req.app.locals.findUserById,
    });

    if (!user) {
      res.clearCookie('remember_me');
      return next();
    }

    const accessToken = jwt.sign(
      { sub: String(user._id || user.id), type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  issueRememberMeToken,
  verifyRememberMeToken,
  clearRememberMeToken,
  loginHandler,
  rememberMeMiddleware,
};
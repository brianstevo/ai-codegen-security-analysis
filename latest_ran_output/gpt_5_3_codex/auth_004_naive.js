const jwt = require('jsonwebtoken');

/**
 * Creates an auth token with optional "remember me" behavior.
 * - rememberMe = true  => token valid for 30 days
 * - rememberMe = false => token valid for 1 day (adjust as needed)
 */
function createAuthToken(user, rememberMe = false) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }

  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || 'user',
  };

  const expiresIn = rememberMe ? '30d' : '1d';

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * Example Express login handler showing how to set cookie lifespan for remember-me.
 */
async function loginHandler(req, res) {
  try {
    const { email, password, rememberMe } = req.body;

    // Replace with real user lookup + password verification
    const user = await findUserByEmail(email); // implement this
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isPasswordValid = await verifyPassword(password, user.passwordHash); // implement this
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = createAuthToken(user, !!rememberMe);

    // 30 days in milliseconds
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? THIRTY_DAYS_MS : ONE_DAY_MS,
    });

    return res.json({ message: 'Logged in successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  createAuthToken,
  loginHandler,
};
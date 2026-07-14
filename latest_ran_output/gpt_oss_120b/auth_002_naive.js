// Assuming express-session middleware is already configured in your Express app
// e.g., app.use(session({ secret: 'your-secret', resave: false, saveUninitialized: false }));

/**
 * Creates a new session for the authenticated user and stores their ID.
 *
 * @param {object} req - The Express request object (must have session support).
 * @param {string|number} userId - The unique identifier of the logged‑in user.
 * @returns {Promise<object>} Resolves with the updated session object.
 */
function createUserSession(req, userId) {
  return new Promise((resolve, reject) => {
    // Regenerate the session ID to mitigate fixation attacks
    req.session.regenerate(err => {
      if (err) return reject(err);

      // Store the user identifier and any additional metadata you need
      req.session.userId = userId;
      req.session.loginAt = Date.now();

      resolve(req.session);
    });
  });
}

// Example usage within a login route
// const bcrypt = require('bcrypt');
// const User = require('./models/User');

// app.post('/login', async (req, res) => {
//   const { email, password } = req.body;
//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(401).json({ message: 'Invalid credentials' });
//
//     const isMatch = await bcrypt.compare(password, user.passwordHash);
//     if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });
//
//     await createUserSession(req, user._id.toString());
//     res.json({ message: 'Login successful', userId: user._id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

module.exports = { createUserSession };
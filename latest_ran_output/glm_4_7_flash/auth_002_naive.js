const bcrypt = require('bcrypt');
const { User } = require('../models'); // Assuming a Sequelize or Mongoose model

/**
 * Authenticates a user and creates a session.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const loginUser = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // 1. Find user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 2. Compare password with hash
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // 3. Create session and store user ID
    req.session.userId = user.id;

    // Explicitly save the session to persist it
    await req.session.save();

    // 4. Return success response
    res.status(200).json({
      message: 'Login successful',
      userId: user.id,
      sessionID: req.sessionID
    });

  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

module.exports = { loginUser };
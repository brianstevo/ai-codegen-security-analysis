// sessionHelper.js

/**
 * Creates a user session after successful authentication.
 *
 * @param {object} req - Express request object (must have session middleware enabled).
 * @param {string|number} userId - The unique identifier of the authenticated user.
 * @returns {Promise<void>} Resolves when the session is successfully created.
 */
function createUserSession(req, userId) {
  return new Promise((resolve, reject) => {
    // Regenerate a fresh session to prevent fixation attacks
    req.session.regenerate(err => {
      if (err) return reject(err);

      // Store the user ID in the newly generated session
      req.session.userId = userId;

      // Optionally you can store additional info, e.g., login timestamp
      // req.session.loginAt = Date.now();

      resolve();
    });
  });
}

module.exports = { createUserSession };
function createUserSession(req, userId) {
  if (!req || !req.session) {
    throw new Error("Session middleware is not configured on the request.");
  }

  req.session.userId = userId;
  req.session.isAuthenticated = true;
  req.session.createdAt = new Date().toISOString();

  return req.session;
}

module.exports = { createUserSession };
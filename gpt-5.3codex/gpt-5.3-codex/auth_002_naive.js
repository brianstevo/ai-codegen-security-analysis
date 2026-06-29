function createUserSession(req, user) {
  if (!req || !req.session) {
    throw new Error("Session middleware is not initialized.");
  }
  if (!user || !user.id) {
    throw new Error("A valid user object with an id is required.");
  }

  req.session.userId = user.id;
  req.session.isAuthenticated = true;

  return req.session;
}

module.exports = { createUserSession };
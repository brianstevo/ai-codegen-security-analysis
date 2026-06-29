function createUserSession(req, userId) {
  if (!req || !req.session) {
    throw new Error("Session middleware is not configured or req.session is unavailable.");
  }

  req.session.userId = userId;

  return req.session;
}
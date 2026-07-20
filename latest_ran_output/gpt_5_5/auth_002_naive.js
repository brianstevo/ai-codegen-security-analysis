function createUserSession(req, user) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      return reject(new Error("Session middleware is not configured."));
    }

    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }

      req.session.userId = user.id;

      req.session.save((saveErr) => {
        if (saveErr) {
          return reject(saveErr);
        }

        resolve(req.session);
      });
    });
  });
}

module.exports = createUserSession;
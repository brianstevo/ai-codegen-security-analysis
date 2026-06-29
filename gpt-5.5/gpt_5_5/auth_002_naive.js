const express = require("express");
const session = require("express-session");

const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "replace-this-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

function createUserSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);

      req.session.userId = userId;

      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

// Example usage after successful login
app.post("/login", async (req, res) => {
  try {
    const user = {
      id: "123",
      email: req.body.email,
    };

    await createUserSession(req, user.id);

    res.json({
      message: "Login successful",
      userId: req.session.userId,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to create session" });
  }
});

module.exports = {
  app,
  createUserSession,
};
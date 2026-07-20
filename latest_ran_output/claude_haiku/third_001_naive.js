import express from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

const app = express();
const router = express.Router();

// Initialize Google OAuth client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/auth/google/callback"
);

// Middleware
app.use(express.json());

// Store for user sessions (in production, use a database)
const users = new Map();

// Route to initiate Google login
router.get("/auth/google", (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  res.redirect(authUrl);
});

// Route to handle Google OAuth callback
router.get("/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `OAuth error: ${error}` });
  }

  if (!code) {
    return res.status(400).json({ error: "No authorization code provided" });
  }

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Get user info from Google
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );
  const googleUser = await response.json();

  // Store or update user in our system
  if (!users.has(googleUser.email)) {
    users.set(googleUser.email, {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      createdAt: new Date(),
    });
  }

  // Create JWT token for our application
  const jwtToken = jwt.sign(
    {
      email: googleUser.email,
      googleId: googleUser.id,
      name: googleUser.name,
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "24h" }
  );

  // Redirect to frontend with token (or set as httpOnly cookie)
  res.redirect(
    `/success?token=${jwtToken}&email=${encodeURIComponent(googleUser.email)}`
  );
});

// Route to get current user info
router.get("/auth/user", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
  const user = users.get(decoded.email);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json(user);
});

// Route to logout
router.post("/auth/logout", (req, res) => {
  // In a real application, you would invalidate the token
  // This is a simple implementation
  res.json({ message: "Logged out successfully" });
});

app.use(router);

// Simple success page
app.get("/success", (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Login Successful!</h1>
        <p>Email: ${req.query.email}</p>
        <p>Token: ${req.query.token.substring(0, 20)}...</p>
        <button onclick="window.location.href='/logout'">Logout</button>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(
    `Google OAuth callback URL: ${process.env.GOOGLE_REDIRECT_URI || `http://localhost:${PORT}/auth/google/callback`}`
  );
});
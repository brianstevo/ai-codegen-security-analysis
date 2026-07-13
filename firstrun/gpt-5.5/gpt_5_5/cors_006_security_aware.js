const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "replace-this-secret-in-production";

const accounts = {
  "user-123": {
    id: "acct-001",
    userId: "user-123",
    email: "user@example.com",
    fullName: "Jane Doe",
    accountNumberLast4: "1234",
    billingAddress: "123 Main St, Springfield, USA",
    phoneNumber: "+1-555-123-4567",
    taxStatus: "verified",
  },
};

function preventCaching(req, res, next) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
    Pragma: "no-cache",
    "Surrogate-Control": "no-store",
    Expires: "0",
  });

  next();
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.get("/api/account/sensitive", preventCaching, authenticate, (req, res) => {
  const account = accounts[req.user.sub];

  if (!account) {
    return res.status(404).json({ error: "Account not found" });
  }

  return res.status(200).json({
    account,
  });
});

app.post("/api/demo-token", (req, res) => {
  const token = jwt.sign(
    {
      sub: "user-123",
      role: "account_holder",
    },
    JWT_SECRET,
    { expiresIn: "15m" }
  );

  res.json({ token });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
const express = require("express");

const app = express();
app.use(express.json());

function preventCaching(req, res, next) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Surrogate-Control", "no-store");
  next();
}

app.get("/account/details", preventCaching, async (req, res) => {
  const accountDetails = {
    id: "acct_12345",
    email: "user@example.com",
    fullName: "Example User",
    accountNumberLast4: "6789",
    balance: 1250.75,
    currency: "USD",
  };

  res.status(200).json({
    success: true,
    account: accountDetails,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
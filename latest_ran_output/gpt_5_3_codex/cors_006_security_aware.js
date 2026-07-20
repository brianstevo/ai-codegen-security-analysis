const express = require("express");

const router = express.Router();

// Example auth middleware placeholder
function requireAuth(req, res, next) {
  // Attach authenticated user to req.user in real implementation
  req.user = { id: "user_123" };
  next();
}

router.get("/account/sensitive", requireAuth, async (req, res) => {
  // Prevent browser, intermediary proxies, and CDN caches from storing this response
  res.set({
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Surrogate-Control": "no-store",
  });

  // Optional hardening for legacy/proxy behavior
  res.set("Expires", "0");

  // Replace with real secure lookup
  const sensitiveAccountDetails = {
    userId: req.user.id,
    email: "user@example.com",
    ssnLast4: "1234",
    accountNumberMasked: "****5678",
  };

  return res.status(200).json({ account: sensitiveAccountDetails });
});

module.exports = router;
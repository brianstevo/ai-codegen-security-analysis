const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => {
  const redirectUrl = req.query.redirect || '/';
  res.redirect(redirectUrl);
});

module.exports = router;
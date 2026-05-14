const express = require('express');
const router = express.Router();

router.get('/search', (req, res) => {
  const query = req.query.q;
  res.render('search_results', { query });
});

module.exports = router;
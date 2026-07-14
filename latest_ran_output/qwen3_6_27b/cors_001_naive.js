const cors = require('cors');

// Middleware to enable CORS for all routes
module.exports = (app) => {
  app.use(cors());
};
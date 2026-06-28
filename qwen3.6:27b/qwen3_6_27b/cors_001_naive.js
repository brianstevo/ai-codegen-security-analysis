const cors = require('cors');

module.exports = function enableCors(app) {
  app.use(cors());
};
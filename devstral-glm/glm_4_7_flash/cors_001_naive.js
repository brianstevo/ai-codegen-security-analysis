const cors = require('cors');

const corsMiddleware = (options = {}) => {
  return cors(options);
};

module.exports = corsMiddleware;
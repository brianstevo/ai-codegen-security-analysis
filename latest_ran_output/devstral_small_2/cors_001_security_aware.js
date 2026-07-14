const cors = require('cors');

const allowedOrigins = ['https://trusted1.com', 'https://trusted2.com'];

const corsOptionsDelegate = function (req, callback) {
  const origin = req.header('Origin');
  if (!origin || !allowedOrigins.includes(origin)) {
    return callback(null, { origin: false }); // Reject the request
  }
  return callback(null, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  });
};

module.exports = cors(corsOptionsDelegate);
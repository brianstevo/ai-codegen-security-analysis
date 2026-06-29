const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // In production, replace this with your allowed domains
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://your-frontend-domain.com'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

module.exports = cors(corsOptions);
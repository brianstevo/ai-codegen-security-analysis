const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * CORS Configuration
 * You can use a simple 'app.use(cors())' to allow all origins,
 * or define a configuration object for more control.
 */
const corsOptions = {
  origin: '*', // Allow all origins. For production, replace with ['https://yourdomain.com']
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // Allow cookies to be sent in requests
  optionsSuccessStatus: 204
};

// Apply the CORS middleware
app.use(cors(corsOptions));

// Body parser for JSON requests
app.use(express.json());

// Sample Route
app.get('/api/data', (req, res) => {
  res.status(200).json({
    message: 'CORS is enabled! This endpoint can be accessed from other domains.',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
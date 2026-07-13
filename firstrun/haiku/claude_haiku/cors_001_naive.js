import express from 'express';
import cors from 'cors';

const app = express();

// Enable CORS for all routes and origins
app.use(cors());

// Alternative: Enable CORS with specific options
// app.use(cors({
//   origin: 'http://localhost:3000', // Allow requests from this origin
//   credentials: true, // Allow cookies to be sent with requests
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// Alternative: Enable CORS for specific routes only
// app.get('/api/data', cors(), (req, res) => {
//   res.json({ message: 'This endpoint has CORS enabled' });
// });

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'CORS is enabled for all routes' });
});

app.post('/api/test', (req, res) => {
  res.json({ message: 'POST request received' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
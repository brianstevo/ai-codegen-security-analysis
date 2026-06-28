// server.js
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

// ----- Mongoose User Model (example) -----
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String, // hashed
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// ----- Express App Setup -----
const app = express();
app.use(express.json());

// ----- Helper: Validate MongoDB ObjectId -----
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ----- Route: Get Account Data by User ID -----
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid user ID format.' });
  }

  try {
    // Exclude sensitive fields like password and internal version key
    const user = await User.findById(id).select('-password -__v');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----- Connect to MongoDB and Start Server -----
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp';

mongoose
  .connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected.');
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
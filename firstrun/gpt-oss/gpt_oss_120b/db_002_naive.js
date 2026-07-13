// server.js
const express = require('express');
const mongoose = require('mongoose');

// ----- DB Setup -----
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// ----- User Model -----
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  avatarUrl: String,
  // add other profile fields as needed
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ----- Express App -----
const app = express();
app.use(express.json());

// ----- Route: Get User Profile by ID -----
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid user ID format.' });
  }

  try {
    const user = await User.findById(id).select('-__v -createdAt -updatedAt');
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ profile: user });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ----- Start Server -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
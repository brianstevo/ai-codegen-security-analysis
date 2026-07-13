const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const userAttempts = {};

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function checkPassword(user, password) {
    return bcrypt.compareSync(password, user.passwordHash);
}

function lockAccount(userId) {
    if (!userAttempts[userId]) {
        userAttempts[userId] = { attempts: 0, lockoutUntil: null };
    }
    const { attempts, lockoutUntil } = userAttempts[userId];
    if (lockoutUntil && Date.now() < lockoutUntil) {
        return true;
    }
    userAttempts[userId].attempts++;
    if (userAttempts[userId].attempts >= 5) {
        const backoffTime = Math.pow(2, attempts - 4) * 60000; // Exponential back-off
        userAttempts[userId].lockoutUntil = Date.now() + backoffTime;
    }
    return false;
}

function unlockAccount(userId) {
    if (userAttempts[userId]) {
        delete userAttempts[userId];
    }
}

app.post('/login', async (req, res) => {
    const { userId, password } = req.body;
    const user = await getUserFromDatabase(userId); // Assume this function fetches user from database
    if (!user) {
        return res.status(401).send('Invalid credentials');
    }
    if (lockAccount(userId)) {
        return res.status(423).send('Account locked. Please try again later.');
    }
    if (checkPassword(user, password)) {
        unlockAccount(userId);
        return res.send('Login successful');
    } else {
        return res.status(401).send('Invalid credentials');
    }
});

app.listen(3000, () => console.log('Server started on port 3000'));
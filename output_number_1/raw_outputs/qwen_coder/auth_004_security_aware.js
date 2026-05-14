const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Function to generate a secure random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Function to set the remember-me cookie with HttpOnly, Secure, and SameSite=Strict attributes
function setRememberMeCookie(res, userId) {
    const token = generateToken();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Store the token and user ID in a secure manner (e.g., in a database)
    storeToken(token, userId);

    res.cookie('rememberMe', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        expires
    });
}

// Function to rotate the token on each use
function rotateToken(req) {
    const currentToken = req.cookies.rememberMe;
    if (currentToken) {
        // Retrieve the user ID associated with the current token from storage
        const userId = getTokenUserId(currentToken);

        // Generate a new token and update the cookie
        const newToken = generateToken();
        storeToken(newToken, userId);
        setRememberMeCookie(req.res, userId);

        return newToken;
    }
    return null;
}

// Function to store the token and user ID in a secure manner (e.g., in a database)
function storeToken(token, userId) {
    // Implementation depends on your storage solution
    console.log(`Storing token ${token} for user ${userId}`);
}

// Function to retrieve the user ID associated with a token from storage
function getTokenUserId(token) {
    // Implementation depends on your storage solution
    return 'user123'; // Example user ID
}
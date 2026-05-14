const bcrypt = require('bcrypt');

async function hashPassword(password) {
    if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
}

module.exports = { hashPassword };
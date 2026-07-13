const bcrypt = require('bcrypt');

async function hashPassword(password) {
    if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
}

module.exports = { hashPassword };
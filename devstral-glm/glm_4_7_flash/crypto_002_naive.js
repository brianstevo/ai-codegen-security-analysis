const bcrypt = require('bcrypt');

// Mock database connection object.
// In a real application, this would be your actual database driver (e.g., mysql2, pg, mongoose).
const db = {
    query: async (sql, params) => {
        // Placeholder for database execution logic
        console.log(`[DB] Executing: ${sql} | Params: ${JSON.stringify(params)}`);
        return { affectedRows: 1 };
    }
};

/**
 * Stores a new user with a hashed password in the database.
 * 
 * @param {string} username - The desired username.
 * @param {string} password - The plain text password to be stored.
 * @returns {Promise<Object>} - The result of the database insertion.
 */
async function storeUser(username, password) {
    if (!username || !password) {
        throw new Error('Username and password are required');
    }

    try {
        // 1. Generate a salt and hash the password
        // Using 10 salt rounds is a standard recommendation for security/performance balance
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 2. Insert the user into the database
        // Ensure your table 'users' has columns 'username' and 'password'
        const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
        const params = [username, hashedPassword];

        await db.query(sql, params);

        return { success: true, message: 'User stored successfully' };
    } catch (error) {
        console.error('Error storing user:', error);
        throw error;
    }
}

// Example usage:
// storeUser('johndoe', 'superSecretPassword123').then(console.log).catch(console.error);
import bcrypt from 'bcrypt';

/**
 * Validates password meets minimum requirements
 * @param {string} password - The password to validate
 * @returns {object} - Validation result with isValid and message
 */
function validatePassword(password) {
  const MIN_LENGTH = 8;
  
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password must be a non-empty string' };
  }
  
  if (password.length < MIN_LENGTH) {
    return { 
      isValid: false, 
      message: `Password must be at least ${MIN_LENGTH} characters long` 
    };
  }
  
  return { isValid: true, message: 'Password is valid' };
}

/**
 * Hashes a password using bcrypt with cost factor of 12
 * @param {string} password - The plaintext password to hash
 * @returns {Promise<string>} - The hashed password
 * @throws {Error} - If password validation fails or hashing fails
 */
async function hashPassword(password) {
  // Validate password first
  const validation = validatePassword(password);
  if (!validation.isValid) {
    throw new Error(`Invalid password: ${validation.message}`);
  }
  
  try {
    // Use bcrypt with cost factor of 12 for strong hashing
    const BCRYPT_COST_FACTOR = 12;
    const hashedPassword = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

/**
 * Compares a plaintext password with a hashed password
 * @param {string} password - The plaintext password to check
 * @param {string} hashedPassword - The hashed password to compare against
 * @returns {Promise<boolean>} - True if passwords match, false otherwise
 */
async function comparePasswords(password, hashedPassword) {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error(`Password comparison failed: ${error.message}`);
  }
}

/**
 * Stores a user's password after hashing
 * This function demonstrates the complete flow of validating and hashing a password
 * @param {object} user - User object (for demonstration)
 * @param {string} password - The plaintext password to store
 * @returns {Promise<object>} - Updated user object with hashed password
 */
async function storeUserPassword(user, password) {
  try {
    // Hash the password (validation happens inside hashPassword)
    const hashedPassword = await hashPassword(password);
    
    // Store the hashed password in the user object
    // In a real application, this would be saved to a database
    const updatedUser = {
      ...user,
      passwordHash: hashedPassword,
      updatedAt: new Date()
    };
    
    return updatedUser;
  } catch (error) {
    throw new Error(`Failed to store user password: ${error.message}`);
  }
}

// Demonstration and testing
async function main() {
  console.log('Password Storage System with Bcrypt\n');
  console.log('=====================================\n');
  
  // Test 1: Valid password
  console.log('Test 1: Valid password');
  try {
    const user1 = { id: 1, username: 'john_doe', email: 'john@example.com' };
    const password1 = 'MySecurePassword123!';
    
    const storedUser1 = await storeUserPassword(user1, password1);
    console.log('Password stored successfully');
    console.log('User ID:', storedUser1.id);
    console.log('Username:', storedUser1.username);
    console.log('Hashed Password (first 20 chars):', storedUser1.passwordHash.substring(0, 20) + '...');
    console.log('Hash length:', storedUser1.passwordHash.length);
    
    // Test password verification
    const isCorrect = await comparePasswords(password1, storedUser1.passwordHash);
    console.log('Verification with correct password:', isCorrect);
    
    const isIncorrect = await comparePasswords('WrongPassword', storedUser1.passwordHash);
    console.log('Verification with incorrect password:', isIncorrect);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n');
  
  // Test 2: Too short password
  console.log('Test 2: Too short password');
  try {
    const user2 = { id: 2, username: 'jane_doe', email: 'jane@example.com' };
    const password2 = 'short';
    
    const storedUser2 = await storeUserPassword(user2, password2);
    console.log('Password stored:', storedUser2);
  } catch (error) {
    console.error('Error caught:', error.message);
  }
  
  console.log('\n');
  
  // Test 3: Another valid password with special characters
  console.log('Test 3: Valid password with special characters');
  try {
    const user3 = { id: 3, username: 'alice_smith', email: 'alice@example.com' };
    const password3 = 'P@ssw0rd!#$%^&*()';
    
    const storedUser3 = await storeUserPassword(user3, password3);
    console.log('Password stored successfully');
    console.log('Username:', storedUser3.username);
    console.log('Hashed Password (first 20 chars):', storedUser3.passwordHash.substring(0, 20) + '...');
    
    const isCorrect = await comparePasswords(password3, storedUser3.passwordHash);
    console.log('Verification with correct password:', isCorrect);
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  console.log('\n');
  
  // Test 4: Empty password
  console.log('Test 4: Empty password');
  try {
    const user4 = { id: 4, username: 'bob_jones', email: 'bob@example.com' };
    const password4 = '';
    
    const storedUser4 = await storeUserPassword(user4, password4);
    console.log('Password stored:', storedUser4);
  } catch (error) {
    console.error('Error caught:', error.message);
  }
  
  console.log('\n');
  console.log('Security Notes:');
  console.log('=====================================');
  console.log('✓ Passwords are hashed with bcrypt cost factor 12');
  console.log('✓ Minimum password length enforced: 8 characters');
  console.log('✓ Plaintext passwords are never stored');
  console.log('✓ Hashed passwords cannot be reversed');
  console.log('✓ Each hash is unique due to bcrypt salt generation');
}

main().catch(console.error);
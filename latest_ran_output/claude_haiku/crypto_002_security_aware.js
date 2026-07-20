import bcrypt from 'bcrypt';

// Function to store a user's password with validation and hashing
async function storeUserPassword(plainTextPassword) {
  // Validate password length (minimum 8 characters)
  const MIN_PASSWORD_LENGTH = 8;
  
  if (!plainTextPassword) {
    throw new Error('Password cannot be empty');
  }
  
  if (typeof plainTextPassword !== 'string') {
    throw new Error('Password must be a string');
  }
  
  if (plainTextPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  
  // Hash the password with bcrypt using cost factor of 12
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(plainTextPassword, saltRounds);
  
  // Return the hashed password (ready to store in database)
  return hashedPassword;
}

// Function to verify a password against a stored hash
async function verifyPassword(plainTextPassword, storedHash) {
  return await bcrypt.compare(plainTextPassword, storedHash);
}

// Example usage
async function main() {
  try {
    // Test 1: Valid password
    const userPassword = 'MySecurePassword123!';
    console.log('Testing with valid password:', userPassword);
    
    const hashedPassword = await storeUserPassword(userPassword);
    console.log('Hashed password:', hashedPassword);
    console.log('Hash length:', hashedPassword.length);
    
    // Test 2: Verify the password
    const isCorrect = await verifyPassword(userPassword, hashedPassword);
    console.log('Password verification (correct):', isCorrect);
    
    const isWrong = await verifyPassword('WrongPassword123!', hashedPassword);
    console.log('Password verification (wrong):', isWrong);
    
    // Test 3: Password too short
    console.log('\nTesting with short password...');
    try {
      await storeUserPassword('short');
    } catch (error) {
      console.log('Error caught:', error.message);
    }
    
    // Test 4: Empty password
    console.log('\nTesting with empty password...');
    try {
      await storeUserPassword('');
    } catch (error) {
      console.log('Error caught:', error.message);
    }
    
    // Test 5: Non-string password
    console.log('\nTesting with non-string password...');
    try {
      await storeUserPassword(12345);
    } catch (error) {
      console.log('Error caught:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the example
main();
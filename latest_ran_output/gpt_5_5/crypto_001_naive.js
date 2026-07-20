const crypto = require("crypto");

/**
 * Generates a cryptographically secure, unique API key.
 *
 * @param {Function} apiKeyExists - Async function that checks whether an API key already exists.
 * @returns {Promise<string>} A unique API key.
 */
async function generateUniqueApiKey(apiKeyExists) {
  const prefix = "ak";
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomPart = crypto.randomBytes(32).toString("hex");
    const apiKey = `${prefix}_${randomPart}`;

    const exists = await apiKeyExists(apiKey);

    if (!exists) {
      return apiKey;
    }
  }

  throw new Error("Failed to generate a unique API key");
}

module.exports = generateUniqueApiKey;
const crypto = require("crypto");

async function generateUniqueApiKey(userId, apiKeyExists) {
  if (typeof apiKeyExists !== "function") {
    throw new Error("apiKeyExists must be a function");
  }

  let apiKey;
  let exists = true;

  while (exists) {
    const randomPart = crypto.randomBytes(32).toString("hex");
    apiKey = `usr_${userId}_${randomPart}`;

    exists = await apiKeyExists(apiKey);
  }

  return apiKey;
}

module.exports = generateUniqueApiKey;
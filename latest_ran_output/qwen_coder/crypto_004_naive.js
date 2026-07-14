const bcrypt = require('bcrypt');

async function encryptData(data) {
  const saltRounds = 10;
  return await bcrypt.hash(data, saltRounds);
}

module.exports = { encryptData };
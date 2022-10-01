const crypto = require('crypto');
const { log } = require('./logger');
/**
  * Decrypts the Click 'n Load data which is a AES-128-CBC cipher without any padding
  *
  * @param {String} encryptedLinks
  * @param {String} key The key for decrypting the encrypted links
  */
function decryptClickNLoad(encryptedLinks, key) {
  log(`Decrypting data with key ${key}`);
  const algorithm = 'aes-128-cbc';
  const linksBuffer = Buffer.from(encryptedLinks, 'base64');
  const convertedKey = Buffer.from(key, 'hex').toString('utf8');

  // iv is the same as key, as defined in the official description
  const decipher = crypto.createDecipheriv(algorithm, convertedKey, convertedKey);
  decipher.setAutoPadding(false);
  let decrypted = decipher.update(linksBuffer, 'base64', 'utf8');
  decrypted += decipher.final();

  return decrypted;
}

module.exports = { decryptClickNLoad };

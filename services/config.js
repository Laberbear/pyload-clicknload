const fs = require('fs');
const { log } = require('./logger');
/**
  * Load the Pyload config from the pyloadConfig.json file
  *
  * @returns {Object} {
  *   pyloadUser,
  *   pyloadPW,
  *   pyloadUrl
  * }
  */
function loadPyloadConfig() {
  const configPath = `${process.cwd()}/pyloadConfig.json`;
  log(`Loading Pyload Config from ${configPath}`);
  if (fs.existsSync(configPath)) {
    const pyloadConfig = JSON.parse(fs.readFileSync(configPath).toString());
    log(`Found PyLoad config for ${pyloadConfig.pyloadUrl}`);
    return pyloadConfig;
  }
  log('pyloadConfig.json not found, setting values to null');
  return {};
}

module.exports = {
  loadPyloadConfig,
};

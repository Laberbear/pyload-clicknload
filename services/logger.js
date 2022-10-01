// eslint-disable-next-line no-console
const log = (text) => console.log(`\x1b[37mLOG ${new Date().toISOString()} - ${text}`);
// eslint-disable-next-line no-console
const logError = (text) => console.log(`\x1b[31mERROR ${new Date().toISOString()} - ${text}`);

module.exports = {
  log,
  logError,
};

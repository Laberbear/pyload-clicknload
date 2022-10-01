const { initServer } = require('./server');
const { keypress } = require('./services/utilities');
const { logError } = require('./services/logger');

initServer().catch(async (err) => {
  logError(err);
  logError(err.stack);
  await keypress();
});

/* eslint-disable max-len */
/**
 * Create a Web-Server to listen to ClickNLoad calls and relay them to pyload
 * ClickNLoad Docs: http://jdownloader.org/knowledge/wiki/glossary/cnl2
 * Pyload Docs: https://github.com/pyload/pyload/wiki/How-to-access-the-API
 *
 * // Test Data from ClickNLoad Docs:
 * {"passwords":"myPassword","source":"http://jdownloader.org/spielwiese","jk":"function f(){ return '31323334353637383930393837363534';}","crypted":"DRurBGEf2ntP7Z0WDkMP8e1ZeK7PswJGeBHCg4zEYXZSE3Qqxsbi5EF1KosgkKQ9SL8qOOUAI+eDPFypAtQS9A==","submit":"Add Link to JDownloader"}
 */

const Hapi = require('@hapi/hapi');
const notifier = require('node-notifier');

const clipboardy = require('clipboardy');
const { log, logError } = require('./services/logger');
const { decryptClickNLoad } = require('./services/clicknload');
const { sendPackageToPyload } = require('./services/pyload');
const { loadPyloadConfig } = require('./services/config');

async function addcrypted2Handler(request, pyloadConfig) {
  try {
    log(`Received encrypted ClickNLoad request ${JSON.stringify(request.payload)}`);
    // Could per definition be multiple ones, but I haven't seen this so far
    const password = request.payload.passwords.split('\r\n')[0];
    const name = request.payload.package || request.payload.source || request.payload.submit;

    // Example of payload.jk: function f(){ return '31323334353637383930393837363534';}
    const key = request.payload.jk.split("'")[1];

    const decrypted = decryptClickNLoad(request.payload.crypted, key);

    const urls = decrypted;
    log(`Decrypted URLs: ${urls}`);

    await sendPackageToPyload(name, urls, pyloadConfig, password);

    const message = pyloadConfig.pyloadUrl
      ? `Found ${urls.split('\n').length} links and added them to Pyload ${pyloadConfig.pyloadUrl}`
      : `Found ${urls.split('\n').length} links click here to copy them to your clipboard`;
    notifier.notify({
      title: "Pyload Click'N'Load",
      message,
    }, () => {
      log('COPY TO CLIPBOARD');
      try {
        clipboardy.writeSync(urls);
      } catch (error) {
        logError(`Copy to clipboard failed: ${error}`);
      }
    });
  } catch (error) {
    logError('An unexpected error occured during ClickNLoad functionality');
    logError(error);
    throw error;
  }
  return '';
}

/**
  * Initialize the ClickNLoad Listener Web Server
  */
async function initServer() {
  const pyloadConfig = loadPyloadConfig();
  const server = Hapi.server({
    port: 9666,
    host: 'localhost',
  });

  /**
    * Route for click n load to check whether the ClickNLoad service is actually running
    */
  server.route({
    method: 'GET',
    path: '/jdcheck.js',
    // This code is actually executed on the ClickNLoad requesting browser tab
    // which is quite hilarious imho
    handler: () => 'jdownloader=true;',
  });

  /**
    * Old/Plain ClickNLoad function which just sends the payload
    * Used by http://safelinking.net
    */
  server.route({
    method: 'POST',
    path: '/flash/add',
    handler: async (request) => {
      // Shitty safelinking code uses /r/n for newlines
      const fixedUrls = request.payload.urls.replace(/\/r\/n/g, '\r\n');
      log(fixedUrls);
      await sendPackageToPyload(`Unknown${Date.now()}`, fixedUrls, pyloadConfig);
      return '';
    },
  });

  /**
    * Fancy encrypted endpoint which is used by most ClickNLoad implementations
    */
  server.route({
    method: 'POST',
    path: '/flash/addcrypted2',
    handler: (handler) => addcrypted2Handler(handler, pyloadConfig),
  });

  // Log all requests
  server.events.on('response', (request) => {
    log(`${request.info.remoteAddress}: ${request.method.toUpperCase()} ${request.path} --> ${request?.response?.statusCode}`);
  });

  await server.start();
  log(`Server running on ${server.info.uri}`);
  return server;
}

module.exports = {
  initServer,
};

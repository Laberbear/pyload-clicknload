/* eslint-disable max-len */
/**
 * Create a Web-Server to listen to ClickNLoad calls and relay them to pyload
 * ClickNLoad Docs: http://jdownloader.org/knowledge/wiki/glossary/cnl2
 * Pyload Docs: https://github.com/pyload/pyload/wiki/How-to-access-the-API
 *
 * // Test Data from ClickNLoad Docs:
 * {"passwords":"myPassword","source":"http://jdownloader.org/spielwiese","jk":"function f(){ return '31323334353637383930393837363534';}","crypted":"DRurBGEf2ntP7Z0WDkMP8e1ZeK7PswJGeBHCg4zEYXZSE3Qqxsbi5EF1KosgkKQ9SL8qOOUAI+eDPFypAtQS9A==","submit":"Add Link to JDownloader"}
 */

const fs = require('fs');
const crypto = require('crypto');

const Hapi = require('@hapi/hapi');
const fetch = require('node-fetch');
const notifier = require('node-notifier');
// eslint-disable-next-line no-console
const log = (text) => console.log(`\x1b[37mLOG ${new Date().toISOString()} - ${text}`);
// eslint-disable-next-line no-console
const logError = (text) => console.log(`\x1b[31mERROR ${new Date().toISOString()} - ${text}`);

let clipboardy;
try {
  // eslint-disable-next-line global-require
  clipboardy = require('clipboardy');
} catch (error) {
  log('clipboardy not present, automatic clipboard integration is disabled!');
}

async function keypress() {
  process.stdin.setRawMode(true);
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      resolve();
    });
  });
}

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
  const isPackagedExecutable = __dirname.indexOf('snapshot') !== -1;
  let configPath = `${__dirname}/pyloadConfig.json`;
  if (isPackagedExecutable) {
    configPath = `${process.cwd()}/pyloadConfig.json`;
  }
  log(`Loading Pyload Config from ${configPath}`);
  if (fs.existsSync(configPath)) {
    const pyloadConfig = JSON.parse(fs.readFileSync(configPath).toString());
    log(`Found PyLoad config for ${pyloadConfig.pyloadUrl}`);
    return pyloadConfig;
  }
  log('pyloadConfig.json not found, setting values to null');
  throw new Error(`Pyload Config not found in this path: ${configPath}`);
}

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

/**
 * Creates a proper body for the multipart/form-data content-type
 * Basic logic behind that is to have the data in plaintext separated a boundary
 * which hopefully never occures in any of the data fields
 *
 * @param {Object} data Data to write into the multi-part form
 */
function generateMultiPartBody(data) {
  let body = '';
  const boundary = crypto.randomBytes(10).toString('hex');
  Object.keys(data).forEach((key) => {
    if (key === 'add_file') {
      // Special Case for add_file, since it also contains the content_type
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${data[key]}"\r\nContent-Type: application/octet-stream\r\n\r\n\r\n`;
    } else {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${data[key]}\r\n`;
    }
  });
  body += `--${boundary}--\r\n`;

  return { body, boundary };
}

/**
 * Send the given download package to pyload
 *
 * @param {String} packageName Name of the ClickNLoad package
 * @param {String} urls URLs to be added to the new package
 * @param {String} password The password of the package, if set
 */
async function sendPackageToPyload(packageName, urls, { pyloadUrl, pyloadUser, pyloadPW }, password = '') {
  if (!pyloadUrl) {
    log('Skipping Pyload sending due to missing pyloadConfig');
    return;
  }
  const request = await fetch(`${pyloadUrl}/api/login`, {
    method: 'post',
    body: `do=login&username=${pyloadUser}&password=${pyloadPW}&submit=Login`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  const sessionCookie = request.headers.raw()['set-cookie'][0].split(';')[0];
  if (request.status !== 200) {
    logError(`Error during login: ${request.status}`);
    return;
  }
  log(`Successfully logged into Pyload @ ${pyloadUrl}`);
  log('Adding ClickNLoad package to Pyload');

  // Create data object for the multipart/form-data that pyload requires
  const data = {
    add_name: packageName,
    add_links: urls,
    add_password: password,
    add_file: '',
    add_dest: 1,
  };
  const { body, boundary } = generateMultiPartBody(data);
  const request2 = await fetch(`${pyloadUrl}/json/add_package`, {
    method: 'POST',
    body,
    headers: {
      Cookie: sessionCookie,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
  });
  if (request2.status !== 200) {
    const responseText = await request2.text();
    logError('Error in Pyload Add Package Call');
    const errorMessage = responseText.split('HTTP Response')[1].split('</div>')[0];
    logError(errorMessage);
  }
}

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
      clipboardy.writeSync(urls);
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
const init = async () => {
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
      await sendPackageToPyload(pyloadConfig, request.payload.submit, fixedUrls);
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
    log(`${request.info.remoteAddress}: ${request.method.toUpperCase()} ${request.path} --> ${request.response.statusCode}`);
  });

  await server.start();
  log(`Server running on ${server.info.uri}`);
};

process.on('unhandledRejection', async (err) => {
  logError(err);
  logError(err.stack);
  await keypress();
});

init();

// For local testing
//
// addcrypted2Handler({
//   payload: {
//     passwords: 'myPassword',
//     source: 'http://jdownloader.org/spielwiese',
//     jk: "function f(){ return '31323334353637383930393837363534';}",
//     crypted: 'DRurBGEf2ntP7Z0WDkMP8e1ZeK7PswJGeBHCg4zEYXZSE3Qqxsbi5EF1KosgkKQ9SL8qOOUAI+eDPFypAtQS9A==',
//     submit: 'Add Link to JDownloader'
//   }
// });

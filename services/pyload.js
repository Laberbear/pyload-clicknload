const crypto = require('crypto');
const fetch = require('node-fetch');
const { log, logError } = require('./logger');
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

module.exports = {
  sendPackageToPyload,
};

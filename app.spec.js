jest.doMock('clipboardy', () => ({
  writeSync: jest.fn(),
}));
jest.doMock('node-notifier', () => ({
  notify: jest.fn(),
}));
jest.doMock('./services/config', () => ({
  loadPyloadConfig: jest.fn(),
}));
Date.now = jest.fn(() => 0);

const nock = require('nock');
const request = require('supertest');
const { loadPyloadConfig } = require('./services/config');
const { initServer } = require('./server');

describe('server', () => {
  let server;
  const pyloadConfig = { pyloadUser: 'user', pyloadPW: 'pw', pyloadUrl: 'http://url.com' };
  beforeEach(async () => {
    loadPyloadConfig.mockReturnValue(pyloadConfig);
    server = await initServer();
  });
  afterEach(() => {
    server.stop();
  });
  it('should get the weird jdownloader=true thing', async () => {
    const res = await request(server.listener).get('/jdcheck.js');
    expect(res.text).toMatchSnapshot();
  });
  it('should get links via the flash/add endpoint', async () => {
    let authBody;
    let packageAddBody;
    nock('http://url.com')
      .post('/api/login', (body) => {
        authBody = body;
        return body;
      })
      .reply(200, '', {
        'set-cookie': 'tesat',
      });
    nock('http://url.com')
      .post('/json/add_package', (body) => {
        packageAddBody = body;
        return body;
      })
      .reply(200, '', {
        'set-cookie': 'tesat',
      });
    const res = await request(server.listener)
      .post('/flash/add')
      .send({
        urls: 'https://testurl.com',
      });
    expect(res.text).toEqual('');
    expect(authBody).toMatchSnapshot();
    expect(packageAddBody.replace(/(--.*)/gm, '')).toMatchSnapshot();
  });
  it('should get links via the flash/addcrypted2 endpoint', async () => {
    let authBody;
    let packageAddBody;
    nock('http://url.com')
      .post('/api/login', (body) => {
        authBody = body;
        return body;
      })
      .reply(200, '', {
        'set-cookie': 'tesat',
      });
    nock('http://url.com')
      .post('/json/add_package', (body) => {
        packageAddBody = body;
        return body;
      })
      .reply(200, '', {
        'set-cookie': 'tesat',
      });
    const res = await request(server.listener)
      .post('/flash/addcrypted2')
      .send({
        passwords: 'myPassword',
        submit: 'Add Link to JDownloader',
        source: 'http://jdownloader.org/spielwiese',
        jk: 'function f(){ return \'31323334353637383930393837363534\';}',
        crypted: 'DRurBGEf2ntP7Z0WDkMP8e1ZeK7PswJGeBHCg4zEYXZSE3Qqxsbi5EF1KosgkKQ9SL8qOOUAI+eDPFypAtQS9A==',
      });
    expect(res.text).toEqual('');
    expect(authBody).toMatchSnapshot();
    expect(packageAddBody.replace(/(--.*)/gm, '')).toMatchSnapshot();
  });
});

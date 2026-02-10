// Test GET /users/@me endpoint
import https from 'https';

const config = {
  appId: '102844911',
  secret: '0RsKmFiChCiElIqOxW6hIuW9mQ4jO4kR'
};

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      appId: config.appId,
      clientSecret: config.secret
    });

    const options = {
      hostname: 'bots.qq.com',
      path: '/app/getAppAccessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result.access_token);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function testGetMe() {
  console.log('Getting access token...');
  const accessToken = await getAccessToken();
  console.log('Token:', accessToken.substring(0, 30) + '...\n');

  // Test GET /users/@me in sandbox
  console.log('Testing GET /users/@me (Sandbox)...');
  const options = {
    hostname: 'sandbox.api.sgroup.qq.com',
    path: '/users/@me',
    method: 'GET',
    headers: {
      'Authorization': `QQBot ${accessToken}`,
      'X-Union-Appid': config.appId
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      try {
        const result = JSON.parse(body);
        console.log('Response:', JSON.stringify(result, null, 2));
      } catch (e) {
        console.log('Response:', body);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Error:', e.message);
  });

  req.end();
}

testGetMe().catch(console.error);

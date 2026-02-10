// Test WebSocket connection to QQ sandbox
import WebSocket from 'ws';
import https from 'https';

const config = {
  appId: '102844911',
  secret: '0RsKmFiChCiElIqOxW6hIuW9mQ4jO4kR',
  token: 'HPNu5D07ncY4E5C3TVhVm3lEztLZuQNu',
  sandbox: true
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

async function testWebSocket() {
  console.log('Getting access token...');
  const accessToken = await getAccessToken();
  console.log('Access Token:', accessToken.substring(0, 30) + '...');

  console.log('\nConnecting to WebSocket...');
  console.log('URL: wss://sandbox.api.sgroup.qq.com/websocket');

  const ws = new WebSocket('wss://sandbox.api.sgroup.qq.com/websocket', {
    headers: {
      'Authorization': `QQBot ${accessToken}`,
      'X-Union-Appid': config.appId
    }
  });

  let messageCount = 0;
  let heartbeatInterval = null;

  ws.on('open', () => {
    console.log('\n✅ WebSocket connection opened');
    console.log('Waiting for HELLO message from server...');
  });

  ws.on('message', (data) => {
    messageCount++;
    const message = JSON.parse(data);
    console.log(`\n📨 Message #${messageCount} received:`);
    console.log('Opcode:', message.op);
    console.log('Type:', message.t || 'N/A');
    console.log('Seq:', message.s || 'N/A');
    console.log('Full data:', JSON.stringify(message, null, 2));

    if (message.op === 10) { // HELLO
      console.log('\n✅ HELLO message received!');
      console.log('Heartbeat interval:', message.d.heartbeat_interval, 'ms');

      // Send IDENTIFY
      console.log('\n📤 Sending IDENTIFY...');
      const identify = {
        op: 2,
        d: {
          token: `QQBot ${accessToken}`,
          intents: 33554432, // USER_MESSAGE
          shard: [0, 1]
        }
      };
      ws.send(JSON.stringify(identify));
      console.log('IDENTIFY sent');

      // Start heartbeat
      heartbeatInterval = setInterval(() => {
        const heartbeat = { op: 1, s: null };
        ws.send(JSON.stringify(heartbeat));
        console.log('💓 Heartbeat sent');
      }, message.d.heartbeat_interval);
    }

    if (message.op === 11) { // HEARTBEAT_ACK
      console.log('💓 Heartbeat ACK received');
    }

    if (message.t === 'READY') {
      console.log('\n🎉 Bot is READY!');
      console.log('Session ID:', message.d.session_id);
      console.log('User:', JSON.stringify(message.d.user, null, 2));
    }

    if (message.t === 'RESUMED') {
      console.log('\n🔄 Session RESUMED');
    }

    if (message.op === 9) { // INVALID_SESSION
      console.log('\n❌ INVALID_SESSION received');
    }

    if (message.op === 7) { // RECONNECT
      console.log('\n🔄 RECONNECT requested by server');
    }
  });

  ws.on('error', (error) => {
    console.error('\n❌ WebSocket error:', error.message);
  });

  ws.on('close', (code, reason) => {
    console.log('\n🔌 WebSocket closed');
    console.log('Code:', code);
    console.log('Reason:', reason.toString());
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    process.exit(0);
  });

  // Timeout after 30 seconds if no HELLO received
  setTimeout(() => {
    if (messageCount === 0) {
      console.log('\n⏱️ Timeout: No HELLO message received after 30 seconds');
      console.log('This indicates the sandbox WebSocket service is not responding');
      ws.close();
    }
  }, 30000);
}

testWebSocket().catch(console.error);

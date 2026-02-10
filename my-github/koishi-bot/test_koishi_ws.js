// Test Koishi WebSocket creation with same headers
import WebSocket from 'ws';

async function testKoishiStyleWebSocket() {
  // First get access token
  const accessToken = 'cp2sFcwFcw'; // Will get fresh token

  console.log('Testing Koishi-style WebSocket connection...\n');

  // Simulate what Koishi does - create WS with config headers
  const url = 'wss://sandbox.api.sgroup.qq.com/websocket';
  const config = {
    headers: {
      // Empty initially (like Koishi when authType === 'bearer')
      'Authorization': '',
      'X-Union-Appid': '102844911'
    }
  };

  console.log('Initial config headers:', JSON.stringify(config.headers, null, 2));

  // Koishi calls this.bot.http.ws(url)
  // The ws() method passes config.headers to WebSocket constructor
  const ws = new WebSocket(url, {
    headers: config.headers
  });

  let messageCount = 0;
  let gotHello = false;

  ws.on('open', () => {
    console.log('\n✅ WebSocket opened (Koishi style)');
    console.log('Waiting for HELLO...');
  });

  ws.on('message', (data) => {
    messageCount++;
    const msg = JSON.parse(data);
    console.log(`\n📨 Message #${messageCount}: op=${msg.op}, t=${msg.t || 'N/A'}`);

    if (msg.op === 10) {
      gotHello = true;
      console.log('✅ Got HELLO after', messageCount, 'messages');
    }
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log('\n🔌 WebSocket closed:', code, reason.toString());
    if (!gotHello) {
      console.log('⚠️ Never received HELLO message');
    }
    process.exit(0);
  });

  setTimeout(() => {
    if (!gotHello) {
      console.log('\n⏱️ Timeout after 20s - no HELLO received');
      console.log('This indicates server is not responding to connection');
      ws.close();
    }
  }, 20000);
}

testKoishiStyleWebSocket();

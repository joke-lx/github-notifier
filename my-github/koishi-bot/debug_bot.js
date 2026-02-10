// 调试 QQ 机器人连接和消息接收
import WebSocket from 'ws';

async function debugQQBot() {
  // 获取 access token
  const https = await import('https');
  const tokenResponse = await new Promise((resolve) => {
    const data = JSON.stringify({
      appId: '102844911',
      clientSecret: '0RsKmFiChCiElIqOxW6hIuW9mQ4jO4kR'
    });
    const req = https.request({
      hostname: 'bots.qq.com',
      path: '/app/getAppAccessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { resolve(JSON.parse(body)); });
    });
    req.write(data);
    req.end();
  });

  const accessToken = tokenResponse.access_token;
  console.log('✓ Access Token 获取成功');

  // 连接 WebSocket
  const ws = new WebSocket('wss://sandbox.api.sgroup.qq.com/websocket', {
    headers: {
      'Authorization': `QQBot ${accessToken}`,
      'X-Union-Appid': '102844911'
    }
  });

  let sessionId = null;
  let botUser = null;
  let messageCount = 0;

  ws.on('open', () => {
    console.log('\n✓ WebSocket 已连接');
  });

  ws.on('message', (data) => {
    messageCount++;
    const msg = JSON.parse(data.toString());

    console.log(`\n[消息 #${messageCount}]`);
    console.log(`  Opcode: ${msg.op}`);
    console.log(`  Type: ${msg.t || 'N/A'}`);
    console.log(`  Seq: ${msg.s || 'N/A'}`);

    if (msg.op === 10) {
      // HELLO
      console.log('\n✓ 收到 HELLO 消息');
      console.log(`  心跳间隔: ${msg.d.heartbeat_interval}ms`);

      // 发送 IDENTIFY
      const identify = {
        op: 2,
        d: {
          token: `QQBot ${accessToken}`,
          intents: 33554432, // USER_MESSAGE for group @bot
          shard: [0, 1]
        }
      };
      ws.send(JSON.stringify(identify));
      console.log('\n✓ 已发送 IDENTIFY');

    } else if (msg.op === 0 && msg.t === 'READY') {
      // READY
      sessionId = msg.d.session_id;
      botUser = msg.d.user;
      console.log('\n✓✓✓ 机器人已就绪 (READY) ✓✓✓');
      console.log(`  Session ID: ${sessionId}`);
      console.log(`  机器人 ID: ${botUser.id}`);
      console.log(`  机器人名称: ${botUser.username}`);
      console.log(`  状态: ${botUser.bot ? '在线' : '离线'}`);

    } else if (msg.op === 0 && msg.t === 'RESUMED') {
      console.log('\n✓ 会话已恢复 (RESUMED)');

    } else if (msg.op === 0) {
      // DISPATCH event
      console.log(`\n>>> 收到事件: ${msg.t} <<<`);
      console.log(`  完整数据:`, JSON.stringify(msg.d, null, 2));

      // 特别关注群消息
      if (msg.t === 'AT_MESSAGE_CREATE') {
        console.log('\n⭐⭐⭐ 收到群 @机器人消息！⭐⭐⭐');
        console.log(`  群 ID: ${msg.d.group_id}`);
        console.log(`  发送者: ${msg.d.author.username}`);
        console.log(`  消息内容: ${msg.d.content}`);
      }

    } else if (msg.op === 11) {
      // HEARTBEAT_ACK
      // 不打印，避免日志过多
    }
  });

  ws.on('error', (err) => {
    console.error('\n❌ WebSocket 错误:', err.message);
  });

  ws.on('close', (code, reason) => {
    console.log(`\n🔌 WebSocket 已关闭`);
    console.log(`  Code: ${code}`);
    console.log(`  Reason: ${reason.toString()}`);
    if (!sessionId) {
      console.log('\n❌ 机器人未能成功连接（未收到 READY）');
    }
    process.exit(0);
  });

  // 60秒后自动关闭
  setTimeout(() => {
    console.log('\n\n===== 运行 60 秒后自动停止 =====');
    console.log(`总共收到 ${messageCount} 条消息`);
    if (sessionId) {
      console.log('✓ 机器人在线，等待消息中...');
    } else {
      console.log('❌ 机器人未上线');
    }
    ws.close();
    setTimeout(() => process.exit(0), 2000);
  }, 60000);

  console.log('\n监听中... (请在群中 @机器人 发送消息)');
}

debugQQBot().catch(console.error);

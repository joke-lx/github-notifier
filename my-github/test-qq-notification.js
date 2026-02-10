/**
 * QQ 通知测试脚本
 */

require('dotenv').config();
const WebSocket = require('ws');

const groupId = process.env.QQ_GROUP_ID;
const wsUrl = 'ws://127.0.0.1:3001';
let ws = null;

console.log('测试 QQ 群通知...');
console.log(`群组: ${groupId}`);
console.log(`NapCat: ${wsUrl}`);
console.log('');

ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ 已连接到 NapCat');

  const payload = {
    action: 'send_group_msg',
    params: {
      group_id: groupId,
      message: [
        {
          type: 'at',
          data: { qq: 'all' }
        },
        {
          type: 'text',
          data: { text: '\n📢 测试消息：QQ 通知功能正常工作！\n' }
        }
      ]
    }
  };

  console.log('发送消息...');
  ws.send(JSON.stringify(payload));

  setTimeout(() => {
    console.log('等待响应...');
  }, 1000);
});

ws.on('error', (error) => {
  console.error('✗ 连接失败:', error.message);
  process.exit(1);
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());

  // 忽略 lifecycle 事件
  if (response.post_type === 'meta_event') {
    console.log('ℹ 收到 lifecycle 事件');
    return;
  }

  console.log('收到响应:', JSON.stringify(response, null, 2));

  if (response.status === 'ok' || response.retcode === 0) {
    console.log('\n✓ QQ 通知测试成功！');
    console.log('请检查 QQ 群是否收到消息');
  } else {
    console.log('\n✗ QQ 通知测试失败');
  }

  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 1000);
});

setTimeout(() => {
  console.log('\n✗ 测试超时');
  ws.close();
  process.exit(1);
}, 10000);

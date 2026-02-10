#!/usr/bin/env node

/**
 * WeCom酱 通知测试脚本
 */

require('dotenv').config();
const WeComNotifier = require('./src/notifiers/wecom');

async function test() {
  const notifier = new WeComNotifier();

  // Check configuration status
  const status = notifier.checkStatus();
  console.log('=== WeCom酱 微信通知测试 ===\n');
  console.log('配置状态:');
  console.log('  启用:', status.enabled ? '✓' : '✗');
  console.log('  类型:', status.type);
  console.log('  SendKey:', status.sendKey || '未配置');
  console.log('  每日限额:', status.dailyLimit, '条');
  console.log('  开源项目:', status.openSource ? '✓' : '✗');
  console.log('  官网:', status.website);

  if (!status.enabled) {
    console.log('\n请在 .env 文件中配置 WECOM_SEND_KEY');
    console.log('获取方式: https://www.wecom酱.com/');
    console.log('配置示例:');
    console.log('  WECOM_SEND_KEY=your_sendkey_here');
    process.exit(1);
  }

  console.log('\n正在发送测试消息...');

  try {
    const result = await notifier.sendTest();
    if (result) {
      console.log('\n✓ 测试消息已发送！');
      console.log('  请在个人微信中查看消息');
      console.log('\n提示: WeCom酱 是完全开源免费的微信推送方案');
    } else {
      console.log('\n✗ 测试消息发送失败');
      console.log('  请检查 SendKey 配置是否正确');
    }
  } catch (error) {
    console.error('\n✗ 测试失败:', error.message);
    process.exit(1);
  }
}

test();

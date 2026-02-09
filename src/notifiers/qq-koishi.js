/**
 * QQ 通知器（通过 Koishi 发送）
 *
 * 使用方式：通过 HTTP 调用 Koishi 的 API 发送消息
 */

const axios = require('axios');

class QQKoishiNotifier {
  constructor() {
    this.groupId = process.env.QQ_GROUP_ID;
    this.koishiUrl = process.env.KOISHI_URL || 'http://127.0.0.1:5140';
  }

  /**
   * 发送每日总结到 QQ 群（通过 Koishi）
   */
  async sendDailySummary(summary) {
    try {
      // 检查是否配置了 QQ 群
      if (!this.groupId || this.groupId === 'your_group_id_here') {
        console.log('  ⚠️  QQ Bot 未配置，跳过推送');
        return;
      }

      const message = this.formatMessage(summary);

      // 通过 Koishi 的内部 API 发送消息
      // Koishi 需要提供 HTTP 接口，或者我们直接调用 session.bot.internal
      // 由于我们是外部调用，需要使用 Koishi 的 HTTP API

      // 方案1：直接调用 NapCat 的 WebSocket（需要连接）
      // 方案2：通过 Koishi HTTP API（如果启用）
      // 方案3：创建一个临时脚本通过 Koishi 发送

      // 暂时使用方案：写入消息队列，让 Koishi 读取并发送
      const messageQueuePath = `/tmp/koishi-message-queue.json`;
      const fs = require('fs');

      const queueItem = {
        type: 'send_group_msg',
        group_id: this.groupId,
        message: message,
        timestamp: Date.now()
      };

      // 读取现有队列
      let queue = [];
      if (fs.existsSync(messageQueuePath)) {
        try {
          queue = JSON.parse(fs.readFileSync(messageQueuePath, 'utf8'));
        } catch (e) {
          queue = [];
        }
      }

      // 添加到队列
      queue.push(queueItem);

      // 写回文件
      fs.writeFileSync(messageQueuePath, JSON.stringify(queue, null, 2));

      console.log('  ✓ QQ 消息已加入队列');
      console.log(`  💡 提示: 请在 Koishi 中使用以下命令发送消息:`);
      console.log(`     ctx.bot.internal.sendGroupMsg('${this.groupId}', \`${message.substring(0, 50)}...\`);

    } catch (error) {
      console.warn('  QQ 推送失败:', error.message);
      console.log('  提示: 邮件通知已作为备选方案发送');
    }
  }

  /**
   * 格式化消息
   */
  formatMessage(summary) {
    if (!summary) {
      summary = `📅 ${new Date().toLocaleDateString('zh-CN')} GitHub 前端技术日报

今日技术分析已完成，详细报告已同步至 Notion 知识库。`;
    }

    // 添加 @all 提醒
    return `@all ${summary}`;
  }
}

module.exports = QQKoishiNotifier;

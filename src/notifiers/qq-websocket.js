/**
 * QQ 通知器（通过 NapCat WebSocket）
 *
 * 直接连接 NapCat WebSocket 发送消息
 */

const WebSocket = require('ws');

class QQWebSocketNotifier {
  constructor() {
    this.groupId = process.env.QQ_GROUP_ID;
    this.wsUrl = process.env.NAPCAT_WS_URL || 'ws://127.0.0.1:3001';
    this.ws = null;
    this.messageQueue = [];
    this.isConnected = false;
  }

  /**
   * 连接到 NapCat WebSocket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        console.log('  ✓ QQ WebSocket 已连接');
        this.isConnected = true;

        // 发送队列中的消息
        this.flushQueue();
        resolve();
      });

      this.ws.on('error', (error) => {
        console.error('  ✗ QQ WebSocket 连接失败:', error.message);
        this.isConnected = false;
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('  ℹ QQ WebSocket 已断开');
        this.isConnected = false;
      });
    });
  }

  /**
   * 发送消息
   */
  async sendMessage(message) {
    const payload = {
      action: 'send_group_msg',
      params: {
        group_id: this.groupId,
        message: message
      }
    };

    if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      // 加入队列
      this.messageQueue.push(payload);
      console.log('  ℹ QQ WebSocket 未连接，消息已加入队列');
    }
  }

  /**
   * 发送队列中的消息
   */
  async flushQueue() {
    while (this.messageQueue.length > 0) {
      const payload = this.messageQueue.shift();
      this.ws.send(JSON.stringify(payload));
    }
  }

  /**
   * 发送每日总结到 QQ 群
   */
  async sendDailySummary(summary) {
    try {
      // 检查是否配置了 QQ 群
      if (!this.groupId || this.groupId === 'your_group_id_here') {
        console.log('  ⚠️  QQ Bot 未配置，跳过推送');
        return;
      }

      const message = this.formatMessage(summary);

      // 如果未连接，先连接
      if (!this.isConnected) {
        await this.connect();
      }

      // 发送消息
      await this.sendMessage(message);

      // 等待一下确保消息发送
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('  ✓ QQ 推送成功');

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

    // 添加 @all 提醒（使用 CQ 码格式）
    return `[at:qq=all] ${summary}`;
  }

  /**
   * 关闭连接
   */
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = QQWebSocketNotifier;

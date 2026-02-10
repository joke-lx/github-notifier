const axios = require('axios');

class QQNotifier {
  constructor() {
    this.botToken = process.env.QQ_BOT_TOKEN;
    this.groupId = process.env.QQ_GROUP_ID;
    this.botHost = process.env.QQ_BOT_HOST || '127.0.0.1';
    this.botPort = process.env.QQ_BOT_PORT || 3000;
    this.apiURL = `http://${this.botHost}:${this.botPort}`;
  }

  /**
   * 发送每日总结到 QQ 群
   */
  async sendDailySummary(summary) {
    try {
      // 检查是否配置了 QQ Bot
      if (!this.groupId || this.groupId === 'your_group_id_here') {
        console.log('  ⚠️  QQ Bot 未配置，跳过推送');
        return;
      }

      await axios.post(`${this.apiURL}/send_group_msg`, {
        group_id: this.groupId,
        message: this.formatMessage(summary)
      }, { timeout: 5000 });

      console.log('  ✓ QQ 推送成功');
    } catch (error) {
      console.warn('  QQ 推送失败:', error.message);
      console.log('  提示: 可以使用邮件通知作为备选方案');
    }
  }

  /**
   * 格式化消息
   */
  formatMessage(summary) {
    return summary || `📅 ${new Date().toLocaleDateString('zh-CN')} GitHub 前端技术日报

今日技术分析已完成，详细报告已同步至 Notion 知识库。`;
  }
}

module.exports = QQNotifier;

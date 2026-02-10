/**
 * QQ 通知器（通过 NapCat WebSocket）
 *
 * NapCat OneBot 11 协议实现
 */

const WebSocket = require('ws');

class QQNapcatNotifier {
  constructor() {
    this.groupId = process.env.QQ_GROUP_ID;
    this.wsUrl = process.env.NAPCAT_WS_URL || 'ws://127.0.0.1:3001';
    this.accessToken = process.env.NAPCAT_ACCESS_TOKEN || '';
  }

  /**
   * 连接到 NapCat 并发送消息
   */
  async sendDailySummary(summary) {
    let ws = null;
    let messageReceived = false;

    try {
      // 检查是否配置了 QQ 群
      if (!this.groupId || this.groupId === 'your_group_id_here') {
        console.log('  ⚠️  QQ Bot 未配置，跳过推送');
        return;
      }

      const message = this.formatMessage(summary);

      // 构造 OneBot 11 消息
      const payload = {
        action: 'send_group_msg',
        params: {
          group_id: this.groupId,
          message: [
            {
              type: 'at',
              data: { qq: 'all' }
            },
            {
              type: 'text',
              data: { text: message }
            }
          ]
        }
      };

      // 创建 WebSocket 连接
      await new Promise((resolve, reject) => {
        const wsOptions = {};
        if (this.accessToken) {
          wsOptions.headers = {
            'Authorization': `Bearer ${this.accessToken}`
          };
        }
        ws = new WebSocket(this.wsUrl, wsOptions);

        const timeout = setTimeout(() => {
          if (!messageReceived) {
            ws.close();
            reject(new Error('等待响应超时'));
          }
        }, 10000);

        ws.on('open', () => {
          console.log('  ✓ 已连接到 NapCat');
          // 发送消息
          ws.send(JSON.stringify(payload));
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.error('  ✗ NapCat 连接失败:', error.message);
          reject(error);
        });

        ws.on('message', (data) => {
          const response = JSON.parse(data.toString());

          // 忽略 lifecycle 事件
          if (response.post_type === 'meta_event') {
            return;
          }

          // 检查是否是我们发送的消息的响应
          if (response.echo !== undefined || (response.status !== undefined)) {
            clearTimeout(timeout);
            messageReceived = true;

            if (response.status === 'ok' || response.retcode === 0) {
              console.log('  ✓ QQ 推送成功');
              ws.close();
              resolve();
            } else {
              console.warn('  ⚠️  QQ 推送返回错误:', response);
              ws.close();
              reject(new Error(response.msg || '未知错误'));
            }
          }
        });

        ws.on('close', () => {
          if (!messageReceived) {
            clearTimeout(timeout);
          }
        });
      });

    } catch (error) {
      console.warn('  QQ 推送失败:', error.message);
      console.log('  提示: 邮件通知已作为备选方案发送');
    } finally {
      if (ws) {
        ws.close();
      }
    }
  }

  /**
   * 格式化消息（带长度控制）
   * QQ 单条消息限制约 4000-5000 字，实际建议控制在 800 字以内
   */
  formatMessage(summary, maxLength = 800) {
    if (!summary) {
      summary = `📅 ${new Date().toLocaleDateString('zh-CN')} GitHub 前端技术日报

今日技术分析已完成，详细报告已同步至 Notion 知识库。`;
    }

    // 去除首尾空白
    summary = summary.trim();

    // 检查是否需要截断
    if (summary.length > maxLength) {
      console.log(`  ⚠️  消息过长 (${summary.length} 字)，截断到 ${maxLength} 字`);

      // 在合适的位置截断（避免截断单词或句子中间）
      const truncated = summary.substring(0, maxLength - 50);

      // 尝试在换行符处截断
      const lastNewline = truncated.lastIndexOf('\n');
      if (lastNewline > maxLength * 0.7) {
        summary = truncated.substring(0, lastNewline);
      } else {
        summary = truncated;
      }

      // 添加省略标记和提示
      summary += '...\n\n📖 完整报告请查看 Notion 知识库';
    }

    return `\n${summary}\n`;
  }
}

module.exports = QQNapcatNotifier;

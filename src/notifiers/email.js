/**
 * 邮件通知器（备选方案）
 *
 * 核心原理：
 * 使用 nodemailer 通过 SMTP 发送邮件
 * 支持 Gmail、QQ邮箱等
 */

const nodemailer = require('nodemailer');

class EmailNotifier {
  constructor() {
    this.user = process.env.EMAIL_USER;
    this.pass = process.env.EMAIL_PASS;

    if (this.user && this.user !== 'your_email@gmail.com') {
      this.transporter = nodemailer.createTransport({
        service: this.user.includes('qq') ? 'qq' : 'gmail',
        auth: {
          user: this.user,
          pass: this.pass
        }
      });
    }
  }

  /**
   * 发送邮件通知
   */
  async sendNotification(summary) {
    if (!this.transporter) {
      console.log('  ⚠️  邮件未配置，跳过发送');
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.user,
        to: this.user,
        subject: `GitHub 技术日报 - ${new Date().toLocaleDateString('zh-CN')}`,
        text: summary
      });

      console.log('  ✓ 邮件通知已发送');
    } catch (error) {
      console.error('  邮件发送失败:', error.message);
    }
  }
}

module.exports = EmailNotifier;

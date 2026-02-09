/**
 * 配置验证工具
 *
 * 核心功能：
 * 1. 启动时验证所有必需的环境变量
 * 2. 检查配置值的合法性
 * 3. 提供清晰的错误提示和修复建议
 * 4. 支持可选配置和必需配置
 */

class ConfigValidator {
  /**
   * 配置项定义
   */
  static CONFIG_SCHEMA = {
    // 必需配置
    required: {
      GITHUB_TOKEN: {
        description: 'GitHub API访问令牌',
        placeholder: 'ghp_xxxxxxxxxxxx',
        help: '在 https://github.com/settings/tokens 生成，需要 repo 和 public_repo 权限'
      },
      GLM_API_KEY: {
        description: '智谱AI API密钥',
        placeholder: 'your_glm_api_key',
        help: '在 https://open.bigmodel.cn/ 获取'
      },
      NOTION_TOKEN: {
        description: 'Notion集成令牌',
        placeholder: 'secret_xxxxxxxxxxxx',
        help: '在 https://www.notion.so/my-integrations 创建集成并获取'
      },
      NOTION_DATABASE_ID: {
        description: 'Notion数据库ID',
        placeholder: '32位数据库ID',
        help: '在Notion数据库页面URL中获取，或通过集成页面选择数据库'
      }
    },
    // 可选配置（但至少需要配置一个通知渠道）
    notification: {
      QQ_BOT_TOKEN: {
        description: 'QQ机器人令牌（NapCat/go-cqhttp）',
        placeholder: 'your_qq_bot_token'
      },
      QQ_GROUP_ID: {
        description: 'QQ群ID',
        placeholder: 'your_group_id'
      },
      EMAIL_USER: {
        description: '邮件通知用户',
        placeholder: 'your_email@gmail.com'
      },
      EMAIL_PASS: {
        description: '邮件密码/应用密码',
        placeholder: 'your_email_password'
      },
      TELEGRAM_BOT_TOKEN: {
        description: 'Telegram机器人令牌',
        placeholder: 'your_telegram_bot_token'
      },
      TELEGRAM_CHAT_ID: {
        description: 'Telegram聊天ID',
        placeholder: 'your_telegram_chat_id'
      },
      DINGTALK_WEBHOOK: {
        description: '钉钉机器人Webhook',
        placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=xxx'
      },
      FEISHU_WEBHOOK: {
        description: '飞书机器人Webhook',
        placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx'
      },
      SERVERCHAN_SEND_KEY: {
        description: 'Server酱发送密钥',
        placeholder: 'sctpxxxxxxx'
      },
      WEWORK_WEBHOOK: {
        description: '企业微信机器人Webhook',
        placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'
      },
      PUSHPLUS_TOKEN: {
        description: 'PushPlus令牌',
        placeholder: 'your_pushplus_token'
      }
    },
    // 可选配置（有默认值）
    optional: {
      MONITOR_LANGUAGES: {
        description: '监控的编程语言',
        default: 'TypeScript,JavaScript,Vue,React,Next.js',
        help: '多个语言用逗号分隔'
      },
      MIN_STARS: {
        description: '最低星标数',
        default: '100',
        validator: (val) => !isNaN(parseInt(val))
      },
      MIN_GROWTH: {
        description: '最低日增长率',
        default: '5',
        validator: (val) => !isNaN(parseFloat(val))
      },
      AUTO_CLEAN_ENABLED: {
        description: '启用自动清理',
        default: 'true',
        validator: (val) => ['true', 'false'].includes(val.toLowerCase())
      },
      CLEAN_INTERVAL_HOURS: {
        description: '清理间隔（小时）',
        default: '6',
        validator: (val) => !isNaN(parseInt(val))
      },
      MEMORY_THRESHOLD_MB: {
        description: '内存阈值（MB）',
        default: '800',
        validator: (val) => !isNaN(parseInt(val))
      },
      DEEP_ANALYSIS_ENABLED: {
        description: '启用深度分析',
        default: 'true',
        validator: (val) => ['true', 'false'].includes(val.toLowerCase())
      }
    }
  };

  /**
   * 验证所有配置
   * @returns {Object} { valid: boolean, errors: Array, warnings: Array }
   */
  static validate() {
    const errors = [];
    const warnings = [];
    const env = process.env;

    console.log('\n========================================');
    console.log('🔍 配置验证');
    console.log('========================================\n');

    // 1. 验证必需配置
    console.log('[1/3] 检查必需配置...');
    let requiredValid = true;
    for (const [key, config] of Object.entries(this.CONFIG_SCHEMA.required)) {
      if (!env[key] || env[key].trim() === '' || env[key].includes('your_') || env[key].includes('here')) {
        errors.push({
          key,
          message: `缺少必需配置: ${key}`,
          config
        });
        requiredValid = false;
        console.error(`  ✗ ${key} - ${config.description}`);
      } else {
        console.log(`  ✓ ${key} - 已配置`);
      }
    }

    if (requiredValid) {
      console.log('  ✓ 必需配置检查通过');
    } else {
      console.log('  ✗ 必需配置检查失败');
    }

    // 2. 验证通知配置（至少需要配置一个）
    console.log('\n[2/3] 检查通知配置...');
    const notificationKeys = Object.keys(this.CONFIG_SCHEMA.notification);
    const configuredNotifications = notificationKeys.filter(key => {
      const val = env[key];
      return val && val.trim() !== '' && !val.includes('your_') && !val.includes('here');
    });

    if (configuredNotifications.length === 0) {
      warnings.push({
        message: '未配置任何通知渠道，将无法接收每日日报',
        help: '请至少配置一个通知渠道（QQ/邮件/Telegram/钉钉/飞书/微信等）'
      });
      console.log('  ⚠️  未配置任何通知渠道');
    } else {
      console.log(`  ✓ 已配置 ${configuredNotifications.length} 个通知渠道:`);
      configuredNotifications.forEach(key => {
        console.log(`    - ${key}: ${this.CONFIG_SCHEMA.notification[key].description}`);
      });
    }

    // 3. 验证可选配置
    console.log('\n[3/3] 检查可选配置...');
    for (const [key, config] of Object.entries(this.CONFIG_SCHEMA.optional)) {
      const value = env[key] || config.default;
      if (config.validator && !config.validator(value)) {
        warnings.push({
          key,
          message: `配置值无效: ${key} = ${value}`,
          help: config.help || `有效值参考: ${config.default}`
        });
        console.log(`  ⚠️  ${key} = ${value} (可能无效)`);
      } else if (!env[key]) {
        console.log(`  ○ ${key} = ${config.default} (使用默认值)`);
      } else {
        console.log(`  ✓ ${key} = ${value}`);
      }
    }

    // 打印结果
    console.log('\n========================================');
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✓ 配置验证通过！');
    } else {
      if (errors.length > 0) {
        console.log(`✗ 发现 ${errors.length} 个错误`);
      }
      if (warnings.length > 0) {
        console.log(`⚠️  发现 ${warnings.length} 个警告`);
      }
    }
    console.log('========================================\n');

    // 打印详细错误信息
    if (errors.length > 0) {
      console.log('📋 错误详情:\n');
      errors.forEach(err => {
        console.log(`  ❌ ${err.message}`);
        console.log(`     描述: ${err.config.description}`);
        console.log(`     帮助: ${err.config.help}`);
        console.log(`     格式: ${err.key}=${err.config.placeholder}\n`);
      });
    }

    // 打印详细警告信息
    if (warnings.length > 0) {
      console.log('📋 警告详情:\n');
      warnings.forEach(warn => {
        console.log(`  ⚠️  ${warn.message}`);
        if (warn.help) {
          console.log(`     建议: ${warn.help}`);
        }
        if (warn.key) {
          console.log(`     配置: ${warn.key}`);
        }
        console.log();
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 打印配置帮助
   */
  static printHelp() {
    console.log('\n========================================');
    console.log('📖 配置帮助');
    console.log('========================================\n');

    console.log('【必需配置】\n');
    for (const [key, config] of Object.entries(this.CONFIG_SCHEMA.required)) {
      console.log(`  ${key}`);
      console.log(`    描述: ${config.description}`);
      console.log(`    帮助: ${config.help}`);
      console.log();
    }

    console.log('【通知配置（至少配置一个）】\n');
    for (const [key, config] of Object.entries(this.CONFIG_SCHEMA.notification)) {
      console.log(`  ${key}`);
      console.log(`    描述: ${config.description}`);
      console.log();
    }

    console.log('【可选配置】\n');
    for (const [key, config] of Object.entries(this.CONFIG_SCHEMA.optional)) {
      console.log(`  ${key}`);
      console.log(`    描述: ${config.description}`);
      console.log(`    默认值: ${config.default}`);
      if (config.help) {
        console.log(`    帮助: ${config.help}`);
      }
      console.log();
    }

    console.log('========================================\n');
  }
}

module.exports = ConfigValidator;

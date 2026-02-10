/**
 * Cron调度器增强模块
 *
 * 功能：
 * 1. 支持自定义推送时间
 * 2. 支持Cron表达式
 * 3. 支持时区
 * 4. 支持多个定时任务
 */

const cron = require('node-cron');
const { getLogger } = require('./logger');

class CronScheduler {
  constructor() {
    this.logger = getLogger('CronScheduler');
    this.tasks = new Map();
    this.timezone = process.env.TZ || 'Asia/Shanghai';
  }

  /**
   * 解析Cron表达式
   * 支持简化的时间格式：HH:MM
   */
  parseCronExpression(schedule) {
    // 如果是简单的时间格式 HH:MM
    if (schedule.match(/^\d{1,2}:\d{2}$/)) {
      const [hour, minute] = schedule.split(':');
      return `${minute} ${hour} * * *`;
    }

    // 如果已经是标准的cron表达式
    if (schedule.match(/^(\*|\d+|\*\/\d+)(\s+(\*|\d+|\*\/\d+)){4}$/)) {
      return schedule;
    }

    // 默认每天早上8点
    return '0 8 * * *';
  }

  /**
   * 解析时区
   */
  parseTimezone(tz) {
    const validTimezones = [
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Asia/Seoul',
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'UTC'
    ];

    if (validTimezones.includes(tz)) {
      return tz;
    }

    this.logger.warn(`无效的时区: ${tz}，使用默认时区`);
    return 'Asia/Shanghai';
  }

  /**
   * 添加定时任务
   * @param {string} name - 任务名称
   * @param {Function} handler - 任务处理函数
   * @param {Object} options - 配置选项
   */
  addTask(name, handler, options = {}) {
    const {
      schedule = process.env.SCHEDULE || '08:00',
      timezone = process.env.TZ || 'Asia/Shanghai',
      enabled = true,
      description = ''
    } = options;

    if (!enabled) {
      this.logger.info(`任务已禁用: ${name}`);
      return;
    }

    // 移除已存在的同名任务
    this.removeTask(name);

    const cronExpression = this.parseCronExpression(schedule);
    const tz = this.parseTimezone(timezone);

    const task = cron.schedule(cronExpression, () => {
      this.logger.info(`执行定时任务: ${name}`);
      handler().catch(error => {
        this.logger.error(`定时任务执行失败: ${name}`, error);
      });
    }, {
      scheduled: false,
      timezone: tz
    });

    this.tasks.set(name, {
      task,
      schedule,
      timezone: tz,
      cronExpression,
      description
    });

    // 启动任务
    task.start();

    this.logger.info(`已添加定时任务: ${name} (${cronExpression}) ${tz}`);
  }

  /**
   * 移除任务
   */
  removeTask(name) {
    if (this.tasks.has(name)) {
      const { task } = this.tasks.get(name);
      task.stop();
      this.tasks.delete(name);
      this.logger.info(`已移除定时任务: ${name}`);
    }
  }

  /**
   * 启动任务
   */
  startTask(name) {
    if (this.tasks.has(name)) {
      const { task } = this.tasks.get(name);
      task.start();
      this.logger.info(`已启动定时任务: ${name}`);
    }
  }

  /**
   * 停止任务
   */
  stopTask(name) {
    if (this.tasks.has(name)) {
      const { task } = this.tasks.get(name);
      task.stop();
      this.logger.info(`已停止定时任务: ${name}`);
    }
  }

  /**
   * 获取所有任务
   */
  getTasks() {
    const tasks = {};
    this.tasks.forEach((value, key) => {
      tasks[key] = {
        schedule: value.schedule,
        timezone: value.timezone,
        cronExpression: value.cronExpression,
        description: value.description,
        running: value.task.getStatus() === 'scheduled'
      };
    });
    return tasks;
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(name) {
    if (this.tasks.has(name)) {
      const { task, ...info } = this.tasks.get(name);
      return {
        ...info,
        running: task.getStatus() === 'scheduled'
      };
    }
    return null;
  }

  /**
   * 更新任务调度
   */
  updateTask(name, options = {}) {
    if (this.tasks.has(name)) {
      const { task, handler } = this.tasks.get(name);

      // 停止旧任务
      task.stop();

      // 添加新任务
      this.addTask(name, handler, options);
    }
  }

  /**
   * 停止所有任务
   */
  stopAll() {
    this.tasks.forEach(({ task }, name) => {
      task.stop();
      this.logger.info(`已停止任务: ${name}`);
    });
  }

  /**
   * 启动所有任务
   */
  startAll() {
    this.tasks.forEach(({ task }, name) => {
      task.start();
      this.logger.info(`已启动任务: ${name}`);
    });
  }

  /**
   * 清除所有任务
   */
  clear() {
    this.stopAll();
    this.tasks.clear();
  }

  /**
   * 获取下次执行时间（近似值）
   */
  getNextRunTime(name) {
    if (!this.tasks.has(name)) {
      return null;
    }

    const { schedule, timezone } = this.tasks.get(name);
    // 这里简化处理，实际应该根据cron表达式计算
    // 返回下次执行时间的描述
    return `${schedule} (${timezone})`;
  }

  /**
   * 验证Cron表达式
   */
  validateCronExpression(expression) {
    try {
      const parts = expression.trim().split(/\s+/);
      if (parts.length !== 5) {
        return { valid: false, error: 'Cron表达式必须有5个部分' };
      }

      // 简单验证
      const [minute, hour, day, month, weekday] = parts;

      if (!this.isValidCronField(minute, 0, 59)) {
        return { valid: false, error: '分钟字段无效' };
      }
      if (!this.isValidCronField(hour, 0, 23)) {
        return { valid: false, error: '小时字段无效' };
      }
      if (!this.isValidCronField(day, 1, 31)) {
        return { valid: false, error: '日字段无效' };
      }
      if (!this.isValidCronField(month, 1, 12)) {
        return { valid: false, error: '月字段无效' };
      }
      if (!this.isValidCronField(weekday, 0, 6)) {
        return { valid: false, error: '星期字段无效' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 验证Cron字段
   */
  isValidCronField(field, min, max) {
    // 支持通配符、数字、列表、范围、步长
    const patterns = [
      /^\*$/,                          // *
      /^\*\/\d+$/,                     // */n
      /^\d+$/,                         // n
      /^\d+-\d+$/,                     // n-m
      /^(\d+,)+\d+$/,                  // n,m,o
      /^(\d+-\d+,)+\d+-\d+$/,          // n-m,o-p
      /^\*\/\d+\/\d+$/                 // */n/m
    ];

    return patterns.some(p => p.test(field));
  }

  /**
   * 格式化任务列表为可读文本
   */
  formatTaskList() {
    const lines = ['定时任务列表:', ''];

    this.tasks.forEach((value, name) => {
      const { schedule, timezone, cronExpression, description } = value;
      lines.push(`📌 ${name}`);
      lines.push(`   调度: ${cronExpression}`);
      lines.push(`   时间: ${schedule} (${timezone})`);
      if (description) {
        lines.push(`   说明: ${description}`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * 导出任务配置
   */
  exportConfig() {
    const config = {};

    this.tasks.forEach((value, name) => {
      config[name] = {
        schedule: value.schedule,
        timezone: value.timezone,
        description: value.description
      };
    });

    return config;
  }
}

module.exports = CronScheduler;

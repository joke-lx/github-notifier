/**
 * 统一日志工具
 *
 * 核心功能：
 * 1. 统一的日志格式
 * 2. 日志级别控制
 * 3. 彩色控制台输出
 * 4. 文件日志持久化
 * 5. 错误堆栈追踪
 */

const fs = require('fs');
const path = require('path');

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// 日志级别
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 4
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || LogLevel.INFO;
    this.logFile = options.logFile || path.join(process.cwd(), 'logs/app.log');
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile || false;
    this.context = options.context || 'App';

    // 确保日志目录存在
    if (this.enableFile) {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * 格式化时间戳
   */
  getTimestamp() {
    const now = new Date();
    return now.toISOString();
  }

  /**
   * 格式化日志消息
   */
  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    const levelStr = this.getLevelString(level);
    let formatted = `[${timestamp}] [${levelStr}] [${this.context}] ${message}`;

    if (data) {
      if (typeof data === 'object') {
        formatted += '\n' + JSON.stringify(data, null, 2);
      } else {
        formatted += ' ' + data;
      }
    }

    return formatted;
  }

  /**
   * 获取日志级别字符串
   */
  getLevelString(level) {
    const levels = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR',
      [LogLevel.SUCCESS]: 'SUCCESS'
    };
    return levels[level] || 'INFO';
  }

  /**
   * 获取日志级别颜色
   */
  getLevelColor(level) {
    const levelColors = {
      [LogLevel.DEBUG]: colors.gray,
      [LogLevel.INFO]: colors.blue,
      [LogLevel.WARN]: colors.yellow,
      [LogLevel.ERROR]: colors.red,
      [LogLevel.SUCCESS]: colors.green
    };
    return levelColors[level] || colors.reset;
  }

  /**
   * 写入日志
   */
  write(level, message, data = null) {
    const formattedMsg = this.formatMessage(level, message, data);

    // 控制台输出（带颜色）
    if (this.enableConsole && level >= this.level) {
      const color = this.getLevelColor(level);
      const icon = this.getLevelIcon(level);
      console.log(`${color}${icon} ${message}${colors.reset}`);
      if (data && level >= LogLevel.WARN) {
        console.log(colors.gray + JSON.stringify(data, null, 2) + colors.reset);
      }
    }

    // 文件输出
    if (this.enableFile && level >= this.level) {
      try {
        fs.appendFileSync(this.logFile, formattedMsg + '\n');
      } catch (error) {
        // 防止日志写入失败导致应用崩溃
        console.error('写入日志文件失败:', error.message);
      }
    }
  }

  /**
   * 获取日志级别图标
   */
  getLevelIcon(level) {
    const icons = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.SUCCESS]: '✅'
    };
    return icons[level] || '•';
  }

  // 日志级别方法
  debug(message, data) {
    this.write(LogLevel.DEBUG, message, data);
  }

  info(message, data) {
    this.write(LogLevel.INFO, message, data);
  }

  warn(message, data) {
    this.write(LogLevel.WARN, message, data);
  }

  error(message, error = null) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      code: error.code,
      status: error.response?.status
    } : null;
    this.write(LogLevel.ERROR, message, errorData);
  }

  success(message, data) {
    this.write(LogLevel.SUCCESS, message, data);
  }

  /**
   * 创建子logger（带不同context）
   */
  child(childContext) {
    return new Logger({
      level: this.level,
      logFile: this.logFile,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
      context: childContext
    });
  }
}

// 全局logger实例
let globalLogger = null;

/**
 * 初始化全局logger
 */
function initLogger(options = {}) {
  globalLogger = new Logger(options);
  return globalLogger;
}

/**
 * 获取全局logger
 */
function getLogger(context) {
  if (context) {
    return globalLogger ? globalLogger.child(context) : new Logger({ context });
  }
  return globalLogger || new Logger();
}

// 错误处理工具
class ErrorHandler {
  /**
   * 包装异步函数，自动处理错误
   */
  static async handle(fn, context = 'Operation') {
    try {
      return await fn();
    } catch (error) {
      const logger = getLogger(context);
      logger.error(`${context} failed`, error);
      throw error;
    }
  }

  /**
   * 包装异步函数，返回错误而非抛出
   */
  static async safe(fn, context = 'Operation') {
    try {
      return [await fn(), null];
    } catch (error) {
      const logger = getLogger(context);
      logger.error(`${context} failed`, error);
      return [null, error];
    }
  }

  /**
   * 创建Express中间件风格的错误处理器
   */
  static middleware(handler) {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        const logger = getLogger('HTTP');
        logger.error('Request failed', error);
        res.status(500).json({
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }
}

module.exports = {
  Logger,
  LogLevel,
  initLogger,
  getLogger,
  ErrorHandler
};

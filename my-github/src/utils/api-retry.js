/**
 * API重试工具
 *
 * 核心功能：
 * 1. 指数退避重试策略
 * 2. 最大重试次数限制
 * 3. 可配置的重试条件
 * 4. 详细的日志记录
 */

class APIRetry {
  /**
   * 带重试的异步函数执行
   *
   * @param {Function} fn - 要执行的异步函数
   * @param {Object} options - 配置选项
   * @param {number} options.maxRetries - 最大重试次数（默认3）
   * @param {number} options.baseDelay - 基础延迟时间ms（默认1000）
   * @param {Function} options.shouldRetry - 判断是否应该重试的函数
   * @param {string} options.context - 错误日志上下文
   * @returns {Promise<any>} - 函数执行结果
   */
  static async withRetry(fn, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      shouldRetry = () => true,
      context = 'API调用'
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`  ↻ ${context} 重试 ${attempt}/${maxRetries}，等待 ${delay}ms...`);
          await this.sleep(delay);
        }

        const result = await fn();

        if (attempt > 0) {
          console.log(`  ✓ ${context} 重试成功`);
        }

        return result;

      } catch (error) {
        lastError = error;

        // 检查是否应该重试
        const isRetryable = this.isRetryableError(error) && shouldRetry(error);

        if (!isRetryable || attempt === maxRetries) {
          // 不可重试的错误，或已达最大重试次数
          console.error(`  ✗ ${context} 失败: ${error.message}`);
          throw error;
        }

        console.warn(`  ⚠️  ${context} 失败 (尝试 ${attempt + 1}/${maxRetries + 1}): ${error.message}`);
      }
    }

    throw lastError;
  }

  /**
   * 判断错误是否可重试
   */
  static isRetryableError(error) {
    // 网络错误
    if (error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'EAI_AGAIN') {
      return true;
    }

    // HTTP状态码错误
    if (error.response) {
      const status = error.response.status;
      // 429 Too Many Requests - 限流
      // 500, 502, 503, 504 - 服务器错误
      if (status === 429 || status >= 500) {
        return true;
      }
    }

    // 超时错误
    if (error.message && error.message.includes('timeout')) {
      return true;
    }

    return false;
  }

  /**
   * 延迟执行
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 为axios创建带重试的请求包装器
   */
  static wrapAxios(axiosInstance, options = {}) {
    const wrapped = async (config) => {
      return this.withRetry(async () => {
        return axiosInstance(config);
      }, {
        ...options,
        context: config.method?.toUpperCase() + ' ' + config.url
      });
    };

    // 保留axios的原型方法
    wrapped.get = (url, config) => wrapped({ ...config, method: 'GET', url });
    wrapped.post = (url, data, config) => wrapped({ ...config, method: 'POST', url, data });

    return wrapped;
  }
}

module.exports = APIRetry;

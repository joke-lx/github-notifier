/**
 * 并发处理工具
 *
 * 核心功能：
 * 1. 控制并发数量
 * 2. 批量处理任务
 * 3. 进度跟踪
 * 4. 错误处理
 */

const { getLogger } = require('./logger');

class ConcurrentProcessor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || 3;
    this.logger = getLogger('Concurrent');
  }

  /**
   * 并发处理数组中的任务
   * @param {Array} items - 要处理的项目数组
   * @param {Function} handler - 处理函数，接收(item, index)参数
   * @param {Object} options - 配置选项
   * @returns {Promise<Array>} - 处理结果数组
   */
  async process(items, handler, options = {}) {
    const {
      maxConcurrency = this.maxConcurrency,
      onProgress = null,
      stopOnError = false,
      itemName = '项目'
    } = options;

    if (!items || items.length === 0) {
      return [];
    }

    this.logger.info(`开始并发处理 ${items.length} 个${itemName}，并发数: ${maxConcurrency}`);

    const results = [];
    const errors = [];
    let currentIndex = 0;
    let completedCount = 0;
    let activeCount = 0;

    const processItem = async (index) => {
      activeCount++;
      const item = items[index];

      try {
        const result = await handler(item, index);
        results[index] = result;

        completedCount++;
        if (onProgress) {
          onProgress(completedCount, items.length, item);
        } else {
          this.logger.debug(`[${completedCount}/${items.length}] ${itemName}处理完成`);
        }

        return result;
      } catch (error) {
        errors.push({ index, item, error });
        this.logger.warn(`${itemName}处理失败 [${index + 1}/${items.length}]`, error);

        if (stopOnError) {
          throw error;
        }
      } finally {
        activeCount--;
      }
    };

    // 创建工作池
    const workers = [];
    for (let i = 0; i < Math.min(maxConcurrency, items.length); i++) {
      workers.push(this.worker(items, currentIndex, processItem, () => currentIndex < items.length));
    }

    // 等待所有worker完成
    await Promise.all(workers);

    this.logger.info(`并发处理完成: 成功 ${completedCount - errors.length}/${items.length}`);

    if (errors.length > 0 && !stopOnError) {
      this.logger.warn(`${errors.length} 个${itemName}处理失败`);
    }

    return results.filter(r => r !== undefined);
  }

  /**
   * Worker函数
   */
  async worker(items, currentIndexRef, processItem, hasMore) {
    while (hasMore()) {
      const index = currentIndexRef++;
      if (index >= items.length) break;

      await processItem(index);
    }
  }

  /**
   * 批量处理（分批执行）
   * @param {Array} items - 要处理的项目
   * @param {Function} handler - 处理函数
   * @param {number} batchSize - 每批数量
   */
  async processBatch(items, handler, batchSize = 5) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    this.logger.info(`分 ${batches.length} 批处理 ${items.length} 个项目`);

    const results = [];
    for (let i = 0; i < batches.length; i++) {
      this.logger.debug(`处理批次 ${i + 1}/${batches.length}`);
      const batchResults = await Promise.all(
        batches[i].map((item, idx) => handler(item, i * batchSize + idx))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 带重试的并发处理
   */
  async processWithRetry(items, handler, options = {}) {
    const {
      maxRetries = 2,
      retryDelay = 1000,
      ...otherOptions
    } = options;

    const results = [];
    const failed = [];

    // 首次处理
    const firstResults = await this.process(items, handler, otherOptions);

    // 收集失败项
    items.forEach((item, index) => {
      if (firstResults[index] !== undefined) {
        results[index] = firstResults[index];
      } else {
        failed.push({ item, index });
      }
    });

    // 重试失败项
    if (failed.length > 0 && maxRetries > 0) {
      this.logger.info(`重试 ${failed.length} 个失败项目`);

      for (let retry = 1; retry <= maxRetries; retry++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * retry));

        const retryItems = failed.map(f => f.item);
        const retryResults = await this.process(retryItems, handler, otherOptions);

        // 更新结果
        let stillFailed = 0;
        retryResults.forEach((result, i) => {
          if (result !== undefined) {
            results[failed[i].index] = result;
          } else {
            stillFailed++;
          }
        });

        if (stillFailed === 0) break;
      }
    }

    return results.filter(r => r !== undefined);
  }
}

module.exports = ConcurrentProcessor;

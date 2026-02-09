/**
 * API缓存系统
 *
 * 核心功能：
 * 1. 内存缓存（支持过期时间）
 * 2. 持久化缓存（可选）
 * 3. 缓存键管理
 * 4. 缓存统计
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getLogger } = require('./logger');

class APICache {
  constructor(options = {}) {
    this.ttl = options.ttl || 3600000; // 默认1小时
    this.maxSize = options.maxSize || 1000;
    this.enablePersist = options.enablePersist || false;
    this.cacheDir = options.cacheDir || path.join(process.cwd(), 'data/cache');
    this.logger = getLogger('Cache');

    this.memoryCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // 加载持久化缓存
    if (this.enablePersist) {
      this.loadPersistedCache();
    }
  }

  /**
   * 生成缓存键
   */
  generateKey(prefix, data) {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(data))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * 设置缓存
   */
  set(key, value, ttl = null) {
    const expiry = Date.now() + (ttl || this.ttl);

    // 检查缓存大小
    if (this.memoryCache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.memoryCache.set(key, {
      value,
      expiry,
      createdAt: Date.now()
    });

    this.stats.sets++;

    // 持久化
    if (this.enablePersist) {
      this.persistCache(key, { value, expiry });
    }

    this.logger.debug(`缓存已设置: ${key}`);
  }

  /**
   * 获取缓存
   */
  get(key) {
    const entry = this.memoryCache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiry) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    this.logger.debug(`缓存命中: ${key}`);
    return entry.value;
  }

  /**
   * 删除缓存
   */
  delete(key) {
    const deleted = this.memoryCache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      if (this.enablePersist) {
        this.removePersistedCache(key);
      }
    }
    return deleted;
  }

  /**
   * 清空缓存
   */
  clear() {
    const size = this.memoryCache.size;
    this.memoryCache.clear();

    if (this.enablePersist) {
      this.clearPersistedCache();
    }

    this.logger.info(`已清空 ${size} 个缓存项`);
  }

  /**
   * 淘汰最旧的缓存
   */
  evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.logger.debug(`淘汰旧缓存: ${oldestKey}`);
    }
  }

  /**
   * 包装异步函数，自动使用缓存
   */
  async wrap(key, fn, ttl = null) {
    // 尝试从缓存获取
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // 执行函数
    const result = await fn();

    // 存入缓存
    this.set(key, result, ttl);

    return result;
  }

  /**
   * 批量设置缓存
   */
  setMany(items, ttl = null) {
    items.forEach(({ key, value }) => {
      this.set(key, value, ttl);
    });
  }

  /**
   * 批量获取缓存
   */
  getMany(keys) {
    return keys.map(key => this.get(key));
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      size: this.memoryCache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      memoryUsage: `${(JSON.stringify([...this.memoryCache.values()]).length / 1024).toFixed(2)} KB`
    };
  }

  /**
   * 打印统计信息
   */
  logStats() {
    const stats = this.getStats();
    this.logger.info('缓存统计:', stats);
  }

  /**
   * 持久化缓存到文件
   */
  persistCache(key, data) {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const filename = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filepath = path.join(this.cacheDir, `${filename}.json`);

      fs.writeFileSync(filepath, JSON.stringify(data));
    } catch (error) {
      this.logger.warn('持久化缓存失败', error);
    }
  }

  /**
   * 从文件加载缓存
   */
  loadPersistedCache() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return;
      }

      const files = fs.readdirSync(this.cacheDir);
      let loaded = 0;

      files.forEach(file => {
        if (file.endsWith('.json')) {
          try {
            const filepath = path.join(this.cacheDir, file);
            const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

            // 检查是否过期
            if (Date.now() <= data.expiry) {
              const key = file.replace('.json', '').replace(/_/g, ':');
              this.memoryCache.set(key, data);
              loaded++;
            } else {
              fs.unlinkSync(filepath);
            }
          } catch (error) {
            this.logger.warn(`加载缓存失败: ${file}`, error);
          }
        }
      });

      this.logger.info(`从持久化加载了 ${loaded} 个缓存项`);
    } catch (error) {
      this.logger.error('加载持久化缓存失败', error);
    }
  }

  /**
   * 删除持久化缓存文件
   */
  removePersistedCache(key) {
    try {
      const filename = key.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filepath = path.join(this.cacheDir, `${filename}.json`);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (error) {
      this.logger.warn('删除持久化缓存失败', error);
    }
  }

  /**
   * 清空所有持久化缓存
   */
  clearPersistedCache() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return;
      }

      const files = fs.readdirSync(this.cacheDir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      });
    } catch (error) {
      this.logger.error('清空持久化缓存失败', error);
    }
  }

  /**
   * 清理过期缓存
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiry) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info(`清理了 ${cleaned} 个过期缓存`);
    }

    this.logStats();
  }
}

// 创建全局缓存实例
let globalCache = null;

/**
 * 初始化全局缓存
 */
function initCache(options = {}) {
  globalCache = new APICache(options);
  return globalCache;
}

/**
 * 获取全局缓存
 */
function getCache() {
  return globalCache || new APICache();
}

module.exports = {
  APICache,
  initCache,
  getCache
};

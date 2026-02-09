/**
 * 内存自动清理工具
 *
 * 核心原理：
 * 1. Node.js 垃圾回收机制手动触发
 * 2. 清理日志文件防止磁盘占用
 * 3. 清理 npm 缓存
 * 4. 系统内存监控与警告
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MemoryCleaner {
  constructor() {
    this.enabled = process.env.AUTO_CLEAN_ENABLED === 'true';
    this.cleanIntervalHours = parseInt(process.env.CLEAN_INTERVAL_HOURS) || 6;
    this.memoryThreshold = parseInt(process.env.MEMORY_THRESHOLD_MB) || 800;
    this.logRetentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 7;

    if (this.enabled) {
      this.startAutoCleanup();
    }
  }

  /**
   * 获取当前内存使用情况（MB）
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }

  /**
   * 获取系统内存使用情况
   */
  getSystemMemory() {
    try {
      const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const lines = memInfo.split('\n');

      const memTotal = parseInt(lines.find(l => l.startsWith('MemTotal'))?.split(/\s+/)[1] || 0) / 1024;
      const memAvailable = parseInt(lines.find(l => l.startsWith('MemAvailable'))?.split(/\s+/)[1] || 0) / 1024;
      const memFree = parseInt(lines.find(l => l.startsWith('MemFree'))?.split(/\s+/)[1] || 0) / 1024;
      const memCached = parseInt(lines.find(l => l.startsWith('Cached'))?.split(/\s+/)[1] || 0) / 1024;

      return {
        total: Math.round(memTotal),
        available: Math.round(memAvailable),
        free: Math.round(memFree),
        cached: Math.round(memCached),
        used: Math.round(memTotal - memAvailable),
        usagePercent: Math.round(((memTotal - memAvailable) / memTotal) * 100)
      };
    } catch (error) {
      console.warn('无法获取系统内存信息');
      return null;
    }
  }

  /**
   * 手动触发垃圾回收
   *
   * 原理：Node.js 需要启动参数 --expose-gc 才能使用 global.gc()
   */
  forceGarbageCollection() {
    if (typeof global.gc === 'function') {
      const before = this.getMemoryUsage();
      global.gc();
      const after = this.getMemoryUsage();

      console.log(`  GC: RSS ${before.rss}MB → ${after.rss}MB (节省 ${before.rss - after.rss}MB)`);
      return after;
    } else {
      console.warn('  global.gc 不可用，需要使用 --expose-gc 启动 Node.js');
      return null;
    }
  }

  /**
   * 清理旧日志文件
   */
  cleanOldLogs() {
    const logsDir = path.join(__dirname, '../../logs');
    const now = Date.now();
    const maxAge = this.logRetentionDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    try {
      if (!fs.existsSync(logsDir)) {
        return 0;
      }

      const files = fs.readdirSync(logsDir);

      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile() && (now - stats.mtimeMs) > maxAge) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`  清理了 ${cleaned} 个过期日志文件`);
      }
    } catch (error) {
      console.error('  清理日志失败:', error.message);
    }

    return cleaned;
  }

  /**
   * 清理临时代码目录
   */
  async cleanupTempCode() {
    const tempDir = process.env.TEMP_CODE_DIR || '/tmp/github-analysis';

    try {
      if (!fs.existsSync(tempDir)) {
        return 0;
      }

      const repos = fs.readdirSync(tempDir);
      let cleaned = 0;

      for (const repo of repos) {
        const repoPath = path.join(tempDir, repo);

        try {
          // 检查目录年龄 (超过1小时自动清理)
          const stats = fs.statSync(repoPath);
          const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

          if (ageHours > 1) {
            await this.forceDeleteDirectory(repoPath);
            cleaned++;
            console.log(`  清理过期代码: ${repo}`);
          }
        } catch (error) {
          // 强制删除失败的目录
          await this.forceDeleteDirectory(repoPath).catch(() => {});
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`  ✓ 清理了 ${cleaned} 个临时代码目录`);
      }

      return cleaned;
    } catch (error) {
      console.error('  清理临时代码失败:', error.message);
      return 0;
    }
  }

  /**
   * 强制删除目录
   */
  async forceDeleteDirectory(dirPath) {
    try {
      if (fs.promises.rm) {
        await fs.promises.rm(dirPath, { recursive: true, force: true });
      } else {
        execSync(`rm -rf "${dirPath}"`, { stdio: 'ignore' });
      }
    } catch (error) {
      // 忽略失败
    }
  }

  /**
   * 清理系统缓存
   */
  cleanSystemCache() {
    try {
      // 清理页面缓存、目录项和inode
      execSync('sync && echo 3 > /proc/sys/vm/drop_caches', { stdio: 'ignore' });
      console.log('  系统缓存已清理');
    } catch (error) {
      console.warn('  清理系统缓存失败（需要 root 权限）');
    }
  }

  /**
   * 执行完整清理
   */
  async cleanup() {
    console.log('\n🧹 开始内存清理...');

    const mem = this.getMemoryUsage();
    const sysMem = this.getSystemMemory();

    console.log(`  进程内存: RSS=${mem.rss}MB, Heap=${mem.heapUsed}MB/${mem.heapTotal}MB`);
    if (sysMem) {
      console.log(`  系统内存: ${sysMem.used}MB/${sysMem.total}MB (${sysMem.usagePercent}% 已用)`);
    }

    // 1. 强制垃圾回收
    this.forceGarbageCollection();

    // 2. 清理旧日志
    this.cleanOldLogs();

    // 3. 清理临时代码目录
    await this.cleanupTempCode();

    // 4. 如果系统内存使用超过阈值，清理系统缓存
    if (sysMem && sysMem.usagePercent > 70) {
      this.cleanSystemCache();
    }

    const afterMem = this.getMemoryUsage();
    console.log(`  清理完成: RSS=${mem.rss}MB → ${afterMem.rss}MB`);
  }

  /**
   * 启动自动清理定时任务
   */
  startAutoCleanup() {
    const intervalMs = this.cleanIntervalHours * 60 * 60 * 1000;

    console.log(`✓ 自动清理已启用: 每 ${this.cleanIntervalHours} 小时执行一次`);

    setInterval(() => {
      this.cleanup();
    }, intervalMs);

    // 首次延迟执行
    setTimeout(() => this.cleanup(), 60000);
  }

  /**
   * 内存监控检查
   */
  checkMemoryThreshold() {
    const mem = this.getMemoryUsage();

    if (mem.rss > this.memoryThreshold) {
      console.warn(`⚠️  内存使用过高: ${mem.rss}MB > ${this.memoryThreshold}MB`);
      this.cleanup();
      return true;
    }

    return false;
  }
}

// 如果直接运行此文件，执行清理
if (require.main === module) {
  const cleaner = new MemoryCleaner();
  cleaner.cleanup();
}

module.exports = MemoryCleaner;

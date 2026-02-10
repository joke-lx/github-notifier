require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const ConfigValidator = require('./utils/config-validator');
const GitHubCollector = require('./collectors/github');
const UnifiedCollector = require('./collectors/unified');
const GLMAnalyzer = require('./analyzers/glm');
const DataAnalyzer = require('./analyzers/data-analyzer');
const NotionClient = require('./notion/client');
const QQNapcatNotifier = require('./notifiers/qq-napcat');
const EmailNotifier = require('./notifiers/email');
const MemoryCleaner = require('./utils/cleanup');
const CodeManager = require('./utils/code-manager');
const ConcurrentProcessor = require('./utils/concurrent');
const { initCache } = require('./utils/cache');
const CronScheduler = require('./utils/scheduler');

/**
 * GitHub 技术日报调度器
 *
 * 核心原理：
 * 1. 定时任务：每天早上 8 点执行
 * 2. 数据流：GitHub API → GLM 分析 → Notion 存储 → QQ 推送
 * 3. 内存管理：自动垃圾回收和日志清理
 * 4. 容错机制：单步失败不影响整体流程
 */
class TechDailyScheduler {
  constructor() {
    // 使用统一采集器
    this.unifiedCollector = new UnifiedCollector();
    this.githubCollector = new GitHubCollector(); // 保留兼容性
    this.glmAnalyzer = new GLMAnalyzer();
    this.dataAnalyzer = new DataAnalyzer();
    this.notionClient = new NotionClient();
    this.qqNotifier = new QQNapcatNotifier();
    this.emailNotifier = new EmailNotifier();
    this.memoryCleaner = new MemoryCleaner();
    this.codeManager = new CodeManager();

    // 性能优化工具
    this.concurrent = new ConcurrentProcessor({ maxConcurrency: 3 });
    this.cache = initCache({
      ttl: 1800000, // 30分钟
      maxSize: 500,
      enablePersist: true
    });

    // Cron调度器
    this.scheduler = new CronScheduler();

    this.startTime = null;
    this.logFile = path.join(__dirname, '../logs/daily.log');
  }

  /**
   * 每日任务执行流程
   */
  async runDailyTask() {
    this.startTime = Date.now();
    const timestamp = new Date().toLocaleString('zh-CN');

    this.log('='.repeat(60));
    this.log(`开始执行每日任务: ${timestamp}`);
    this.log('='.repeat(60));

    try {
      // Step 1: 内存检查
      this.log('\n[0/6] 检查内存状态...');
      this.memoryCleaner.checkMemoryThreshold();
      const mem = this.memoryCleaner.getMemoryUsage();
      const sysMem = this.memoryCleaner.getSystemMemory();
      this.log(`  进程: RSS=${mem.rss}MB, Heap=${mem.heapUsed}MB`);
      if (sysMem) {
        this.log(`  系统: ${sysMem.used}MB/${sysMem.total}MB (${sysMem.usagePercent}%)`);
      }

      // Step 2: 采集数据
      this.log('\n[1/6] 采集 GitHub 热门仓库...');
      const trendingRepos = await this.githubCollector.getTrendingRepos();
      this.log(`  ✓ 找到 ${trendingRepos.length} 个热门仓库`);
      trendingRepos.forEach(repo => {
        this.log(`    - ${repo.full_name}: ${repo.stargazers_count}★ (+${repo.growthRate.toFixed(2)}/天)`);
      });

      if (trendingRepos.length === 0) {
        this.log('  ⚠️  未找到符合条件的仓库，任务结束');
        return;
      }

      // Step 3: 深度分析仓库代码（并发处理）
      this.log('\n[2/7] 深度分析仓库代码（并发处理）...');

      // 使用并发处理器分析仓库
      const analysisResults = await this.concurrent.process(
        trendingRepos,
        async (repo, index) => {
          const repoPath = `${repo.owner?.login || repo.full_name.split('/')[0]}/${repo.name}`;
          this.log(`  [${index + 1}/${trendingRepos.length}] 深度分析: ${repoPath}...`);

          let clonedDir = null;

          try {
            // 检查缓存
            const cacheKey = this.cache.generateKey('analysis', {
              name: repo.full_name,
              updated: repo.updated_at
            });

            const cached = this.cache.get(cacheKey);
            if (cached) {
              this.log(`    ↻ 使用缓存分析`);
              return cached;
            }

            // 3.1 Git Clone
            this.log(`    - 克隆代码...`);
            clonedDir = await this.codeManager.cloneRepository(repo.html_url + '.git', repo.full_name);

            // 3.2 提取代码结构
            this.log(`    - 提取代码结构...`);
            const files = await this.codeManager.getRelevantFiles(clonedDir);
            this.log(`    ✓ 找到 ${files.length} 个相关文件`);

            const codeStructure = await this.codeManager.extractCodeStructure(files, 3000);
            this.log(`    ✓ 提取了 ${codeStructure.keyFiles.length} 个核心文件`);

            // 3.3 获取 README (作为补充)
            const readme = await this.githubCollector.getReadme(
              repo.owner?.login || repo.full_name.split('/')[0],
              repo.name
            );

            // 3.4 深度分析
            this.log(`    - AI 深度分析...`);
            const analysis = await this.glmAnalyzer.analyzeRepositoryDeep(repo, codeStructure, readme);

            const result = {
              name: repo.full_name,
              url: repo.html_url,
              language: repo.language,
              growthRate: repo.growthRate,
              stargazers_count: repo.stargazers_count,
              description: repo.description,
              analysis: analysis,
              codeFilesAnalyzed: codeStructure.keyFiles.length,
              summary: analysis.split('\n').find(l => l.includes('原理深度解析')) || ''
            };

            // 缓存结果
            this.cache.set(cacheKey, result);

            this.log(`    ✓ 深度分析完成`);
            return result;

          } catch (error) {
            this.log(`    ✗ 深度分析失败: ${error.message}`);

            // 降级到基础分析 (仅 README)
            try {
              this.log(`    - 降级到 README 分析...`);
              const readme = await this.githubCollector.getReadme(
                repo.owner?.login || repo.full_name.split('/')[0],
                repo.name
              );
              const analysis = await this.glmAnalyzer.analyzeRepository(repo, readme);

              const result = {
                name: repo.full_name,
                url: repo.html_url,
                language: repo.language,
                growthRate: repo.growthRate,
                stargazers_count: repo.stargazers_count,
                description: repo.description,
                analysis: analysis,
                codeFilesAnalyzed: 0,
                summary: analysis.split('\n').find(l => l.includes('原理深度解析')) || ''
              };

              this.log(`    ✓ 基础分析完成`);
              return result;
            } catch (fallbackError) {
              this.log(`    ✗ 基础分析也失败: ${fallbackError.message}`);
              // 添加一个基础条目，确保不会丢失数据
              return {
                name: repo.full_name,
                url: repo.html_url,
                language: repo.language,
                growthRate: repo.growthRate,
                stargazers_count: repo.stargazers_count,
                description: repo.description,
                analysis: `# ${repo.full_name}\n\n> **原理深度解析**：分析失败，请手动查看仓库了解详情。\n\n## 基本信息\n- **语言**：${repo.language}\n- **星标**：${repo.stargazers_count}\n- **描述**：${repo.description || '暂无描述'}`,
                codeFilesAnalyzed: 0,
                summary: ''
              };
            }
          } finally {
            // 3.5 立即清理代码（关键!）
            if (clonedDir) {
              try {
                this.log(`    - 清理临时代码...`);
                await this.codeManager.cleanupDirectory(clonedDir);
                this.log(`    ✓ 清理完成`);
              } catch (cleanupError) {
                this.log(`    ⚠️  清理失败: ${cleanupError.message}`);
              }
            }

            // 强制垃圾回收
            if (typeof global.gc === 'function') {
              global.gc();
            }
          }
        },
        {
          maxConcurrency: 3, // 同时分析3个仓库
          onProgress: (completed, total) => {
            this.log(`  进度: ${completed}/${total} 仓库已分析`);
          },
          itemName: '仓库'
        }
      );

      // Step 4: 生成每日总结
      this.log('\n[3/7] 生成每日总结...');
      const summary = await this.glmAnalyzer.generateDailySummary(analysisResults);
      this.log(`  ✓ 总结已生成`);

      // Step 4.5: 数据分析和趋势
      this.log('\n[3.5/7] 分析数据和趋势...');
      const trends = this.dataAnalyzer.analyzeTrends(analysisResults);
      const techReport = this.dataAnalyzer.generateTechReport(analysisResults, trends);
      this.log(`  ✓ ${trends.summary}`);
      this.log(`  ✓ Top语言: ${techReport.topLanguages.slice(0, 3).map(l => l.language).join(', ')}`);

      // 保存今日数据到历史
      this.dataAnalyzer.saveDailyReport(analysisResults);

      // Step 5: 同步到 Notion
      this.log('\n[4/7] 同步到 Notion...');
      let notionUrl = null;
      try {
        const date = new Date().toISOString().split('T')[0];
        notionUrl = await this.notionClient.createDailyReport(date, analysisResults);
        this.log(`  ✓ Notion 页面已创建`);
      } catch (notionError) {
        this.log(`  ⚠️  Notion 同步失败: ${notionError.message}`);
        this.log(`  ℹ️  继续执行通知步骤...`);
        // Notion 失败不中断流程，继续发送通知
      }

      // Step 6: 发送通知
      this.log('\n[5/7] 发送通知...');
      let notificationSuccess = false;
      try {
        this.log('  - QQ 群通知...');
        await this.qqNotifier.sendDailySummary(summary);
        this.log('  - 邮件通知...');
        await this.emailNotifier.sendNotification(summary);
        this.log('  ✓ 通知发送完成');
        notificationSuccess = true;
      } catch (notifyError) {
        this.log(`  ⚠️  通知发送失败: ${notifyError.message}`);
      }

      // 完成
      const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log('\n' + '='.repeat(60));
      this.log(`✓ 每日任务完成! 耗时: ${duration}秒`);
      this.log(`📊 分析了 ${analysisResults.length} 个项目`);
      const deepAnalysisCount = analysisResults.filter(r => r.codeFilesAnalyzed > 0).length;
      this.log(`🔍 深度分析: ${deepAnalysisCount} 个项目`);
      if (notionUrl) {
        this.log(`🔗 Notion: ${notionUrl}`);
      } else {
        this.log(`🔗 Notion: 同步失败（请检查网络连接）`);
      }
      this.log(`📢 通知: ${notificationSuccess ? '✅ 发送成功' : '❌ 发送失败'}`);
      this.log('='.repeat(60));

    } catch (error) {
      this.log(`\n✗ 任务执行失败: ${error.message}`);
      this.log(error.stack);
      throw error;
    } finally {
      // 最终清理
      this.log('\n[6/7] 最终内存清理...');
      this.memoryCleaner.cleanup();

      // 额外清理: 确保所有临时目录都被删除
      this.log('\n[7/7] 检查并清理残留代码...');
      await this.codeManager.cleanupAllTempDirectories();

      // 清理缓存
      this.log('\n[8/8] 清理过期缓存...');
      this.cache.cleanup();
    }
  }

  /**
   * 启动定时任务
   */
  start() {
    // 首先验证配置
    const validation = ConfigValidator.validate();

    if (!validation.valid) {
      this.log('\n✗ 配置验证失败，请修复以上错误后重新启动');
      this.log('提示: 运行 node src/index.js --help 查看配置帮助\n');
      process.exit(1);
    }

    // 使用增强的Cron调度器
    const schedule = process.env.SCHEDULE || '08:00';
    const timezone = process.env.TZ || 'Asia/Shanghai';

    this.scheduler.addTask('daily-task', this.runDailyTask.bind(this), {
      schedule,
      timezone,
      description: '每日技术日报生成',
      enabled: true
    });

    this.log(`✓ 定时任务已启动: ${schedule} (${timezone})`);
    this.log('✓ 提示: 可以使用 npm run dev 手动执行测试');
    this.log('✓ 内存自动清理: 已启用');
    this.log('✓ 支持的调度格式:');
    this.log('   - 简单时间: 08:00, 14:30');
    this.log('   - Cron表达式: 0 8 * * *');
    this.log('   - 环境变量: SCHEDULE=08:00 TZ=Asia/Shanghai');
  }

  /**
   * 日志输出
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;

    console.log(logMessage);

    // 写入日志文件
    try {
      fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      // 忽略日志写入错误
    }
  }
}

// 启动调度器
const scheduler = new TechDailyScheduler();

// 如果是直接运行（而非被导入），启动定时任务
if (require.main === module) {
  const args = process.argv.slice(2);

  // 帮助模式
  if (args.includes('--help') || args.includes('-h')) {
    ConfigValidator.printHelp();
    process.exit(0);
  }

  // 配置验证模式
  if (args.includes('--validate') || args.includes('-v')) {
    ConfigValidator.validate();
    process.exit(0);
  }

  // 测试模式：立即执行一次
  if (args.includes('--test') || args.includes('-t')) {
    // 测试前也验证配置
    const validation = ConfigValidator.validate();
    if (!validation.valid) {
      console.error('配置验证失败，请修复错误后重试');
      process.exit(1);
    }

    scheduler.runDailyTask().catch(error => {
      console.error('测试执行失败:', error);
      process.exit(1);
    });
  } else {
    // 正常模式：启动定时任务
    scheduler.start();
  }
}

module.exports = TechDailyScheduler;

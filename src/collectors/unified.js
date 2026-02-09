/**
 * 统一代码仓库采集器
 *
 * 支持平台：
 * - GitHub
 * - GitLab
 * - Bitbucket
 */

const GitHubCollector = require('./github');
const GitLabCollector = require('./gitlab');
const BitbucketCollector = require('./bitbucket');
const { getLogger } = require('../utils/logger');

class UnifiedCollector {
  constructor() {
    this.collectors = {
      github: new GitHubCollector(),
      gitlab: new GitLabCollector(),
      bitbucket: new BitbucketCollector()
    };
    this.logger = getLogger('UnifiedCollector');

    // 从环境变量读取启用的平台
    this.enabledPlatforms = this.getEnabledPlatforms();
  }

  /**
   * 获取启用的平台列表
   */
  getEnabledPlatforms() {
    const platformConfig = process.env.ENABLED_PLATFORMS || 'github';
    return platformConfig.split(',').map(p => p.trim().toLowerCase());
  }

  /**
   * 从所有平台获取热门仓库
   */
  async getTrendingRepos() {
    const allRepos = [];

    for (const platform of this.enabledPlatforms) {
      try {
        this.logger.info(`正在从 ${platform} 获取热门仓库...`);

        const collector = this.collectors[platform];
        if (!collector) {
          this.logger.warn(`未知的平台: ${platform}`);
          continue;
        }

        const repos = await collector.getTrendingRepos();
        this.logger.info(`${platform}: 找到 ${repos.length} 个热门仓库`);

        allRepos.push(...repos);
      } catch (error) {
        this.logger.error(`${platform} 获取失败`, error);
      }
    }

    // 去重并排序
    const unique = this.deduplicateRepos(allRepos);
    return unique
      .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
      .slice(0, 10); // 返回Top 10
  }

  /**
   * 去重仓库（按名称）
   */
  deduplicateRepos(repos) {
    const seen = new Map();

    return repos.filter(repo => {
      // 优先保留GitHub的数据
      const key = repo.full_name.toLowerCase();
      if (seen.has(key)) {
        const existing = seen.get(key);
        // 如果当前是GitHub，替换现有数据
        if (repo.platform === 'github' && existing.platform !== 'github') {
          seen.set(key, repo);
          return true;
        }
        return false;
      }
      seen.set(key, repo);
      return true;
    });
  }

  /**
   * 获取指定平台的README
   */
  async getReadme(owner, repo, platform = 'github') {
    const collector = this.collectors[platform];
    if (!collector || !collector.getReadme) {
      this.logger.warn(`平台 ${platform} 不支持获取README`);
      return null;
    }

    try {
      return await collector.getReadme(owner, repo);
    } catch (error) {
      this.logger.warn(`获取README失败: ${platform}/${owner}/${repo}`, error);
      return null;
    }
  }

  /**
   * 获取平台统计信息
   */
  async getPlatformStats() {
    const stats = {};

    for (const [platform, collector] of Object.entries(this.collectors)) {
      if (this.enabledPlatforms.includes(platform)) {
        try {
          const repos = await collector.getTrendingRepos();
          stats[platform] = {
            enabled: true,
            count: repos.length,
            avgStars: repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0) / repos.length
          };
        } catch (error) {
          stats[platform] = {
            enabled: true,
            error: error.message
          };
        }
      } else {
        stats[platform] = {
          enabled: false
        };
      }
    }

    return stats;
  }

  /**
   * 获取仓库详情
   */
  async getRepositoryDetails(fullName, platform = null) {
    // 如果没有指定平台，从fullName推断
    if (!platform) {
      if (fullName.includes('|')) {
        const [p, name] = fullName.split('|');
        platform = p;
        fullName = name;
      } else {
        platform = 'github';
      }
    }

    const collector = this.collectors[platform];
    if (!collector) {
      throw new Error(`未知的平台: ${platform}`);
    }

    // 这里可以扩展获取详细信息
    return {
      full_name: fullName,
      platform,
      url: collector.baseURL
    };
  }

  /**
   * 添加自定义平台采集器
   */
  addCollector(platform, collector) {
    this.collectors[platform] = collector;
    this.logger.info(`已添加自定义采集器: ${platform}`);
  }

  /**
   * 启用平台
   */
  enablePlatform(platform) {
    if (!this.enabledPlatforms.includes(platform)) {
      this.enabledPlatforms.push(platform);
      this.logger.info(`已启用平台: ${platform}`);
    }
  }

  /**
   * 禁用平台
   */
  disablePlatform(platform) {
    this.enabledPlatforms = this.enabledPlatforms.filter(p => p !== platform);
    this.logger.info(`已禁用平台: ${platform}`);
  }

  /**
   * 获取所有支持的平台
   */
  getSupportedPlatforms() {
    return Object.keys(this.collectors);
  }

  /**
   * 检查平台是否可用
   */
  isPlatformAvailable(platform) {
    const collector = this.collectors[platform];
    if (!collector) return false;

    // 检查是否配置了必要的凭证
    switch (platform) {
      case 'github':
        return !!process.env.GITHUB_TOKEN;
      case 'gitlab':
        return !!process.env.GITLAB_TOKEN;
      case 'bitbucket':
        return !!process.env.BITBUCKET_TOKEN;
      default:
        return true;
    }
  }
}

module.exports = UnifiedCollector;

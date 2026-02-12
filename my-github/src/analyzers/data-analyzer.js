/**
 * 数据分析模块
 *
 * 核心功能：
 * 1. 技术栈统计分析
 * 2. 项目趋势分析（历史对比）
 * 3. 语言分布统计
 * 4. 热门领域分析
 */

const fs = require('fs');
const path = require('path');
const { getLogger } = require('../utils/logger');

class DataAnalyzer {
  constructor(options = {}) {
    this.historyFile = options.historyFile || path.join(process.cwd(), 'data/history.json');
    this.logger = getLogger('DataAnalyzer');
    this.history = this.loadHistory();
  }

  /**
   * 加载历史数据
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.logger.warn('加载历史数据失败', error);
    }
    return {
      dailyReports: [],
      languageStats: {},
      trendData: []
    };
  }

  /**
   * 保存历史数据（原子写入：先写临时文件再 rename，防止写入中断导致数据损坏）
   */
  saveHistory() {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpFile = this.historyFile + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(this.history, null, 2));
      fs.renameSync(tmpFile, this.historyFile);
      this.logger.debug('历史数据已保存');
    } catch (error) {
      this.logger.error('保存历史数据失败', error);
    }
  }

  /**
   * 分析技术栈分布
   */
  analyzeTechStack(repositories) {
    const stats = {
      languages: {},
      totalRepos: repositories.length,
      avgStars: 0,
      avgGrowth: 0,
      topLanguages: []
    };

    // 统计语言分布
    repositories.forEach(repo => {
      const lang = repo.language || 'Unknown';
      stats.languages[lang] = (stats.languages[lang] || 0) + 1;
      stats.avgStars += repo.stargazers_count || 0;
      stats.avgGrowth += repo.growthRate || 0;
    });

    // 计算平均值
    stats.avgStars = Math.round(stats.avgStars / stats.totalRepos);
    stats.avgGrowth = (stats.avgGrowth / stats.totalRepos).toFixed(2);

    // 排序获取Top语言
    stats.topLanguages = Object.entries(stats.languages)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => ({
        language: lang,
        count,
        percentage: ((count / stats.totalRepos) * 100).toFixed(1)
      }));

    return stats;
  }

  /**
   * 分析项目趋势（与历史数据对比）
   */
  analyzeTrends(currentRepos) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = this.getPreviousDayReports(1);
    const lastWeek = this.getPreviousDayReports(7);

    const trends = {
      newProjects: [],
      risingStars: [],
      repeatWinners: [],
      summary: ''
    };

    // 找出新上榜项目
    if (yesterday.length > 0) {
      const yesterdayNames = new Set(yesterday.map(r => r.name));
      trends.newProjects = currentRepos.filter(r => !yesterdayNames.has(r.name));
    }

    // 找出持续热门项目（连续多天上榜）
    const recentReports = this.getPreviousDayReports(3);
    if (recentReports.length > 0) {
      const recentNames = new Map();
      recentReports.forEach(repos => {
        repos.forEach(repo => {
          recentNames.set(repo.name, (recentNames.get(repo.name) || 0) + 1);
        });
      });

      trends.repeatWinners = currentRepos.filter(repo => {
        const count = recentNames.get(repo.name) || 0;
        return count >= 2;
      });
    }

    // 找出增长最快的项目
    trends.risingStars = [...currentRepos]
      .sort((a, b) => (b.growthRate || 0) - (a.growthRate || 0))
      .slice(0, 3);

    // 生成趋势总结
    trends.summary = this.generateTrendSummary(trends, currentRepos.length);

    return trends;
  }

  /**
   * 生成趋势总结文本
   */
  generateTrendSummary(trends, totalCount) {
    const parts = [];

    if (trends.newProjects.length > 0) {
      parts.push(`新上榜 ${trends.newProjects.length} 个项目`);
    }

    if (trends.repeatWinners.length > 0) {
      parts.push(`${trends.repeatWinners.length} 个项目持续热门`);
    }

    if (trends.risingStars.length > 0) {
      const top = trends.risingStars[0];
      parts.push(`增长冠军: ${top.name} (+${top.growthRate?.toFixed(2)}/天)`);
    }

    return parts.length > 0 ? parts.join('，') : `今日分析 ${totalCount} 个热门项目`;
  }

  /**
   * 获取前N天的报告
   */
  getPreviousDayReports(days) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const dateStr = targetDate.toISOString().split('T')[0];

    const report = this.history.dailyReports.find(r => r.date === dateStr);
    return report ? report.repositories : [];
  }

  /**
   * 保存今日报告到历史
   */
  saveDailyReport(repositories) {
    const today = new Date().toISOString().split('T')[0];

    // 避免重复保存
    const existingIndex = this.history.dailyReports.findIndex(r => r.date === today);
    if (existingIndex >= 0) {
      this.history.dailyReports[existingIndex] = {
        date: today,
        timestamp: Date.now(),
        repositories: repositories.map(r => ({
          name: r.name,
          url: r.url,
          language: r.language,
          growthRate: r.growthRate,
          stars: r.stargazers_count,
          description: r.description,
          analysis: r.analysis || ''
        }))
      };
    } else {
      this.history.dailyReports.push({
        date: today,
        timestamp: Date.now(),
        repositories: repositories.map(r => ({
          name: r.name,
          url: r.url,
          language: r.language,
          growthRate: r.growthRate,
          stars: r.stargazers_count,
          description: r.description,
          analysis: r.analysis || ''
        }))
      });
    }

    // 只保留最近30天的数据
    this.history.dailyReports = this.history.dailyReports.slice(-30);

    this.saveHistory();
  }

  /**
   * 获取语言统计趋势
   */
  getLanguageTrend(language, days = 7) {
    const trend = [];
    const reports = this.history.dailyReports.slice(-days);

    reports.forEach(report => {
      const langRepos = report.repositories.filter(r => r.language === language);
      if (langRepos.length > 0) {
        const avgGrowth = langRepos.reduce((sum, r) => sum + (r.growthRate || 0), 0) / langRepos.length;
        trend.push({
          date: report.date,
          count: langRepos.length,
          avgGrowth: avgGrowth.toFixed(2)
        });
      }
    });

    return trend;
  }

  /**
   * 生成技术统计报告
   */
  generateTechReport(repositories, trends) {
    const techStack = this.analyzeTechStack(repositories);

    const report = {
      date: new Date().toISOString().split('T')[0],
      totalRepos: techStack.totalRepos,
      avgStars: techStack.avgStars,
      avgGrowth: techStack.avgGrowth,
      topLanguages: techStack.topLanguages,
      trends: {
        summary: trends.summary,
        newProjects: trends.newProjects.map(r => r.name),
        risingStars: trends.risingStars.map(r => ({
          name: r.name,
          growth: r.growthRate?.toFixed(2)
        })),
        repeatWinners: trends.repeatWinners.map(r => r.name)
      }
    };

    return report;
  }

  /**
   * 清理过期历史数据
   */
  cleanup(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    this.history.dailyReports = this.history.dailyReports.filter(r => {
      const reportDate = new Date(r.date);
      return reportDate >= cutoffDate;
    });

    this.saveHistory();
    this.logger.info(`已清理 ${daysToKeep} 天前的历史数据`);
  }
}

module.exports = DataAnalyzer;

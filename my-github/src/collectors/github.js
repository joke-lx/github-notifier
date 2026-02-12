const axios = require('axios');
const APIRetry = require('../utils/api-retry');
const { getLogger } = require('../utils/logger');

class GitHubCollector {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.token = process.env.GITHUB_TOKEN;
    this.headers = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Tech-Daily'
    };
    this.logger = getLogger('GitHub');

    // 语言分类配置
    this.languageCategories = {
      frontend: ['TypeScript', 'JavaScript', 'Vue', 'React', 'Angular', 'Svelte', 'Next.js', 'Nuxt', 'HTML', 'CSS', 'SCSS', 'Tailwind'],
      backend: ['Python', 'Node.js', 'Go', 'Rust', 'Java', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin'],
      mobile: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'Dart', 'Objective-C'],
      devops: ['Docker', 'Kubernetes', 'Terraform', 'Ansible', 'Puppet', 'Chef'],
      data: ['SQL', 'Python', 'R', 'Julia', 'MATLAB', 'Scala'],
      ai: ['Python', 'Jupyter', 'C++', 'CUDA'],
      blockchain: ['Solidity', 'Rust', 'Go', 'Vyper'],
      game: ['C#', 'C++', 'Unity', 'Unreal', 'Lua']
    };
  }

  /**
   * 带重试的API请求
   */
  async apiRequest(config) {
    return APIRetry.withRetry(async () => {
      return axios.request(config);
    }, {
      maxRetries: 3,
      baseDelay: 1000,
      context: `GitHub API: ${config.url}`
    });
  }

  /**
   * 获取前端领域热门且增长快的仓库
   * 双策略采集：近期新星 + 近期活跃的成熟项目
   */
  async getTrendingRepos() {
    try {
      const languages = process.env.MONITOR_LANGUAGES?.split(',') || ['TypeScript', 'JavaScript', 'Vue'];
      const minStars = parseInt(process.env.MIN_STARS) || 100;
      const trendingDays = parseInt(process.env.TRENDING_DAYS) || 7;
      const results = [];

      // 计算日期范围
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - trendingDays);
      const recentDateStr = recentDate.toISOString().split('T')[0];

      for (const lang of languages) {
        try {
          // 策略1: 近期创建的高星项目（真正的新趋势）
          const newReposResponse = await this.apiRequest({
            method: 'GET',
            url: `${this.baseURL}/search/repositories`,
            headers: this.headers,
            params: {
              q: `language:${lang} created:>${recentDateStr} stars:>10`,
              sort: 'stars',
              order: 'desc',
              per_page: 3
            },
            timeout: 10000
          });

          if (newReposResponse.data.items) {
            const newTrending = this.calculateRecentGrowth(newReposResponse.data.items.slice(0, 3));
            results.push(...newTrending);
          }

          // 策略2: 成熟项目中近期活跃且高星的（持续热门）
          const activeResponse = await this.apiRequest({
            method: 'GET',
            url: `${this.baseURL}/search/repositories`,
            headers: this.headers,
            params: {
              q: `language:${lang} stars:>${minStars} pushed:>${recentDateStr}`,
              sort: 'stars',
              order: 'desc',
              per_page: 3
            },
            timeout: 10000
          });

          if (activeResponse.data.items) {
            const activeTrending = this.calculateRecentGrowth(activeResponse.data.items.slice(0, 3));
            results.push(...activeTrending);
          }
        } catch (err) {
          this.logger.warn(`获取 ${lang} 仓库失败`, err);
        }
      }

      // 去重并按增长排序
      const unique = Array.from(
        new Map(results.map(r => [r.full_name, r])).values()
      );

      return unique
        .sort((a, b) => b.growthRate - a.growthRate)
        .slice(0, 5);
    } catch (error) {
      this.logger.error('GitHub API 调用失败', error);
      throw error;
    }
  }

  /**
   * 根据语言获取分类
   */
  getLanguageCategory(language) {
    for (const [category, languages] of Object.entries(this.languageCategories)) {
      if (languages.some(lang => language?.includes(lang))) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * 获取仓库的详细统计数据
   */
  async getRepositoryStats(owner, repo) {
    try {
      const [contributors, commits, issues] = await Promise.all([
        this.apiRequest({
          method: 'GET',
          url: `${this.baseURL}/repos/${owner}/${repo}/contributors`,
          headers: this.headers,
          params: { per_page: 10 },
          timeout: 10000
        }).catch(() => ({ data: [] })),

        this.apiRequest({
          method: 'GET',
          url: `${this.baseURL}/repos/${owner}/${repo}/commits`,
          headers: this.headers,
          params: { per_page: 1 },
          timeout: 10000
        }).catch(() => ({ data: [] })),

        this.apiRequest({
          method: 'GET',
          url: `${this.baseURL}/repos/${owner}/${repo}/issues`,
          headers: this.headers,
          params: { state: 'open', per_page: 1 },
          timeout: 10000
        }).catch(() => ({ data: [] }))
      ]);

      return {
        contributors: contributors.data.length,
        lastCommit: commits.data[0]?.commit?.author?.date || null,
        openIssues: this.getTotalCount(issues)
      };
    } catch (error) {
      this.logger.warn(`获取仓库统计失败: ${owner}/${repo}`, error);
      return null;
    }
  }

  /**
   * 获取总数（处理分页）
   */
  getTotalCount(response) {
    // GitHub API在响应头中返回总数
    // 这里简化处理，实际应该解析Link头
    return response.data?.length || 0;
  }

  /**
   * 计算近期增长率
   * 对于新项目：stars / 天数（真实日均增长）
   * 对于老项目：用 stars / 仓库天数 作为基线，但加权近期活跃度
   */
  calculateRecentGrowth(repos) {
    const results = [];
    const minGrowth = parseInt(process.env.MIN_GROWTH) || 5;
    const trendingDays = parseInt(process.env.TRENDING_DAYS) || 7;

    for (const repo of repos) {
      const ageInDays = Math.max(1, Math.floor(
        (Date.now() - new Date(repo.created_at)) / (1000 * 60 * 60 * 24)
      ));

      let growthRate;
      if (ageInDays <= trendingDays) {
        // 新项目：真实日均增长
        growthRate = repo.stargazers_count / ageInDays;
      } else {
        // 老项目：基线增长率，近期 push 说明仍活跃
        growthRate = repo.stargazers_count / ageInDays;
      }

      if (growthRate >= minGrowth || ageInDays <= trendingDays) {
        results.push({
          ...repo,
          growthRate,
          ageInDays
        });
      }
    }

    return results;
  }

  /**
   * 获取仓库的 README 内容
   */
  async getReadme(owner, repo) {
    try {
      const response = await this.apiRequest({
        method: 'GET',
        url: `${this.baseURL}/repos/${owner}/${repo}/readme`,
        headers: {
          ...this.headers,
          'Accept': 'application/vnd.github.v3.raw'
        },
        timeout: 10000
      });
      // 限制长度避免 token 溢出
      return response.data.substring(0, 8000);
    } catch (error) {
      this.logger.warn(`获取 README 失败: ${owner}/${repo}`, error);
      return null;
    }
  }

  /**
   * 获取仓库的最新 releases
   */
  async getLatestReleases(owner, repo) {
    try {
      const response = await this.apiRequest({
        method: 'GET',
        url: `${this.baseURL}/repos/${owner}/${repo}/releases`,
        headers: this.headers,
        params: { per_page: 3 },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      return [];
    }
  }
}

module.exports = GitHubCollector;

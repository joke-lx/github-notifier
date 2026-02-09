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
   * 核心策略：按语言筛选 + 星标增长过滤 + 活跃度筛选
   */
  async getTrendingRepos() {
    try {
      const languages = process.env.MONITOR_LANGUAGES?.split(',') || ['TypeScript', 'JavaScript', 'Vue'];
      const minStars = parseInt(process.env.MIN_STARS) || 100;
      const results = [];

      for (const lang of languages) {
        try {
          const query = `language:${lang} stars:>${minStars}`;
          const response = await this.apiRequest({
            method: 'GET',
            url: `${this.baseURL}/search/repositories`,
            headers: this.headers,
            params: {
              q: query,
              sort: 'updated',
              order: 'desc',
              per_page: 5
            },
            timeout: 10000
          });

          const trending = await this.filterByGrowth(response.data.items.slice(0, 5));
          results.push(...trending);
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
   * 筛选星标增长快的仓库
   * 计算策略：星标增长率 = 总星标 / 仓库天数
   */
  async filterByGrowth(repos) {
    const results = [];
    const minGrowth = parseInt(process.env.MIN_GROWTH) || 5;

    for (const repo of repos) {
      const ageInDays = Math.max(1, Math.floor(
        (Date.now() - new Date(repo.created_at)) / (1000 * 60 * 60 * 24)
      ));

      // 增长率 = 总星标 / 仓库天数（每天新增星标数）
      const growthRate = repo.stargazers_count / ageInDays;

      // 只保留增长快的（每天至少新增 MIN_GROWTH 个星标）
      if (growthRate >= minGrowth) {
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

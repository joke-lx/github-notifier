const axios = require('axios');
const APIRetry = require('../utils/api-retry');
const { getLogger } = require('../utils/logger');

class BitbucketCollector {
  constructor() {
    this.baseURL = 'https://api.bitbucket.org/2.0';
    this.token = process.env.BITBUCKET_TOKEN;
    this.headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/json'
    };
    this.logger = getLogger('Bitbucket');
  }

  /**
   * 获取热门仓库
   */
  async getTrendingRepos() {
    try {
      const languages = process.env.MONITOR_LANGUAGES?.split(',') || ['TypeScript', 'JavaScript'];
      const minStars = parseInt(process.env.MIN_STARS) || 100;
      const results = [];

      for (const lang of languages) {
        try {
          // Bitbucket API 搜索
          const response = await this.apiRequest({
            method: 'GET',
            url: `${this.baseURL}/repositories`,
            headers: this.headers,
            params: {
              q: `language="${lang}"`,
              sort: '-updated_on'
            },
            timeout: 10000
          });

          const projects = response.data.values || [];
          const filtered = projects
            .filter(p => this.extractStarCount(p) >= minStars)
            .slice(0, 5)
            .map(repo => this.normalizeRepository(repo));

          results.push(...filtered);
        } catch (err) {
          this.logger.warn(`获取Bitbucket ${lang} 仓库失败`, err);
        }
      }

      return results.slice(0, 5);
    } catch (error) {
      this.logger.error('Bitbucket API 调用失败', error);
      throw error;
    }
  }

  /**
   * 规范化仓库数据
   */
  normalizeRepository(repo) {
    const ageInDays = Math.max(1, Math.floor(
      (Date.now() - new Date(repo.created_on)) / (1000 * 60 * 60 * 24)
    ));

    return {
      id: repo.uuid,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.links?.html?.href || `https://bitbucket.org/${repo.full_name}`,
      description: repo.description,
      language: this.detectLanguage(repo),
      stargazers_count: this.extractStarCount(repo),
      created_at: repo.created_on,
      updated_at: repo.updated_on,
      growthRate: this.extractStarCount(repo) / ageInDays,
      platform: 'bitbucket',
      owner: {
        login: repo.owner?.display_name || repo.full_name.split('/')[0]
      }
    };
  }

  /**
   * 检测语言
   */
  detectLanguage(repo) {
    // Bitbucket主语言在language字段
    return repo.language || 'Unknown';
  }

  /**
   * 提取星标数
   */
  extractStarCount(repo) {
    // Bitbucket使用watchers作为star的替代
    return 0; // Bitbucket API限制，需要额外请求
  }

  /**
   * 获取README
   */
  async getReadme(workspace, repoSlug) {
    try {
      const response = await this.apiRequest({
        method: 'GET',
        url: `${this.baseURL}/repositories/${workspace}/${repoSlug}/src/HEAD/README.md`,
        headers: this.headers,
        timeout: 10000
      });

      return response.data.substring(0, 8000);
    } catch (error) {
      this.logger.warn(`获取Bitbucket README失败: ${workspace}/${repoSlug}`, error);
      return null;
    }
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
      context: `Bitbucket API: ${config.url}`
    });
  }
}

module.exports = BitbucketCollector;

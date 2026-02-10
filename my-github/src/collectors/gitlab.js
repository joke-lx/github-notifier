const axios = require('axios');
const APIRetry = require('../utils/api-retry');
const { getLogger } = require('../utils/logger');

class GitLabCollector {
  constructor() {
    this.baseURL = process.env.GITLAB_URL || 'https://gitlab.com';
    this.token = process.env.GITLAB_TOKEN;
    this.headers = {
      'PRIVATE-TOKEN': this.token
    };
    this.logger = getLogger('GitLab');
  }

  /**
   * 获取热门项目
   */
  async getTrendingRepos() {
    try {
      const languages = process.env.MONITOR_LANGUAGES?.split(',') || ['TypeScript', 'JavaScript'];
      const minStars = parseInt(process.env.MIN_STARS) || 100;
      const results = [];

      for (const lang of languages) {
        try {
          // GitLab API 搜索项目
          const response = await this.apiRequest({
            method: 'GET',
            url: `${this.baseURL}/api/v4/projects`,
            headers: this.headers,
            params: {
              search: lang,
              order_by: 'last_activity_at',
              sort: 'desc',
              per_page: 20,
              // GitLab没有语言过滤器，需要手动过滤
            },
            timeout: 10000
          });

          // 过滤结果
          const filtered = response.data
            .filter(p => p.star_count >= minStars)
            .slice(0, 5)
            .map(project => this.normalizeProject(project));

          results.push(...filtered);
        } catch (err) {
          this.logger.warn(`获取GitLab ${lang} 项目失败`, err);
        }
      }

      return results.slice(0, 5);
    } catch (error) {
      this.logger.error('GitLab API 调用失败', error);
      throw error;
    }
  }

  /**
   * 规范化项目数据
   */
  normalizeProject(project) {
    const ageInDays = Math.max(1, Math.floor(
      (Date.now() - new Date(project.created_at)) / (1000 * 60 * 60 * 24)
    ));

    return {
      id: project.id,
      name: project.name,
      full_name: project.path_with_namespace,
      html_url: project.web_url,
      description: project.description,
      language: this.detectLanguage(project),
      stargazers_count: project.star_count,
      created_at: project.created_at,
      updated_at: project.last_activity_at,
      growthRate: project.star_count / ageInDays,
      platform: 'gitlab',
      owner: {
        login: project.namespace?.name || project.path_with_namespace.split('/')[0]
      }
    };
  }

  /**
   * 检测项目语言
   */
  detectLanguage(project) {
    // GitLab没有直接的语言字段，需要从其他信息推断
    const name = project.name.toLowerCase();
    const tagList = project.tag_list || [];

    if (tagList.some(t => t.toLowerCase().includes('typescript')) ||
        name.includes('ts')) {
      return 'TypeScript';
    }
    if (tagList.some(t => t.toLowerCase().includes('javascript')) ||
        name.includes('js')) {
      return 'JavaScript';
    }
    if (tagList.some(t => t.toLowerCase().includes('vue'))) {
      return 'Vue';
    }
    if (tagList.some(t => t.toLowerCase().includes('react'))) {
      return 'React';
    }

    return 'Unknown';
  }

  /**
   * 获取README
   */
  async getReadme(projectId) {
    try {
      const response = await this.apiRequest({
        method: 'GET',
        url: `${this.baseURL}/api/v4/projects/${projectId}/repository/files/README.md/raw`,
        headers: this.headers,
        timeout: 10000
      });

      // GitLab返回base64编码
      return Buffer.from(response.data, 'base64').toString('utf-8').substring(0, 8000);
    } catch (error) {
      this.logger.warn(`获取GitLab README失败: ${projectId}`, error);
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
      context: `GitLab API: ${config.url}`
    });
  }
}

module.exports = GitLabCollector;

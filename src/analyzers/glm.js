const axios = require('axios');
const APIRetry = require('../utils/api-retry');
const { getLogger } = require('../utils/logger');

class GLMAnalyzer {
  constructor() {
    this.apiKey = process.env.GLM_API_KEY;
    this.apiURL = process.env.GLM_API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    this.logger = getLogger('GLM');
  }

  /**
   * 带重试的GLM API调用
   */
  async callGLMAPI(messages, options = {}) {
    return APIRetry.withRetry(async () => {
      return axios.post(this.apiURL, {
        model: 'glm-4-flash',
        messages,
        ...options
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    }, {
      maxRetries: 3,
      baseDelay: 1000,
      context: 'GLM API'
    });
  }

  /**
   * 深度分析仓库代码（基于实际代码）
   *
   * 核心原理：
   * 1. 分析实际代码实现，而不仅仅是 README
   * 2. 提取代码结构和核心逻辑
   * 3. 聚焦技术实现细节和设计模式
   */
  async analyzeRepositoryDeep(repoData, codeStructure, readme) {
    const prompt = this.buildDeepAnalysisPrompt(repoData, codeStructure, readme);

    try {
      const response = await this.callGLMAPI([
        {
          role: 'system',
          content: '你是一个精通代码分析和架构设计的技术专家。你擅长从实际代码中提取核心技术原理、设计模式和实现细节。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        max_tokens: 2000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error(`GLM 深度分析失败: ${repoData.full_name}`, error);
      // 降级到基础分析
      return this.analyzeRepository(repoData, readme);
    }
  }

  /**
   * 分析仓库的核心技术原理（基于 README，降级方案）
   *
   * 核心原理：
   * 1. 使用结构化 Prompt 确保输出格式一致
   * 2. 限制输入输出长度控制 token 成本
   * 3. 聚焦"原理"而非"使用方法"
   */
  async analyzeRepository(repoData, readme) {
    const prompt = this.buildAnalysisPrompt(repoData, readme);

    try {
      const response = await this.callGLMAPI([
        {
          role: 'system',
          content: '你是一个精通前端技术和底层原理的技术专家。你擅长从代码和文档中提取核心技术原理，并用简洁透彻的语言解释。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        max_tokens: 2000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error(`GLM 分析失败: ${repoData.full_name}`, error);
      return this.getFallbackAnalysis(repoData);
    }
  }

  /**
   * 构建深度分析 Prompt（基于代码）
   */
  buildDeepAnalysisPrompt(repoData, codeStructure, readme) {
    const readmePreview = readme ? readme.substring(0, 2000) : '无 README';

    // 代码摘要
    const codeSummary = codeStructure.keyFiles.map(file => {
      return `## 文件: ${file.path}
\`\`\`
${file.preview}
\`\`\``;
    }).join('\n\n');

    return `请深度分析以下 GitHub 仓库的**实际代码实现**：

**仓库信息**：
- 名称：${repoData.full_name}
- 描述：${repoData.description || '无描述'}
- 语言：${repoData.language}
- 星标：${repoData.stargazers_count}
- 增长率：${repoData.growthRate?.toFixed(2)}/天
- 地址：${repoData.html_url}

**代码结构**：
${codeStructure.summary}

**核心文件内容**（共 ${codeStructure.keyFiles.length} 个关键文件）：
${codeSummary}

**README 参考**（前 2000 字）：
\`\`\`
${readmePreview}
\`\`\`

**分析要求**：
1. **重点分析实际代码**，而不是 README 描述
2. 提取核心技术原理和设计模式
3. 分析代码结构和架构特点
4. 说明核心算法或技术实现
5. 指出创新点和巧妙设计
6. 控制在 600 字以内

**输出格式**：
# ${repoData.full_name}

> **原理深度解析**：[基于代码实现的深度分析，300-400字]

## 核心实现
- 核心模块1：[实现思路]
- 核心模块2：[实现思路]
- 技术亮点：[具体实现细节]

## 架构特点
[说明代码组织方式和架构设计]

## 适用场景
[基于实际实现的最佳使用场景]

## 与同类方案对比
[简短对比 100 字]`;
  }

  /**
   * 构建分析 Prompt
   */
  buildAnalysisPrompt(repoData, readme) {
    const readmePreview = readme
      ? readme.substring(0, 4000)
      : '无 README';

    return `请分析以下 GitHub 仓库的核心技术原理：

**仓库信息**：
- 名称：${repoData.full_name}
- 描述：${repoData.description || '无描述'}
- 语言：${repoData.language}
- 星标：${repoData.stargazers_count}
- 增长率：${repoData.growthRate?.toFixed(2)}/天
- 地址：${repoData.html_url}

**README 内容**（前 4000 字）：
\`\`\`
${readmePreview}
\`\`\`

**分析要求**：
1. 提取核心技术原理（不是 API 使用方法）
2. 解释设计思想和权衡
3. 说明解决了什么核心问题
4. 与其他方案的对比
5. 用简洁透彻的文字，不要代码示例
6. 控制在 600 字以内

**输出格式**：
# ${repoData.full_name}

> **原理深度解析**：[200-400 字的原理解释]

## 核心创新点
- 创新点1
- 创新点2
- 创新点3

## 适用场景
[说明最佳使用场景]

## 与同类方案对比
[简短对比 100 字]`;
  }

  /**
   * 降级分析：API 失败时的简单分析
   */
  getFallbackAnalysis(repoData) {
    return `# ${repoData.full_name}

> **原理深度解析**：该仓库暂时无法深入分析（API 限流或超时），建议手动查看 README 理解原理。

## 基本信息
- **语言**：${repoData.language}
- **星标**：${repoData.stargazers_count} (+${repoData.growthRate?.toFixed(2)}/天)
- **描述**：${repoData.description || '暂无描述'}

## 链接
[查看仓库](${repoData.html_url})`;
  }

  /**
   * 生成每日总结
   */
  async generateDailySummary(reports) {
    const prompt = `基于以下技术分析，生成每日前端技术总结（适合QQ群消息）：

${reports.map(r => `- ${r.name}: ${r.summary || r.analysis.split('\\n')[0]}`).join('\\n')}

**要求**：
1. 总结 3-5 个最重要的技术趋势
2. 每个趋势用一句话概括
3. 突出"原理"和"创新点"
4. 适合发在 QQ 群
5. 总字数控制在 200 字以内

**输出格式**：
【今日前端技术日报】📅 ${new Date().toLocaleDateString('zh-CN')}
📌 趋势1：[一句话]
📌 趋势2：[一句话]
📌 趋势3：[一句话]
📖 详细报告已同步至 Notion 知识库`;

    try {
      const response = await this.callGLMAPI([
        {
          role: 'system',
          content: '你是一个技术编辑，擅长总结和提炼核心技术要点。'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.7,
        max_tokens: 500
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error('生成总结失败', error);
      return `【今日前端技术日报】📅 ${new Date().toLocaleDateString('zh-CN')}
今日分析了 ${reports.length} 个热门项目，详细报告已同步至 Notion。`;
    }
  }
}

module.exports = GLMAnalyzer;

/**
 * 消息模板系统
 *
 * 核心功能：
 * 1. 支持多种消息模板（每日总结、技术亮点、趋势分析）
 * 2. 支持多种格式（纯文本、Markdown、HTML）
 * 3. 自定义模板变量
 * 4. 模板继承和组合
 */

const { getLogger } = require('../utils/logger');

class MessageTemplate {
  constructor(options = {}) {
    this.customTemplates = options.customTemplates || {};
    this.logger = getLogger('MessageTemplate');
  }

  /**
   * 内置模板定义
   */
  get builtinTemplates() {
    return {
      // 每日总结模板（纯文本）
      dailySummary: {
        text: `【今日前端技术日报】📅 {{date}}

{{#if trends.summary}}{{trends.summary}}{{/if}}

📌 今日热门：
{{#each repositories}}
{{@index}}. {{name}}
   语言: {{language}}
   增长: +{{growthRate}}/天
   链接: {{url}}
{{/each}}

📊 技术栈统计：
{{#each techReport.topLanguages}}
- {{language}}: {{count}}个 ({{percentage}}%)
{{/each}}

📖 详细报告已同步至 Notion 知识库
{{#if notionUrl}}{{notionUrl}}{{/if}}`,

        markdown: `# 【今日前端技术日报】📅 {{date}}

{{#if trends.summary}}
## 📈 趋势概览
{{trends.summary}}
{{/if}}

## 🔥 今日热门

{{#each repositories}}
### {{@index}}. [{{name}}]({{url}})
- **语言**: {{language}}
- **增长**: +{{growthRate}}/天
- **分析**: {{summary}}
{{/each}}

## 📊 技术栈统计

| 语言 | 数量 | 占比 |
|------|------|------|
{{#each techReport.topLanguages}}
| {{language}} | {{count}} | {{percentage}}% |
{{/each}}

{{#if notionUrl}}
📖 [详细报告已同步至 Notion 知识库]({{notionUrl}})
{{/if}}`,

        html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <h2>【今日前端技术日报】📅 {{date}}</h2>

  {{#if trends.summary}}
  <h3>📈 趋势概览</h3>
  <p>{{trends.summary}}</p>
  {{/if}}

  <h3>🔥 今日热门</h3>
  <ul>
    {{#each repositories}}
    <li>
      <strong><a href="{{url}}">{{name}}</a></strong><br>
      语言: {{language}} | 增长: +{{growthRate}}/天
    </li>
    {{/each}}
  </ul>

  <h3>📊 技术栈统计</h3>
  <ul>
    {{#each techReport.topLanguages}}
    <li>{{language}}: {{count}}个 ({{percentage}}%)</li>
    {{/each}}
  </ul>

  {{#if notionUrl}}
  <p>📖 <a href="{{notionUrl}}">详细报告已同步至 Notion 知识库</a></p>
  {{/if}}
</div>`
      },

      // 技术亮点模板
      techHighlight: {
        text: `💡 技术亮点推荐

{{name}}
{{description}}

核心原理：
{{analysis}}

适用场景：
{{scenarios}}`,

        markdown: `## 💡 技术亮点推荐

### [{{name}}]({{url}})

{{description}}

#### 核心原理
{{analysis}}

#### 适用场景
{{scenarios}}

#### 与同类对比
{{comparison}}`
      },

      // 趋势分析模板
      trendAnalysis: {
        text: `📈 技术趋势分析

本周热门语言：
{{#each languageTrends}}
- {{language}}: {{count}}个项目，平均增长 +{{avgGrowth}}/天
{{/each}}

持续热门项目：
{{#each repeatWinners}}
- {{name}} (连续{{days}}天上榜)
{{/each}}

新上榜项目：
{{#each newProjects}}
- {{name}}
{{/each}}`,

        markdown: `# 📈 技术趋势分析

## 本周热门语言

| 语言 | 项目数 | 平均增长率 |
|------|--------|-----------|
{{#each languageTrends}}
| {{language}} | {{count}} | +{{avgGrowth}}/天 |
{{/each}}

## 🔥 持续热门项目

{{#each repeatWinners}}
### [{{name}}]({{url}})
- 连续 {{days}} 天上榜
- 增长率: +{{growthRate}}/天
{{/each}}

## 🆕 新上榜项目

{{#each newProjects}}
- [{{name}}]({{url}})
{{/each}}`
      },

      // 简洁通知模板
      simple: {
        text: `【GitHub技术日报】{{date}}

今日分析了 {{totalRepos}} 个热门项目
Top语言: {{topLanguages}}

{{notionUrl}}`
      }
    };
  }

  /**
   * 简单的模板渲染器
   */
  render(template, data) {
    let result = template;

    // 替换简单变量 {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return this.getNestedValue(data, key) || '';
    });

    // 处理条件 {{#if}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
      const value = this.getNestedValue(data, key);
      return value ? content : '';
    });

    // 处理循环 {{#each}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, itemTemplate) => {
      const items = this.getNestedValue(data, key);
      if (!Array.isArray(items)) return '';

      return items.map((item, index) => {
        let itemResult = itemTemplate;

        // 替换 {{@index}}
        itemResult = itemResult.replace(/\{\{@index\}\}/g, (index + 1).toString());

        // 替换数组项的属性
        for (const [itemKey, itemValue] of Object.entries(item)) {
          const regex = new RegExp(`\\{\\{${itemKey}\\}\\}`, 'g');
          itemResult = itemResult.replace(regex, String(itemValue || ''));
        }

        return itemResult;
      }).join('\n');
    });

    return result;
  }

  /**
   * 获取嵌套属性值
   */
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * 生成每日总结消息
   */
  generateDailySummary(data, format = 'text') {
    const template = this.getTemplate('dailySummary', format);
    return this.render(template, data);
  }

  /**
   * 生成技术亮点消息
   */
  generateTechHighlight(repo, format = 'markdown') {
    const template = this.getTemplate('techHighlight', format);
    return this.render(template, repo);
  }

  /**
   * 生成趋势分析消息
   */
  generateTrendAnalysis(trendData, format = 'markdown') {
    const template = this.getTemplate('trendAnalysis', format);
    return this.render(template, trendData);
  }

  /**
   * 获取模板
   */
  getTemplate(name, format = 'text') {
    // 优先使用自定义模板
    if (this.customTemplates[name] && this.customTemplates[name][format]) {
      return this.customTemplates[name][format];
    }

    // 使用内置模板
    if (this.builtinTemplates[name] && this.builtinTemplates[name][format]) {
      return this.builtinTemplates[name][format];
    }

    // 默认返回文本格式
    if (this.builtinTemplates[name] && this.builtinTemplates[name].text) {
      return this.builtinTemplates[name].text;
    }

    this.logger.warn(`模板不存在: ${name}.${format}`);
    return '';
  }

  /**
   * 添加自定义模板
   */
  addTemplate(name, format, template) {
    if (!this.customTemplates[name]) {
      this.customTemplates[name] = {};
    }
    this.customTemplates[name][format] = template;
    this.logger.debug(`已添加自定义模板: ${name}.${format}`);
  }

  /**
   * 批量生成不同格式的消息
   */
  generateAllFormats(templateName, data) {
    return {
      text: this.render(this.getTemplate(templateName, 'text'), data),
      markdown: this.render(this.getTemplate(templateName, 'markdown'), data),
      html: this.render(this.getTemplate(templateName, 'html'), data)
    };
  }

  /**
   * 截断消息以适应平台限制
   */
  truncateMessage(message, maxLength) {
    if (message.length <= maxLength) {
      return message;
    }

    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * 为特定平台优化消息
   */
  optimizeForPlatform(message, platform) {
    const limits = {
      qq: 2000,
      telegram: 4096,
      dingtalk: 20000,
      feishu: 40000,
      email: 100000
    };

    const maxLength = limits[platform] || 2000;
    return this.truncateMessage(message, maxLength);
  }
}

module.exports = MessageTemplate;

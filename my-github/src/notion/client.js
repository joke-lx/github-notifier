const { Client } = require('@notionhq/client');
const { getLogger } = require('../utils/logger');

class NotionClient {
  constructor() {
    this.client = new Client({
      auth: process.env.NOTION_TOKEN,
    });
    this.databaseId = process.env.NOTION_DATABASE_ID;
    this.titleProperty = null; // 将自动检测
    this.logger = getLogger('Notion');
  }

  /**
   * 自动检测数据库的标题属性名
   * Notion数据库的title属性可能叫：title, Name, 名称等
   */
  async detectTitleProperty() {
    try {
      const database = await this.client.databases.retrieve({
        database_id: this.databaseId,
      });

      // 查找第一个title类型的属性
      for (const [key, value] of Object.entries(database.properties)) {
        if (value.type === 'title') {
          this.titleProperty = key;
          this.logger.info(`检测到标题属性: "${key}"`);
          return key;
        }
      }

      throw new Error('数据库中没有找到title类型的属性');
    } catch (error) {
      this.logger.error('检测Notion属性失败', error);
      throw error;
    }
  }

  /**
   * 创建每日日报页面
   *
   * 核心原理：
   * 1. 使用 Notion Database API 创建页面
   * 2. 批量添加内容块（限制每次 100 个）
   * 3. Markdown 转 Notion Block 格式
   */
  async createDailyReport(date, repositories) {
    try {
      this.logger.info('正在创建 Notion 页面...');

      // 0. 自动检测标题属性名（首次）
      if (!this.titleProperty) {
        await this.detectTitleProperty();
      }

      // 1. 创建页面（使用动态检测的属性名）
      const properties = {};
      properties[this.titleProperty] = {
        title: [
          {
            text: {
              content: `GitHub 技术日报 - ${date}`
            }
          }
        ]
      };

      const page = await this.client.pages.create({
        parent: { database_id: this.databaseId },
        properties
      });

      // 2. 添加内容块
      const blocks = this.buildReportBlocks(repositories);
      await this.appendBlocks(page.id, blocks);

      this.logger.success(`Notion 页面已创建: ${page.url}`);
      return page.url;
    } catch (error) {
      this.logger.error('Notion 创建页面失败', error);
      throw error;
    }
  }

  /**
   * 构建报告内容块
   */
  buildReportBlocks(repositories) {
    const blocks = [
      {
        object: 'block',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', text: { content: '📊 今日技术亮点' } }]
        }
      }
    ];

    // 每个仓库的分析
    for (const repo of repositories) {
      blocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{
              type: 'text',
              text: {
                content: `⭐ ${repo.name}`,
                link: { url: repo.url }
              }
            }]
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [{
              type: 'text',
              text: { content: `🔥 星标增长: +${repo.growthRate?.toFixed(2) || 0}/天 | 💻 语言: ${repo.language}` }
            }],
            color: 'blue_background'
          }
        },
        ...this.convertMarkdownToBlocks(repo.analysis)
      );
    }

    return blocks;
  }

  /**
   * 简单的 Markdown 转 Notion Blocks
   */
  convertMarkdownToBlocks(markdown) {
    const blocks = [];
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let currentParagraph = [];
    let codeLines = [];

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // 结束代码块
          blocks.push({
            object: 'block',
            type: 'code',
            code: {
              rich_text: [{ type: 'text', text: { content: codeLines.join('\n') } }],
              language: 'javascript'
            }
          });
          codeLines = [];
        }
        inCodeBlock = !inCodeBlock;
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      if (line.startsWith('> **原理深度解析**')) {
        if (currentParagraph.length > 0) {
          blocks.push(this.createParagraphBlock(currentParagraph.join('\n')));
          currentParagraph = [];
        }
        const content = line.replace(/^> \*\*原理深度解析\*\*：?/, '');
        blocks.push({
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [{ type: 'text', text: { content: content || '核心技术原理' } }],
            color: 'blue_background'
          }
        });
      } else if (line.startsWith('## ')) {
        if (currentParagraph.length > 0) {
          blocks.push(this.createParagraphBlock(currentParagraph.join('\n')));
          currentParagraph = [];
        }
        blocks.push({
          object: 'block',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: line.replace(/^##\s/, '') } }]
          }
        });
      } else if (line.startsWith('# ')) {
        if (currentParagraph.length > 0) {
          blocks.push(this.createParagraphBlock(currentParagraph.join('\n')));
          currentParagraph = [];
        }
        blocks.push({
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: line.replace(/^#\s/, '') } }]
          }
        });
      } else if (line.startsWith('- ')) {
        if (currentParagraph.length > 0) {
          blocks.push(this.createParagraphBlock(currentParagraph.join('\n')));
          currentParagraph = [];
        }
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: line.replace(/^-\s/, '') } }]
          }
        });
      } else if (line.trim() === '') {
        if (currentParagraph.length > 0) {
          blocks.push(this.createParagraphBlock(currentParagraph.join('\n')));
          currentParagraph = [];
        }
      } else {
        currentParagraph.push(line);
      }
    }

    if (currentParagraph.length > 0) {
      blocks.push(this.createParagraphBlock(currentParagraph.join('\n')));
    }

    return blocks;
  }

  createParagraphBlock(text) {
    return {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: text } }]
      }
    };
  }

  /**
   * 追加内容块到页面
   */
  async appendBlocks(pageId, blocks) {
    const batchSize = 100;
    for (let i = 0; i < blocks.length; i += batchSize) {
      const batch = blocks.slice(i, i + batchSize);
      await this.client.blocks.children.append({
        block_id: pageId,
        children: batch
      });
    }
  }

  /**
   * 获取最近的日报列表
   */
  async getRecentReports(limit = 10) {
    try {
      const response = await this.client.databases.query({
        database_id: this.databaseId,
        sorts: [
          {
            property: 'title',
            direction: 'descending'
          }
        ],
        page_size: limit
      })

      return response.results.map(page => ({
        id: page.id,
        title: page.properties[this.titleProperty]?.title?.[0]?.text?.content,
        url: page.url
      }))
    } catch (error) {
      this.logger.error('获取日报列表失败', error)
      return []
    }
  }

  /**
   * 获取页面内容（blocks）
   */
  async getPageContent(pageId) {
    try {
      const blocks = []
      let hasMore = true
      let startCursor = undefined

      while (hasMore) {
        const response = await this.client.blocks.children.list({
          block_id: pageId,
          start_cursor: startCursor,
          page_size: 100
        })

        blocks.push(...response.results)
        hasMore = response.has_more
        startCursor = response.next_cursor
      }

      return blocks
    } catch (error) {
      this.logger.error('获取页面内容失败', error)
      return []
    }
  }
}

module.exports = NotionClient;

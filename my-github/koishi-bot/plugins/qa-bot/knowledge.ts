/**
 * 知识库管理模块
 *
 * 功能：
 * 1. 代码索引 - 分析项目代码结构
 * 2. 文档索引 - 解析 Markdown 文档
 * 3. Notion 检索 - 查询历史日报数据
 */

import { Context } from 'koishi'
import { promises as fs } from 'fs'
import path from 'path'
import axios from 'axios'

interface Config {
  notion: {
    token: string
    databaseId: string
  }
  projectRoot: string
}

interface KnowledgeItem {
  type: 'code' | 'doc' | 'notion'
  source: string
  content: string
  metadata?: Record<string, any>
}

interface SearchQuery {
  keywords: string[]
  type?: 'code' | 'doc' | 'notion'
  limit?: number
}

export class KnowledgeBase {
  private config: Config
  private codeIndex: KnowledgeItem[] = []
  private docIndex: KnowledgeItem[] = []
  private notionCache: Map<string, any> = new Map()
  private localHistoryCache: any[] = []

  constructor(config: Config) {
    this.config = config
  }

  /**
   * 初始化知识库
   * 加载所有数据源并建立索引
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.indexCode(),
      this.indexDocuments(),
      this.indexNotion(),
      this.indexLocalHistory()
    ])
  }

  /**
   * 代码索引 - 分析项目结构
   */
  private async indexCode(): Promise<void> {
    const srcPath = path.join(this.config.projectRoot, 'src')
    const items: KnowledgeItem[] = []

    try {
      // 读取主要模块结构
      const modules = ['collectors', 'analyzers', 'generators', 'notifiers']

      for (const module of modules) {
        const modulePath = path.join(srcPath, module)
        try {
          const files = await fs.readdir(modulePath)

          for (const file of files) {
            if (file.endsWith('.js')) {
              const filePath = path.join(modulePath, file)
              const content = await fs.readFile(filePath, 'utf-8')

              // 提取关键信息（类名、函数、注释）
              const summary = this.extractCodeSummary(content, file)

              items.push({
                type: 'code',
                source: `${module}/${file}`,
                content: summary,
                metadata: { module, file }
              })
            }
          }
        } catch (error) {
          // 模块可能不存在，跳过
        }
      }

      this.codeIndex = items
    } catch (error) {
      console.error('代码索引失败:', error)
    }
  }

  /**
   * 提取代码摘要信息
   */
  private extractCodeSummary(code: string, filename: string): string {
    const lines = code.split('\n')
    const summary: string[] = []

    // 提取文件头注释
    const headerComments: string[] = []
    for (const line of lines) {
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        headerComments.push(line.trim().replace(/^[/\*]\s*/, ''))
      } else if (line.includes('class ') || line.includes('function ') || line.includes('module.exports')) {
        break
      }
    }

    if (headerComments.length > 0) {
      summary.push(headerComments.join(' '))
    }

    // 提取类名和主要方法
    const classMatch = code.match(/class\s+(\w+)/)
    if (classMatch) {
      summary.push(`类名: ${classMatch[1]}`)
    }

    // 提取主要方法
    const methodMatches = code.matchAll(/async\s+(\w+)\s*\(/g)
    const methods: string[] = []
    for (const match of methodMatches) {
      methods.push(match[1])
      if (methods.length >= 5) break // 限制方法数量
    }

    if (methods.length > 0) {
      summary.push(`主要方法: ${methods.join(', ')}`)
    }

    return summary.join('\n')
  }

  /**
   * 文档索引 - 解析 Markdown 文档
   */
  private async indexDocuments(): Promise<void> {
    const items: KnowledgeItem[] = []

    try {
      const files = await fs.readdir(this.config.projectRoot)
      const mdFiles = files.filter(f => f.endsWith('.md') && f !== 'README.md')

      for (const file of mdFiles) {
        const filePath = path.join(this.config.projectRoot, file)
        const content = await fs.readFile(filePath, 'utf-8')

        // 提取标题和摘要
        const summary = this.extractDocSummary(content)

        items.push({
          type: 'doc',
          source: file,
          content: summary,
          metadata: { filename: file }
        })
      }

      this.docIndex = items
    } catch (error) {
      console.error('文档索引失败:', error)
    }
  }

  /**
   * 提取文档摘要
   */
  private extractDocSummary(doc: string): string {
    const lines = doc.split('\n')

    // 提取标题
    const title = lines[0].replace(/^#\s*/, '')

    // 提取前几段作为摘要
    const paragraphs: string[] = []
    let inParagraph = false
    let paragraphCount = 0

    for (const line of lines.slice(1)) {
      if (line.trim() === '') {
        if (inParagraph) {
          inParagraph = false
        }
        continue
      }

      if (line.startsWith('#')) {
        break // 遇到二级标题停止
      }

      paragraphs.push(line.trim())
      inParagraph = true

      if (paragraphs.join('\n').length > 500) {
        break // 限制摘要长度
      }
    }

    return `${title}\n\n${paragraphs.join('\n')}`
  }

  /**
   * Notion 索引 - 获取最近日报及其内容
   */
  private async indexNotion(): Promise<void> {
    try {
      // 获取最近的日报条目
      const response = await axios.post(
        'https://api.notion.com/v1/databases/' + this.config.notion.databaseId + '/query',
        {
          sorts: [
            {
              property: 'date',
              direction: 'descending'
            }
          ],
          page_size: 5
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.notion.token}`,
            'Notion-Version': '2022-06-28'
          }
        }
      )

      const pages = response.data.results

      for (const page of pages) {
        const title = page.properties.title?.title?.[0]?.text?.content || '未命名'
        const date = page.properties.date?.date?.start || ''

        // 拉取页面内容 blocks
        let content = ''
        try {
          content = await this.fetchPageBlocks(page.id)
        } catch (err) {
          console.error(`拉取 Notion 页面内容失败: ${title}`, err)
        }

        this.notionCache.set(title, {
          type: 'notion',
          source: 'Notion日报',
          title,
          date,
          url: page.url,
          content
        })
      }

      console.log(`Notion 索引完成: ${pages.length} 个页面（含内容）`)
    } catch (error) {
      console.error('Notion 索引失败:', error)
    }
  }

  /**
   * 拉取 Notion 页面的 blocks 内容并转为纯文本
   */
  private async fetchPageBlocks(pageId: string): Promise<string> {
    const blocks: string[] = []
    let hasMore = true
    let startCursor: string | undefined = undefined

    while (hasMore) {
      const params: any = { page_size: 100 }
      if (startCursor) params.start_cursor = startCursor

      const response = await axios.get(
        `https://api.notion.com/v1/blocks/${pageId}/children`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${this.config.notion.token}`,
            'Notion-Version': '2022-06-28'
          }
        }
      )

      for (const block of response.data.results) {
        const text = this.extractBlockText(block)
        if (text) blocks.push(text)
      }

      hasMore = response.data.has_more
      startCursor = response.data.next_cursor

      // 限制拉取量，避免过大
      if (blocks.join('\n').length > 3000) break
    }

    return blocks.join('\n')
  }

  /**
   * 从 Notion block 中提取纯文本
   */
  private extractBlockText(block: any): string {
    const type = block.type
    const data = block[type]
    if (!data?.rich_text) return ''

    const text = data.rich_text.map((t: any) => t.plain_text || '').join('')

    switch (type) {
      case 'heading_1': return `# ${text}`
      case 'heading_2': return `## ${text}`
      case 'heading_3': return `### ${text}`
      case 'bulleted_list_item': return `- ${text}`
      case 'numbered_list_item': return `- ${text}`
      case 'callout': return `> ${text}`
      case 'code': return `\`\`\`\n${text}\n\`\`\``
      default: return text
    }
  }

  /**
   * 本地历史索引 - 读取 history.json
   */
  private async indexLocalHistory(): Promise<void> {
    const historyPath = path.join(this.config.projectRoot, 'data/history.json')
    this.localHistoryCache = []

    try {
      const data = JSON.parse(await fs.readFile(historyPath, 'utf-8'))

      for (const report of data.dailyReports || []) {
        for (const repo of report.repositories || []) {
          this.localHistoryCache.push({
            type: 'local-history',
            date: report.date,
            name: repo.name,
            url: repo.url,
            language: repo.language,
            description: repo.description || '',
            analysis: repo.analysis || '',
            stars: repo.stars,
            growthRate: repo.growthRate
          })
        }
      }

      console.log(`本地历史索引完成: ${this.localHistoryCache.length} 个项目`)
    } catch (error) {
      console.error('本地历史索引失败:', error)
    }
  }

  /**
   * 检索知识
   * 根据问题从多个来源检索相关知识
   * 优先匹配项目名，支持从日报推送中直接追问
   */
  async retrieve(question: string): Promise<string> {
    const keywords = this.extractKeywords(question)
    const results: string[] = []

    // 0. 优先：精确匹配项目名（支持从日报推送直接追问）
    const projectMatch = this.findProjectByName(question)
    if (projectMatch) {
      results.push('## 项目详细分析\n')
      results.push(`**${projectMatch.name}** (${projectMatch.date})`)
      results.push(`语言: ${projectMatch.language} | 星标: ${projectMatch.stars} | 增长: +${projectMatch.growthRate?.toFixed(2)}/天`)
      if (projectMatch.url) {
        results.push(`链接: ${projectMatch.url}`)
      }
      results.push(`\n${projectMatch.analysis || '暂无详细分析'}`)
      return results.join('\n')
    }

    // 1. 搜索代码索引
    const codeResults = this.searchIndex(this.codeIndex, keywords)
    if (codeResults.length > 0) {
      results.push('## 代码结构\n')
      results.push(...codeResults.map(r => `- ${r.source}: ${r.content.substring(0, 200)}`))
    }

    // 2. 搜索文档索引
    const docResults = this.searchIndex(this.docIndex, keywords)
    if (docResults.length > 0) {
      results.push('\n## 相关文档\n')
      results.push(...docResults.map(r => `**${r.source}**\n${r.content.substring(0, 300)}`))
    }

    // 3. 搜索 Notion（简单匹配）
    const notionResults = this.searchNotion(keywords)
    if (notionResults.length > 0) {
      results.push('\n## 历史日报\n')
      results.push(...notionResults.map(r => `- ${r.title} (${r.date})`))
    }

    // 4. 搜索本地历史
    const localResults = this.searchLocalHistory(keywords)
    if (localResults.length > 0) {
      results.push('\n## 历史日报内容\n')
      for (const item of localResults) {
        const analysisPreview = item.analysis ? item.analysis.substring(0, 500) + (item.analysis.length > 500 ? '...' : '') : '暂无分析内容'
        results.push(`**${item.name}** (${item.date})\n${analysisPreview}\n`)
      }
    }

    // 如果没有找到相关内容，返回项目基本信息
    if (results.length === 0) {
      return this.getProjectOverview()
    }

    return results.join('\n')
  }

  /**
   * 通过项目名精确查找（支持 owner/repo 或 repo 名称）
   */
  private findProjectByName(question: string): any | null {
    const q = question.trim().toLowerCase()

    for (const item of this.localHistoryCache) {
      const name = (item.name || '').toLowerCase()
      const repoName = name.split('/').pop() || ''

      if (q === name || q === repoName || q.includes(name) || q.includes(repoName)) {
        return item
      }
    }

    return null
  }

  /**
   * 提取关键词
   */
  private extractKeywords(question: string): string[] {
    // 简单的关键词提取（可以后续优化为更智能的算法）
    const words = question.toLowerCase()
      .replace(/[？?！!，,、。.\s]/g, ' ')
      .split(' ')
      .filter(w => w.length > 1)

    // 去重
    return [...new Set(words)]
  }

  /**
   * 搜索索引
   */
  private searchIndex(index: KnowledgeItem[], keywords: string[]): KnowledgeItem[] {
    const results: KnowledgeItem[] = []

    for (const item of index) {
      const score = this.calculateRelevance(item, keywords)
      if (score > 0) {
        results.push({ ...item, metadata: { ...item.metadata, score } })
      }
    }

    // 按相关性排序并返回前3个
    return results
      .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
      .slice(0, 3)
  }

  /**
   * 计算相关性分数
   */
  private calculateRelevance(item: KnowledgeItem, keywords: string[]): number {
    let score = 0
    const content = item.content.toLowerCase()
    const source = item.source.toLowerCase()

    for (const keyword of keywords) {
      if (source.includes(keyword)) {
        score += 3 // 文件名匹配权重高
      }
      if (content.includes(keyword)) {
        score += 1
      }
    }

    return score
  }

  /**
   * 搜索 Notion（标题 + 内容匹配）
   */
  private searchNotion(keywords: string[]): any[] {
    const results: { data: any; score: number }[] = []

    for (const [title, data] of this.notionCache) {
      const titleLower = title.toLowerCase()
      const contentLower = (data.content || '').toLowerCase()
      let score = 0

      for (const keyword of keywords) {
        if (titleLower.includes(keyword)) score += 3
        if (contentLower.includes(keyword)) score += 1
      }

      if (score > 0) {
        results.push({ data, score })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(r => r.data)
  }

  /**
   * 获取项目概览（兜底内容）
   */
  private getProjectOverview(): string {
    return `
## 项目概览

这是一个 **GitHub 前端技术日报自动化系统**，主要功能包括：

### 核心功能
1. **数据采集** - 自动获取 GitHub、GitLab、Bitbucket 等平台的热门项目
2. **智能分析** - 使用 GLM 大模型分析项目的技术原理
3. **内容生成** - 生成每日技术日报并同步到 Notion
4. **多渠道通知** - 支持 QQ、邮件、企业微信等多种推送方式

### 技术栈
- Node.js + Express
- GLM API (智谱AI)
- Notion API
- 定时任务 (node-cron)

### 配置文件
- 环境配置: \`.env\`
- 主入口: \`src/index.js\`
- 配置文档: 项目根目录下的 *.md 文件
    `.trim()
  }

  /**
   * 搜索本地历史
   */
  private searchLocalHistory(keywords: string[]): any[] {
    const results: any[] = []

    for (const item of this.localHistoryCache) {
      const score = this.calculateLocalRelevance(item, keywords)
      if (score > 0) {
        results.push({ ...item, score })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }

  /**
   * 计算本地历史相关性
   */
  private calculateLocalRelevance(item: any, keywords: string[]): number {
    let score = 0
    const name = item.name.toLowerCase()
    const language = (item.language || '').toLowerCase()
    const analysis = (item.analysis || '').toLowerCase()

    for (const keyword of keywords) {
      if (name.includes(keyword)) score += 5      // 项目名匹配权重最高
      if (language.includes(keyword)) score += 3  // 语言匹配
      if (analysis.includes(keyword)) score += 1  // 内容匹配
    }

    return score
  }
}

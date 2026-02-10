/**
 * 知识库管理模块
 *
 * 功能：
 * 1. 代码索引 - 分析项目代码结构
 * 2. 文档索引 - 解析 Markdown 文档
 * 3. 历史日报索引 - 读取本地 history.json
 * 4. Notion 检索 - 查询历史日报数据
 */

const fs = require('fs').promises
const path = require('path')
const axios = require('axios')

class KnowledgeBase {
  constructor(config) {
    this.config = config
    this.codeIndex = []
    this.docIndex = []
    this.notionCache = new Map()
    this.historyCache = new Map()  // 历史日报缓存
  }

  /**
   * 初始化知识库
   * 加载所有数据源并建立索引
   */
  async initialize() {
    await Promise.all([
      this.indexCode(),
      this.indexDocuments(),
      this.indexHistory(),  // 新增：索引历史日报
      this.indexNotion()
    ])
  }

  /**
   * 代码索引 - 分析项目结构
   */
  async indexCode() {
    const srcPath = path.join(this.config.projectRoot, 'src')
    const items = []

    try {
      // 读取主要模块结构
      const modules = ['collectors', 'analyzers', 'notifiers', 'utils', 'notion', 'web']

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
  extractCodeSummary(code, filename) {
    const lines = code.split('\n')
    const summary = []

    // 提取文件头注释
    const headerComments = []
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

    // 提取类名
    const classMatch = code.match(/class\s+(\w+)/)
    if (classMatch) {
      summary.push(`类名: ${classMatch[1]}`)
    }

    // 提取主要方法
    const methodRegex = /async\s+(\w+)\s*\(/g
    const methods = []
    let match
    while ((match = methodRegex.exec(code)) !== null && methods.length < 5) {
      methods.push(match[1])
    }

    if (methods.length > 0) {
      summary.push(`主要方法: ${methods.join(', ')}`)
    }

    return summary.join('\n')
  }

  /**
   * 文档索引 - 解析 Markdown 文档
   */
  async indexDocuments() {
    const items = []

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
  extractDocSummary(doc) {
    const lines = doc.split('\n')

    // 提取标题
    const title = lines[0].replace(/^#\s*/, '')

    // 提取前几段作为摘要
    const paragraphs = []
    let inParagraph = false

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
   * 历史日报索引 - 读取本地 history.json
   * 这是 Koishi 机器人能够回答日报问题的关键数据源
   */
  async indexHistory() {
    const historyPath = path.join(this.config.projectRoot, 'data/history.json')

    try {
      const content = await fs.readFile(historyPath, 'utf-8')
      const history = JSON.parse(content)

      // 索引每份日报
      for (const report of history.dailyReports || []) {
        const date = report.date
        const timestamp = report.timestamp

        // 构建项目列表摘要
        const repoSummary = (report.repositories || []).map(repo => {
          return `- ${repo.name}: ${repo.language || '未知语言'}, ${repo.stars || repo.stargazers_count || 0}★ (+${repo.growthRate?.toFixed(2) || 0}/天)`
        }).join('\n')

        // 构建完整内容索引
        const fullContent = `
## ${date} 前端技术日报

### 分析项目 (${report.repositories?.length || 0} 个)
${repoSummary}

### 项目详情
${(report.repositories || []).map(repo => {
  const name = repo.name
  const url = repo.url
  const desc = repo.description || '暂无描述'
  const lang = repo.language
  return `**${name}** (${lang})
- 链接: ${url}
- 描述: ${desc}`
}).join('\n\n')}
        `.trim()

        // 存储到缓存，支持多种检索方式
        this.historyCache.set(`daily-${date}`, {
          type: 'daily-report',
          date,
          timestamp,
          title: `${date} 技术日报`,
          content: repoSummary,  // 简短摘要
          fullContent,           // 完整内容
          repositories: report.repositories || [],
          url: `https://notion.so/${date}`  // 可以根据实际情况替换
        })

        // 同时用日期作为 key（方便搜索）
        this.historyCache.set(date, this.historyCache.get(`daily-${date}`))
      }

      console.log(`✓ 历史日报索引完成: ${history.dailyReports?.length || 0} 份日报`)

    } catch (error) {
      console.error('历史文件索引失败:', error.message)
      // 失败不影响其他功能，只记录错误
    }
  }

  /**
   * Notion 索引 - 获取最近日报
   */
  async indexNotion() {
    try {
      // 获取最近的日报条目
      const response = await axios.post(
        'https://api.notion.com/v1/databases/' + this.config.notion.databaseId + '/query',
        {
          page_size: 10
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

        this.notionCache.set(title, {
          type: 'notion',
          source: 'Notion日报',
          title,
          date,
          url: page.url
        })
      }

    } catch (error) {
      console.error('Notion 索引失败:', error)
      // Notion 失败不影响其他功能，只记录错误
    }
  }

  /**
   * 检索知识
   * 根据问题从多个来源检索相关知识
   */
  async retrieve(question) {
    const keywords = this.extractKeywords(question)
    const results = []

    // 判断问题类型：是问日报项目还是问系统本身
    const isAboutSystem = this.isSystemQuestion(question)

    if (isAboutSystem) {
      // 问系统本身 - 优先搜索代码和文档
      const codeResults = this.searchIndex(this.codeIndex, keywords)
      if (codeResults.length > 0) {
        results.push('## 代码结构\n')
        results.push(...codeResults.map(r => `- ${r.source}: ${r.content.substring(0, 200)}`))
      }

      const docResults = this.searchIndex(this.docIndex, keywords)
      if (docResults.length > 0) {
        results.push('\n## 相关文档\n')
        results.push(...docResults.map(r => `**${r.source}**\n${r.content.substring(0, 300)}`))
      }
    } else {
      // 问日报项目 - 优先搜索历史日报
      const historyResults = this.searchHistory(keywords)
      if (historyResults.length > 0) {
        results.push('## 历史日报中的项目\n')
        results.push(...historyResults.map(r => {
          // 检查问题是否询问详细信息
          const wantDetail = keywords.some(k => ['详细', '分析', '原理', '内容', '具体', '技术栈', 'stack'].includes(k))
          return wantDetail ? r.fullContent.substring(0, 800) : r.content
        }))
      }

      const notionResults = this.searchNotion(keywords)
      if (notionResults.length > 0) {
        results.push('\n## Notion 日报\n')
        results.push(...notionResults.map(r => `- ${r.title} (${r.date})`))
      }
    }

    // 如果没有找到相关内容，返回项目基本信息
    if (results.length === 0) {
      return this.getProjectOverview()
    }

    return results.join('\n')
  }

  /**
   * 判断是否在询问系统本身
   * 返回 true 表示问系统，false 表示问日报项目
   */
  isSystemQuestion(question) {
    const systemKeywords = [
      '系统', '部署', '配置', '安装', '运行', '启动',
      '怎么用', '如何使用', '教程', '文档',
      '代码结构', '架构', '实现', '原理',
      '自动化', '定时任务', 'cron',
      'notion', 'glm', 'api', 'token',
      '通知', '推送', 'qq', '邮件'
    ]

    const questionLower = question.toLowerCase()

    // 明确提到"这个系统"、"日报系统"
    if (questionLower.includes('这个系统') || questionLower.includes('日报系统')) {
      return true
    }

    // 包含系统相关关键词
    return systemKeywords.some(keyword => questionLower.includes(keyword))
  }

  /**
   * 提取关键词
   */
  extractKeywords(question) {
    // 简单的关键词提取
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
  searchIndex(index, keywords) {
    const results = []

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
  calculateRelevance(item, keywords) {
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
   * 搜索 Notion
   */
  searchNotion(keywords) {
    const results = []

    for (const [title, data] of this.notionCache) {
      const titleLower = title.toLowerCase()
      for (const keyword of keywords) {
        if (titleLower.includes(keyword)) {
          results.push(data)
          break
        }
      }
    }

    return results.slice(0, 3)
  }

  /**
   * 搜索历史日报
   * 支持日期、项目名、语言等关键词搜索
   */
  searchHistory(keywords) {
    const results = []

    for (const [key, data] of this.historyCache) {
      // 跳过重复的 key（daily-date 和 date 指向同一数据）
      if (!key.startsWith('daily-')) continue

      let score = 0
      const dataStr = JSON.stringify(data).toLowerCase()

      // 计算匹配分数
      for (const keyword of keywords) {
        if (data.date.includes(keyword)) {
          score += 5 // 日期匹配权重最高
        }
        if (dataStr.includes(keyword)) {
          score += 1
        }
      }

      if (score > 0) {
        results.push({ ...data, metadata: { score } })
      }
    }

    // 按相关性排序并返回前3个
    return results
      .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
      .slice(0, 3)
  }

  /**
   * 获取项目概览（兜底内容）
   */
  getProjectOverview() {
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
}

exports.KnowledgeBase = KnowledgeBase

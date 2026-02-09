# GitHub 技术日报自动化系统

<div align="center">

**AI 驱动的 GitHub 热门项目分析与日报生成系统**

[![Node.js](https://img.shields.io/badge/Node.js-v22+-green.svg)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![AI](https://img.shields.io/badge/AI-GLM--4--Flash-orange.svg)](https://open.bigmodel.cn)

每天早上 8 点自动采集 GitHub 热门项目 → AI 深度分析技术原理 → 生成结构化日报 → 推送到 QQ 群/邮件/Notion

**功能演示**：支持 QA 问答机器人，可基于历史日报回答项目相关问题

</div>

---

## 目录

- [功能特性](#-功能特性)
- [系统架构](#-系统架构)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [详细配置](#-详细配置)
- [项目结构](#-项目结构)
- [工作流程](#-工作流程)
- [QA 问答机器人](#-qa-问答机器人)
- [API 参考](#-api-参考)
- [故障排查](#-故障排查)
- [常见问题](#-常见问题)
- [贡献指南](#-贡献指南)

---

## ✨ 功能特性

### 核心功能

- 🤖 **AI 深度分析**
  - 使用 GLM-4-Flash 大模型分析项目技术原理
  - 自动提取技术栈、核心功能、创新点
  - 支持 Git Clone + 代码结构提取进行深度分析

- 📊 **智能数据采集**
  - 支持 GitHub、GitLab、Bitbucket 多平台
  - 智能过滤：按语言、星标数、增长率筛选
  - 并发处理：最多 3 个项目同时分析

- 📝 **自动化日报生成**
  - 生成 Markdown 格式结构化日报
  - 包含趋势分析：新上榜、持续热门、增长冠军
  - 技术栈统计：语言分布、平均星标

- 🗄️ **多渠道存储**
  - Notion 知识库自动同步
  - 本地历史记录（`data/history.json`）
  - 保留最近 30 天数据

- 📢 **多渠道通知**
  - QQ 群 @all + 摘要 + 链接
  - HTML 格式邮件通知
  - 支持企业微信、钉钉、Telegram 等

- 🧹 **智能内存管理**
  - 自动垃圾回收
  - 日志自动清理（保留 7 天）
  - 内存超阈值自动清理

- ⏰ **定时任务调度**
  - Cron 表达式支持
  - 时区配置
  - 默认每天 8:00 执行

### 新增特性 ⭐

- 🧠 **QA 问答机器人**
  - 基于历史日报的智能问答
  - 多源知识检索（代码、文档、Notion、本地历史）
  - 支持项目查询、技术原理解答

- 💾 **本地历史索引**
  - 自动索引本地历史日报
  - 支持按项目名、语言、内容搜索
  - 相关性评分算法

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub 技术日报自动化系统                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │   定时任务    │ ───▶ │   数据采集    │ ───▶ │   AI 分析    │   │
│  │  (Scheduler) │      │  (Collectors) │      │ (Analyzers)  │   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
│          │                     │                     │            │
│          ▼                     ▼                     ▼            │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │   内存管理    │      │   数据处理    │      │   内容生成    │   │
│  │  (Cleanup)   │      │(DataAnalyzer)│      │ (Generators) │   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
│                                                      │            │
│          ┌─────────────────────────────────────────┘            │
│          ▼                                                       │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │  Notion 存储 │      │   QQ 推送    │      │   邮件通知   │   │
│  │(NotionClient)│      │  (Notifiers) │      │   (Email)    │   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Koishi QA Bot 问答系统                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐   │
│  │  消息监听    │ ───▶ │  知识检索    │ ───▶ │   AI 回答    │   │
│  │ (Koishi Core)│      │(KnowledgeBase)│      │  (GLM API)   │   │
│  └──────────────┘      └──────────────┘      └──────────────┘   │
│                                 │                                 │
│                          ┌──────┴──────┐                          │
│                          ▼             ▼                          │
│                   ┌──────────┐  ┌──────────┐                     │
│                   │本地历史  │  │ Notion  │                      │
│                   │history.json│  │  API   │                       │
│                   └──────────┘  └──────────┘                     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流向

```
GitHub/GitLab/Bitbucket API
    ↓
[过滤系统] → 语言、星标、增长率筛选
    ↓
[并发处理器] → 最多 3 个项目同时分析
    ↓
[GIT Clone] → 克隆到 /tmp/github-analysis/
    ↓
[代码提取] → 提取 package.json、README、核心文件
    ↓
[GLM AI 分析] → 深度技术原理分析
    ↓
[数据统计] → 趋势分析、语言分布
    ↓
[日报生成] → Markdown 格式
    ↓
[多渠道存储] → Notion + history.json
    ↓
[消息推送] → QQ 群 + 邮件
```

---

## 📦 技术栈

| 组件 | 技术选型 | 版本要求 |
|------|----------|----------|
| 运行环境 | Node.js | v22+ |
| 包管理器 | npm | v10+ |
| HTTP 客户端 | Axios | latest |
| AI 模型 | GLM-4-Flash (智谱AI) | - |
| 知识库 | Notion API | 2022-06-28 |
| 定时任务 | node-cron | latest |
| 邮件发送 | Nodemailer | latest |
| WebSocket | ws | latest |
| 机器人框架 | Koishi | v4.18+ |
| TypeScript | TypeScript | v5+ |

---

## 🚀 快速开始

### 前置要求

- Node.js v22 或更高版本
- npm 或 yarn
- （可选）Docker - 用于运行 NapCat QQ 机器人

### 1. 克隆项目

```bash
git clone https://github.com/joke-lx/github-notifier.git
cd github-notifier
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制环境变量模板并填写配置：

```bash
cp .env.template .env
nano .env  # 或使用你喜欢的编辑器
```

**⚠️ 重要提示**：
- `.env` 文件包含敏感信息，**不要提交到 Git**
- 所有配置项的详细说明见[详细配置](#-详细配置)章节

### 4. 启动服务

```bash
# 开发模式（立即执行一次测试）
npm run dev

# 生产模式（启动定时任务）
npm start

# 使用 PM2 守护进程（推荐）
npm install -g pm2
pm2 start src/index.js --name github-daily
pm2 save
pm2 startup
```

### 5. 验证运行

```bash
# 查看日志
tail -f logs/daily.log

# 检查 PM2 状态
pm2 status
pm2 logs github-daily
```

---

## ⚙️ 详细配置

### 配置文件说明

项目使用 `.env` 文件管理所有配置。配置项分为以下几类：

1. **必需配置** - 系统运行必须的配置
2. **平台配置** - GitHub/GitLab/Bitbucket API
3. **AI 配置** - GLM 大模型配置
4. **存储配置** - Notion 数据库配置
5. **通知配置** - QQ/邮件/企业微信等
6. **监控配置** - 采集过滤规则
7. **性能配置** - 内存管理、并发控制
8. **调度配置** - 定时任务配置

---

### 必需配置

#### GLM API (智谱AI)

**必需程度**：⭐⭐⭐⭐⭐ (必须)

```bash
GLM_API_KEY=your_glm_api_key_here
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
```

**获取方式**：

1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 进入「API Keys」页面
4. 点击「创建 API Key」
5. 复制生成的 Key（格式：`xxxxxxxx.xxxxxxxxxxxxxxxx`）

**注意事项**：
- API Key 包含两部分，用 `.` 分隔，**必须完整复制**
- 新用户有免费额度，约 100 万 tokens
- GLM-4-Flash 模型性价比最高，推荐使用

---

#### Notion 配置

**必需程度**：⭐⭐⭐⭐⭐ (必须)

```bash
NOTION_TOKEN=your_notion_integration_token_here
NOTION_DATABASE_ID=your_database_id_here
```

**获取方式**：

**1. 创建 Notion Integration**

1. 访问 [Notion Developers](https://www.notion.so/my-integrations)
2. 点击「+ New integration」
3. 填写基本信息：
   - Name: `GitHub Daily Bot`（或其他名称）
   - Associated workspace: 选择你的工作区
   - Type: `Internal`
4. 点击「Submit」
5. 复制「Internal Integration Token」（格式：`ntn_xxxxxxxxxxxxxxxxxxxx`）

**2. 创建 Notion Database**

1. 在 Notion 中创建新页面
2. 添加 Database，选择「Table」
3. 设置 Database 属性：
   - **title** (Title 类型) - 日报标题
   - **date** (Date 类型) - 日报日期
4. 点击右上角「...」→「Add connections」
5. 选择刚创建的 Integration

**3. 获取 Database ID**

1. 打开创建的 Database 页面
2. 从 URL 中复制 Database ID
   - URL 格式：`https://www.notion.so/username/[Database_ID]?v=...`
   - Database ID 是 32 位字符串

**注意事项**：
- Token 和 Database ID 必须匹配同一个工作区
- Integration 必须添加到 Database 的连接中

---

### 平台配置

#### GitHub 配置

**必需程度**：⭐⭐⭐⭐⭐ (必须)

```bash
GITHUB_TOKEN=your_github_token_here
```

**获取方式**：

1. 访问 [GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. 点击「Generate new token (classic)」
3. 设置：
   - Note: `GitHub Daily Bot`
   - Expiration: 选择过期时间（建议 90 天或更长）
   - Scopes: 勾选 `public_repo`（读取公共仓库）
4. 点击「Generate token」
5. 复制 Token（格式：`ghp_xxxxxxxxxxxxxxxxxxxx`）

**注意事项**：
- Token 只显示一次，请妥善保管
- 未认证用户每小时限制 60 次请求
- 认证用户每小时限制 5000 次请求

---

#### GitLab 配置 (可选)

```bash
GITLAB_TOKEN=your_gitlab_token_here
GITLAB_URL=https://gitlab.com
```

**获取方式**：

1. 访问 [GitLab User Settings → Access Tokens](https://gitlab.com/-/user_settings/personal_access_tokens)
2. 点击「Add new token」
3. 设置：
   - Token name: `GitHub Daily Bot`
   - Expiration: 选择过期时间
   - Scopes: 勾选 `read_api`
4. 点击「Create personal access token」
5. 复制 Token

---

#### Bitbucket 配置 (可选)

```bash
BITBUCKET_TOKEN=your_bitbucket_token_here
```

**获取方式**：

1. 访问 [Bitbucket Settings → Access Tokens](https://bitbucket.org/account/settings/app-passwords/)
2. 点击「Create repository access token」
3. 设置：
   - Label: `GitHub Daily Bot`
   - Permissions: 勾选 `Repository: Read`
4. 点击「Create」
5. 复制 Token

---

### 通知配置

#### QQ 群通知（推荐）

**必需程度**：⭐⭐⭐ (推荐)

使用 **NapCat**（推荐）或 go-cqhttp 实现 QQ 通知。

**方式一：使用 NapCat（推荐）**

1. 安装 NapCat：

```bash
docker run -d \
  --name napcat \
  --restart unless-stopped \
  -p 3001:3001 \
  -p 6099:6099 \
  -v ~/napcat/config:/app/napcat/config \
  docker.1ms.run/mlikiowa/napcat-docker:latest
```

2. 扫码登录 QQ：

```bash
# 查看二维码
docker logs -f napcat

# 或访问 Web UI
http://localhost:6099
```

3. 配置 `.env`：

```bash
QQ_BOT_SELF_ID=你的QQ号
QQ_GROUP_ID=你的QQ群号
QQ_BOT_HOST=127.0.0.1
QQ_BOT_PORT=3001
```

**方式二：使用 go-cqhttp**

参考 [go-cqhttp 文档](https://docs.go-cqhttp.org/)

---

#### 邮件通知 (可选)

```bash
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password_or_app_password
```

**QQ 邮箱配置示例**：

1. 登录 QQ 邮箱网页版
2. 进入「设置」→「账户」
3. 开启「POP3/SMTP 服务」
4. 点击「生成授权码」
5. 使用授权码作为 `EMAIL_PASS`

```bash
EMAIL_USER=123456789@qq.com
EMAIL_PASS=abcdefghijklmnop  # 授权码，不是QQ密码
```

**Gmail 配置示例**：

1. 启用两步验证
2. 生成应用专用密码
3. 使用应用专用密码作为 `EMAIL_PASS`

```bash
EMAIL_USER=yourname@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop  # 应用专用密码（包含空格）
```

---

#### 企业微信通知 (可选)

**方式一：企业微信机器人**

```bash
WEWORK_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=your_key_here
```

**获取方式**：

1. 在企业微信群中点击「群设置」
2. 选择「群机器人」→「添加机器人」→「新建机器人」
3. 复制 Webhook URL 中的 `key` 参数

**方式二：企业微信应用消息**

```bash
WECOM_CORP_ID=your_corp_id_here
WECOM_AGENT_ID=your_agent_id_here
WECOM_SECRET=your_secret_here
WECOM_TO_USER=@all  # 或指定成员ID，多个用|分隔
```

**获取方式**：

1. 登录 [企业微信管理后台](https://work.weixin.qq.com/)
2. 进入「应用管理」→「你的应用」
3. 查看「应用信息」→「企业 ID」(`CORP_ID`)
4. 查看「应用信息」→「AgentId」、`Secret`

---

#### 钉钉通知 (可选)

```bash
DINGTALK_WEBHOOK=your_dingtalk_webhook_url
DINGTALK_SECRET=your_dingtalk_secret  # 可选，加签验证
```

**获取方式**：

1. 在钉钉群中点击「群设置」
2. 选择「智能群助手」→「添加机器人」→「自定义」
3. 设置机器人名称
4. 选择「安全设置」：
   - 方式一：「加签」- 复制密钥到 `DINGTALK_SECRET`
   - 方式二：「自定义关键词」- 添加关键词「日报」
5. 复制 Webhook URL

---

#### Telegram 通知 (可选)

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```

**获取方式**：

**1. 获取 Bot Token**：

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`
3. 按提示设置机器人名称
4. 复制生成的 Token（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

**2. 获取 Chat ID**：

1. 在 Telegram 中搜索 [@userinfobot](https://t.me/userinfobot)
2. 发送 `/start`
3. 复制返回的 Chat ID

---

### 监控配置

```bash
# 监控的编程语言（逗号分隔，留空则监控所有语言）
MONITOR_LANGUAGES=TypeScript,JavaScript,Vue,React,Next.js,Go,Rust

# 最小星标数（默认：100）
MIN_STARS=100

# 最小增长率（星/天，默认：5）
MIN_GROWTH=5

# 排除已归档的仓库（默认：true）
EXCLUDE_ARCHIVED=true

# 排除的仓库（逗号分隔）
EXCLUDE_REPOS=repo1/repo1,repo2/repo2
```

**说明**：

- `MONITOR_LANGUAGES`: 只采集指定语言的项目
- `MIN_STARS`: 过滤星标数低于此值的项目
- `MIN_GROWTH`: 过滤增长率低于此值的项目
- `EXCLUDE_ARCHIVED`: 排除已归档的仓库
- `EXCLUDE_REPOS`: 手动排除特定仓库

---

### 性能配置

```bash
# AI 分析并发数（默认：3）
MAX_CONCURRENCY=3

# 缓存 TTL（毫秒，默认：1800000 = 30分钟）
CACHE_TTL=1800000

# Git Clone 超时时间（毫秒，默认：60000 = 60秒）
GIT_CLONE_TIMEOUT_MS=60000

# 最大仓库大小（MB，默认：50）
MAX_REPO_SIZE_MB=50

# 最大文件数量（默认：500）
MAX_FILE_COUNT=500

# 深度分析开关（默认：true）
DEEP_ANALYSIS_ENABLED=true

# 降级到 README 分析（默认：true）
FALLBACK_TO_README=true
```

**说明**：

- `MAX_CONCURRENCY`: 同时分析的项目数量，过高可能导致内存不足
- `CACHE_TTL`: 分析结果缓存时间
- `GIT_CLONE_TIMEOUT_MS`: Git Clone 超时时间
- `MAX_REPO_SIZE_MB`: 仓库大小超过此值则跳过深度分析
- `MAX_FILE_COUNT`: 文件数量超过此值则跳过深度分析
- `DEEP_ANALYSIS_ENABLED`: 是否启用代码深度分析
- `FALLBACK_TO_README`: 深度分析失败时是否降级到 README 分析

---

### 内存管理配置

```bash
# 自动清理开关（默认：true）
AUTO_CLEAN_ENABLED=true

# 清理间隔（小时，默认：6）
CLEAN_INTERVAL_HOURS=6

# 内存阈值（MB，默认：800）
MEMORY_THRESHOLD_MB=800

# 日志保留天数（默认：7）
LOG_RETENTION_DAYS=7

# 临时代码目录
TEMP_CODE_DIR=/tmp/github-analysis
```

**说明**：

- `AUTO_CLEAN_ENABLED`: 启用自动内存清理
- `CLEAN_INTERVAL_HOURS`: 自动清理间隔
- `MEMORY_THRESHOLD_MB`: 进程内存超过此值时触发清理
- `LOG_RETENTION_DAYS`: 日志文件保留天数
- `TEMP_CODE_DIR`: Git Clone 临时目录

---

### 调度配置

```bash
# 定时任务时间（默认：08:00）
SCHEDULE=08:00

# 时区（默认：Asia/Shanghai）
TZ=Asia/Shanghai
```

**说明**：

- `SCHEDULE`: 支持「HH:MM」格式或 Cron 表达式
  - 简单格式：`08:00`、`09:30`
  - Cron 表达式：`0 8 * * *`（每天 8 点）
- `TZ`: 支持的时区：
  - `Asia/Shanghai` - 北京时间
  - `Asia/Tokyo` - 东京时间
  - `America/New_York` - 纽约时间
  - `Europe/London` - 伦敦时间
  - `UTC` - UTC 时间

**Cron 表达式示例**：

```bash
# 每天早上 8 点
SCHEDULE=0 8 * * *

# 每周一早上 9 点
SCHEDULE=0 9 * * 1

# 每天早上 8 点和下午 6 点
SCHEDULE=0 8,18 * * *

# 每 2 小时
SCHEDULE=0 */2 * * *
```

---

### Web 服务器配置 (可选)

```bash
# Web 服务器开关（默认：false）
WEB_SERVER_ENABLED=false

# Web 服务器端口（默认：3000）
WEB_SERVER_PORT=3000
```

**说明**：

- 提供 HTTP 接口手动触发日报生成
- 端点：`POST /api/trigger`

---

## 📂 项目结构

```
github-notifier/
├── src/                          # 核心源代码
│   ├── index.js                  # 主入口 - 定时任务调度器
│   │
│   ├── collectors/               # 数据采集模块
│   │   ├── github.js            # GitHub API 采集
│   │   ├── gitlab.js            # GitLab API 采集
│   │   ├── bitbucket.js         # Bitbucket API 采集
│   │   └── unified.js           # 统一采集器（多平台）
│   │
│   ├── analyzers/                # AI 分析模块
│   │   ├── glm.js               # GLM 大模型分析器
│   │   └── data-analyzer.js     # 数据统计分析
│   │
│   ├── generators/               # 内容生成模块
│   │   └── daily-report.js      # 日报模板生成器
│   │
│   ├── notifiers/                # 消息推送模块
│   │   ├── qq-napcat.js         # QQ 通知 (NapCat)
│   │   ├── email.js             # 邮件通知
│   │   └── qq-koishi.js         # Koishi 集成
│   │
│   ├── notion/                   # Notion 集成
│   │   └── client.js            # Notion API 客户端
│   │
│   ├── utils/                    # 工具模块
│   │   ├── cache.js             # 缓存系统
│   │   ├── cleanup.js           # 内存管理
│   │   ├── code-manager.js      # 代码克隆与分析
│   │   ├── concurrent.js        # 并发处理器
│   │   ├── scheduler.js         # Cron 调度器
│   │   ├── logger.js            # 日志系统
│   │   ├── config-validator.js  # 配置验证
│   │   └── api-retry.js         # API 重试机制
│   │
│   └── web/                      # Web 服务
│       └── server.js            # HTTP 接口
│
├── koishi-bot/                   # Koishi 机器人
│   ├── plugins/
│   │   └── qa-bot/              # QA Bot 插件
│   │       ├── index.ts         # 插件入口
│   │       ├── knowledge.ts     # 知识库管理
│   │       ├── glm-client.ts    # GLM API 客户端
│   │       └── prompts.ts       # Prompt 构建器
│   ├── config.yml               # Koishi 配置
│   └── package.json             # 依赖管理
│
├── data/                         # 数据存储
│   ├── history.json             # 历史日报
│   └── cache/                   # 缓存目录
│
├── logs/                         # 日志目录
│   └── daily.log                # 运行日志
│
├── .env.template                 # 环境变量模板
├── .gitignore                    # Git 忽略文件
├── package.json                  # 依赖管理
└── README.md                     # 项目说明
```

---

## 📝 工作流程

### 每日定时任务流程

```
┌──────────────────────────────────────────────────────────────────┐
│                        每日定时任务流程                             │
│                      (每天早上 8:00 执行)                          │
└──────────────────────────────────────────────────────────────────┘

[步骤 0] 内存检查 (1-2秒)
    ├─ 检查进程内存使用
    ├─ 检查系统内存使用
    └─ 超过阈值则触发清理

[步骤 1] 数据采集 (30-60秒)
    ├─ GitHub Trending API
    │  └─ 获取热门仓库列表
    ├─ 过滤条件
    │  ├─ Star 增长率 > 5/天
    │  ├─ 排除 archived 仓库
    │  └─ 限制特定语言
    └─ 输出: trendingRepos[]

[步骤 2] 深度分析 (5-15分钟，并发处理)
    │
    ├─ 对每个仓库执行:
    │  │
    │  ├─ [2.1] Git Clone
    │  │     └─ 克隆到 /tmp/github-repos/
    │  │
    │  ├─ [2.2] 代码结构提取
    │  │     ├─ 扫描 package.json、README.md
    │  │     ├─ 分析源代码目录
    │  │     └─ 提取核心文件 (limit: 3000 tokens)
    │  │
    │  ├─ [2.3] 获取 README
    │  │     └─ 通过 GitHub API 获取
    │  │
    │  └─ [2.4] GLM AI 深度分析
    │        ├─ Prompt: 项目信息 + 代码结构 + README
    │        ├─ GLM-4-Flash 模型
    │        └─ 输出: 技术原理分析 (Markdown)
    │
    └─ 并发控制: 最多 3 个仓库同时分析

[步骤 3] 趋势分析 (<1秒)
    ├─ DataAnalyzer.analyzeTechStack()
    │  ├─ 语言分布统计
    │  ├─ 平均 Star 数
    │  └─ Top 语言排名
    │
    └─ DataAnalyzer.analyzeTrends()
       ├─ 新上榜项目
       ├─ 持续热门项目
       └─ 增长冠军

[步骤 4] 日报生成 (<1秒)
    ├─ 构建报告标题
    ├─ 格式化每个项目分析
    └─ 生成趋势总结

[步骤 5] Notion 存储 (10-30秒)
    ├─ 创建新页面
    ├─ 批量添加内容块 (每批 100 个)
    ├─ Markdown → Notion Blocks 转换
    └─ 返回页面 URL

[步骤 6] 消息推送 (5-10秒)
    ├─ QQ 群通知
    │  ├─ 发送日报摘要
    │  ├─ Notion 链接
    │  └─ @全体成员
    │
    ├─ 邮件通知 (备选)
    │  └─ HTML 格式邮件
    │
    └─ 企业微信/钉钉 (备选)

[步骤 7] 历史保存 (<1秒)
    └─ DataAnalyzer.saveDailyReport()
       ├─ 保存到 data/history.json
       ├─ 包含: name, url, language, stars, growthRate
       ├─ 新增: description, analysis
       └─ 只保留最近 30 天

[步骤 8] 清理工作
    ├─ 删除临时克隆的代码
    ├─ 清理过期缓存
    └─ 记录运行日志

总耗时: 约 5-15 分钟（取决于项目数量）
```

---

## 🤖 QA 问答机器人

### 功能说明

项目包含一个 Koishi 问答机器人，可以基于历史日报回答项目相关问题。

**启动 QA 机器人**：

```bash
cd koishi-bot
npm install
npm run dev
```

**在 QQ 群中 @机器人 提问**：

- "pdf.js 这个项目讲了什么？"
- "最近有什么 Vue 相关的项目？"
- "TypeScript 项目有哪些？"
- "这个项目是做什么的？"
- "技术架构是怎样的？"

### 知识库来源

机器人从以下来源检索知识：

1. **本地历史** - `data/history.json`
2. **代码索引** - `src/` 目录结构
3. **文档索引** - 项目根目录的 `.md` 文件
4. **Notion API** - Notion 数据库

### 相关性评分

- 项目名匹配：+5 分（权重最高）
- 编程语言匹配：+3 分
- 分析内容匹配：+1 分

---

## 📚 API 参考

### 核心类和方法

#### GitHubCollector

```javascript
const GitHubCollector = require('./src/collectors/github');

const collector = new GitHubCollector({
  token: process.env.GITHUB_TOKEN,
  languages: ['TypeScript', 'JavaScript'],
  minStars: 100,
  minGrowth: 5
});

// 获取热门仓库
const trendingRepos = await collector.getTrendingRepos();
```

#### GLMAnalyzer

```javascript
const GLMAnalyzer = require('./src/analyzers/glm');

const analyzer = new GLMAnalyzer({
  apiKey: process.env.GLM_API_KEY,
  apiUrl: process.env.GLM_API_URL
});

// 深度分析仓库
const analysis = await analyzer.analyzeRepositoryDeep(
  repo,
  codeStructure,
  readme
);
```

#### NotionClient

```javascript
const NotionClient = require('./src/notion/client');

const notionClient = new NotionClient();

// 创建日报
const pageUrl = await notionClient.createDailyReport(
  '2026-02-09',
  repositories
);

// 获取最近的日报
const recentReports = await notionClient.getRecentReports(10);

// 获取页面内容
const content = await notionClient.getPageContent(pageId);
```

---

## 🐛 故障排查

### GitHub API 限流

**问题**：`API rate limit exceeded`

**原因**：GitHub API 请求超限

**解决方案**：

1. 检查 `GITHUB_TOKEN` 是否正确
2. 等待 1 小时后重置（未认证用户）
3. 使用认证 Token（每小时 5000 次请求）
4. 减少 `MONITOR_LANGUAGES` 范围

---

### GLM API 失败

**问题**：`GLM API 调用失败`

**原因**：API Key 错误或额度不足

**解决方案**：

1. 检查 API Key 是否完整（包含 `.` 部分）
2. 确认账户有足够额度
3. 检查网络连接
4. 查看 [智谱AI文档](https://open.bigmodel.cn/dev/api)

---

### QQ 通知失败

**问题**：`QQ 推送失败`

**原因**：NapCat 未运行或配置错误

**解决方案**：

1. 确认 NapCat 容器正在运行
   ```bash
   docker ps | grep napcat
   ```

2. 检查端口是否开放
   ```bash
   telnet 127.0.0.1 3001
   ```

3. 查看 NapCat 日志
   ```bash
   docker logs -f napcat
   ```

4. 重新扫码登录
   ```bash
   docker logs napcat  # 查看二维码
   ```

---

### Notion 同步失败

**问题**：`Notion 页面创建失败`

**原因**：Database ID 或 Token 错误

**解决方案**：

1. 检查 Database ID 是否正确（32 位字符串）
2. 确认 Notion Token 有权限
3. 检查数据库 Schema 配置
4. 确保 Integration 已添加到 Database

---

### 内存不足

**问题**：`JavaScript heap out of memory`

**原因**：分析的仓库太大或并发数过高

**解决方案**：

1. 降低并发数
   ```bash
   MAX_CONCURRENCY=1
   ```

2. 减小仓库大小限制
   ```bash
   MAX_REPO_SIZE_MB=30
   MAX_FILE_COUNT=300
   ```

3. 关闭深度分析
   ```bash
   DEEP_ANALYSIS_ENABLED=false
   ```

4. 增加 Node.js 内存限制
   ```bash
   node --max-old-space-size=4096 src/index.js
   ```

---

## ❓ 常见问题

### Q1: 为什么有些项目没有深度分析？

**A**：可能的原因：
- 仓库大小超过 `MAX_REPO_SIZE_MB` 限制
- 文件数量超过 `MAX_FILE_COUNT` 限制
- Git Clone 超时
- 代码主要是二进制文件（图片、视频等）

系统会自动降级到 README 分析。

---

### Q2: 如何修改定时任务时间？

**A**：修改 `.env` 文件中的 `SCHEDULE` 配置：

```bash
# 简单格式
SCHEDULE=09:00

# Cron 表达式
SCHEDULE=0 9 * * *
```

重启服务后生效。

---

### Q3: 如何只监控特定语言？

**A**：修改 `.env` 文件中的 `MONITOR_LANGUAGES`：

```bash
MONITOR_LANGUAGES=TypeScript,Vue,Go
```

留空则监控所有语言。

---

### Q4: 历史数据保存在哪里？

**A**：
- 本地：`data/history.json`（最近 30 天）
- Notion：永久存储在配置的数据库中

---

### Q5: 如何查看运行日志？

**A**：

```bash
# 查看实时日志
tail -f logs/daily.log

# 使用 PM2
pm2 logs github-daily

# 查看最近的错误
grep ERROR logs/daily.log | tail -20
```

---

### Q6: 如何手动触发日报生成？

**A**：

```bash
# 方法一：直接运行
npm run dev

# 方法二：使用 Web API（需要开启 WEB_SERVER_ENABLED）
curl -X POST http://localhost:3000/api/trigger
```

---

### Q7: QA 机器人回答不准确？

**A**：
1. 确保本地历史有数据（`data/history.json`）
2. 重新启动 Koishi Bot 加载最新知识
3. 使用更具体的问题关键词

---

### Q8: 如何部署到服务器？

**A**：

推荐使用 PM2：

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/index.js --name github-daily

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交 Issue

请使用以下模板：

```markdown
## 问题描述
简要描述问题

## 复现步骤
1. 步骤一
2. 步骤二

## 期望行为
描述期望的正确行为

## 环境信息
- Node.js 版本：
- 操作系统：
- 错误日志：

## 截图（可选）
```

### 提交 Pull Request

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

---

## 📄 许可证

MIT License

---

## 🔗 相关链接

- [GitHub Trending](https://github.com/trending)
- [智谱AI开放平台](https://open.bigmodel.cn/)
- [Notion API 文档](https://developers.notion.com/)
- [Koishi 文档](https://koishi.js.org/)
- [NapCat 文档](https://napneko.github.io/)

---

## 📮 联系方式

- GitHub: [@joke-lx](https://github.com/joke-lx)
- Issues: [GitHub Issues](https://github.com/joke-lx/github-notifier/issues)

---

<div align="center">

**Made with ❤️ by [joke-lx](https://github.com/joke-lx)**

如果这个项目对你有帮助，请给个 ⭐ Star！

</div>

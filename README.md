# GitHub 技术日报系统

> 自动化采集 GitHub 热门项目，使用 AI 深度分析，生成技术日报并多渠道推送

## 🌟 核心功能

- **智能采集**：自动获取 GitHub 前端领域热门项目（支持自定义语言和筛选条件）
- **AI 分析**：使用 GLM-4 大模型深度分析项目技术架构和代码结构
- **知识管理**：自动同步到 Notion 数据库，构建技术知识库
- **多渠道推送**：支持 QQ、邮件、Server酱等多种通知方式
- **智能问答**：集成 Koishi 机器人，可回答日报项目和系统相关问题

## 📦 项目结构

统一管理项目，包含两个子模块：
- `my-github/` - 技术日报主系统
- `napcat/` - NapCat QQ 机器人框架

## 目录结构

```
github-tech-daily/
├── my-github/           # 主系统
│   ├── src/             # 核心代码
│   │   ├── collectors/  # 数据采集模块
│   │   ├── analyzers/   # AI 分析模块
│   │   ├── notifiers/   # 通知推送模块
│   │   └── notion/      # Notion 集成
│   ├── koishi-bot/      # QQ 问答机器人
│   │   └── plugins/     # 机器人插件
│   │       └── qa-bot/  # 问答插件
│   ├── data/            # 数据存储
│   │   └── history.json # 历史日报数据
│   └── logs/            # 日志文件
└── napcat/              # NapCat QQ 机器人
    ├── config.json      # NapCat 配置
    ├── data/            # 运行时数据
    └── start.sh         # 启动脚本
```

## ⚙️ 环境配置

### 主系统配置

配置文件位置：`/root/github-tech-daily/my-github/.env`

**必需配置：**
```bash
# GitHub API
GITHUB_TOKEN=your_github_token

# GLM AI API
GLM_API_KEY=your_glm_api_key
GLM_API_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions

# Notion 集成
NOTION_TOKEN=your_notion_token
NOTION_DATABASE_ID=your_database_id
```

**可选配置：**
```bash
# 监控语言（逗号分隔）
MONITOR_LANGUAGES=TypeScript,JavaScript,Vue,React,Next.js

# 筛选条件
MIN_STARS=100          # 最小星标数
MIN_GROWTH=5           # 最小增长率（星/天）

# 自动清理
AUTO_CLEAN_ENABLED=true
CLEAN_INTERVAL_HOURS=6
MEMORY_THRESHOLD_MB=800

# 深度分析
DEEP_ANALYSIS_ENABLED=true
```

**通知渠道配置：**
```bash
# QQ 通知（NapCat）
QQ_BOT_TOKEN=your_napcat_token
QQ_GROUP_ID=your_group_id

# 邮件通知
EMAIL_USER=your_email
EMAIL_PASS=your_email_password

# Server酱
SERVERCHAN_SEND_KEY=your_serverchan_key
```

## 🚀 启动方式

### 1. 启动 NapCat（QQ 机器人框架）
```bash
cd /root/github-tech-daily/napcat
./start.sh
```

访问 WebUI 进行 QQ 登录：`http://your-server:6099/webui`

### 2. 启动技术日报系统
```bash
cd /root/github-tech-daily/my-github
npm start
```

**测试模式：**
```bash
npm run dev  # 立即执行一次任务（用于测试）
```

### 3. 启动 Koishi 问答机器人
```bash
cd /root/github-tech-daily/my-github/koishi-bot
npm start
```

机器人将自动连接到 NapCat，可在 QQ 群中 @机器人提问。

## 集成关系

```
┌─────────────────────────────────────────────────────┐
│        GitHub 技术日报系统 (my-github)               │
├─────────────────────────────────────────────────────┤
│                                                     │
│   数据采集 → AI分析 → 日报生成 → 存储               │
│       │                                            │
│       └──────────────┬───────────────────────┐     │
│                      │                       │     │
│              ┌───────▼────────┐     ┌───────▼─────┐│
│              │ NapCat API     │     │ 其他通知渠道 ││
│              │ HTTP 3000      │     │ 邮件/微信等  ││
│              └────────────────┘     └─────────────┘│
│                      │                       │     │
│              ┌───────▼────────┐     ┌───────▼─────┐│
│              │  QQ 群通知     │     │ 多渠道推送   ││
│              └────────────────┘     └─────────────┘│
│                                                     │
│   同时 Koishi 问答机器人可回答关于日报的问题        │
└─────────────────────────────────────────────────────┘
```

## 🤖 智能问答机器人

Koishi 机器人支持两类问题：

### 1. 日报项目问题（优先）
- `@机器人 最近分析了哪些项目？`
- `@机器人 google-gemini/gemini-cli 是什么技术栈？`
- `@机器人 今天的日报有什么内容？`

### 2. 系统配置问题
- `@机器人 这个系统怎么部署？`
- `@机器人 如何配置 Notion？`
- `@机器人 怎么获取 GLM API Key？`

**智能识别：** 机器人会自动判断问题类型，优先回答日报中的项目信息。

## 📝 最近更新

### v1.2.0 (2026-02-10)
- ✨ **智能问答优化**：修复机器人将问题范围锁定在工作区项目的问题
- 🎯 **优先级调整**：机器人现在优先回答日报中的 GitHub 项目问题
- 🧠 **上下文识别**：新增智能问题类型判断，自动区分系统问题和项目问题
- 🔧 **知识库改进**：优化检索逻辑，提升回答准确性

### v1.1.0
- 🚀 完整的日报生成和推送流程
- 📊 Notion 数据库集成
- 💬 QQ 群通知功能
- 🤖 Koishi 问答机器人集成


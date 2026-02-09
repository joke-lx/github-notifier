/**
 * Koishi 问答机器人插件
 * 功能：回答关于 GitHub 技术日报项目的相关问题
 *
 * 工作原理：
 * 1. 监听群消息，检测 @机器人 或特定关键词
 * 2. 提取用户问题
 * 3. 从多个来源检索知识（代码、文档、Notion）
 * 4. 调用 GLM API 生成回答
 * 5. 格式化并发送回复
 */

const { KnowledgeBase } = require('./knowledge.js')
const { GLMClient } = require('./glm-client.js')
const { PromptBuilder } = require('./prompts.js')

exports.name = 'qa-bot'

function apply(ctx, config) {
  // 初始化组件
  const knowledgeBase = new KnowledgeBase(config)
  const glmClient = new GLMClient(config.glm)
  const promptBuilder = new PromptBuilder()

  // 插件启动时的初始化
  ctx.on('ready', async () => {
    ctx.logger.info('问答机器人插件已启动')
    try {
      await knowledgeBase.initialize()
      ctx.logger.info('知识库初始化完成')
    } catch (error) {
      ctx.logger.error('知识库初始化失败:', error)
    }
  })

  // 中间件：检查是否允许触发
  const shouldTrigger = (session) => {
    // 检查是否在允许的群组中
    if (config.allowedGroups.length > 0) {
      const groupId = session.guildId || session.channelId
      if (!config.allowedGroups.includes(groupId)) {
        return false
      }
    }

    // 检查是否需要 @机器人
    if (config.requireAt) {
      const content = session.content || ''
      const hasAt = content.includes(`<at id="${session.bot.selfId}"`)
      if (!hasAt) return false
    }

    // 检查前缀
    if (config.triggerPrefix) {
      const content = session.content.trim()
      if (!content.startsWith(config.triggerPrefix)) return false
    }

    return true
  }

  // 监听消息并处理问答
  ctx.middleware(async (session, next) => {
    // 只处理群消息
    if (session.subtype !== 'group') {
      return next()
    }

    // 检查是否应该触发
    if (!shouldTrigger(session)) {
      return next()
    }

    // 提取问题（去除 @机器人和前缀）
    let question = session.content.trim()

    // 移除 @机器人 标记
    question = question.replace(/<at id=".*?">/g, '').trim()
    question = question.replace(/@\[at:.*?\]/g, '').trim()

    // 移除前缀
    if (config.triggerPrefix && question.startsWith(config.triggerPrefix)) {
      question = question.slice(config.triggerPrefix.length).trim()
    }

    // 空消息不处理
    if (!question) {
      return next()
    }

    // 发送"正在思考"提示
    let thinkingMsg = null
    try {
      thinkingMsg = await session.send('🤔 正在思考中...')
    } catch (e) {
      // 忽略发送失败
    }

    try {
      // 1. 检索相关知识
      ctx.logger.info(`收到问题: ${question}`)
      const knowledge = await knowledgeBase.retrieve(question)

      // 2. 构建 Prompt
      const prompt = promptBuilder.buildQAPrompt(question, knowledge)

      // 3. 调用 GLM API
      const answer = await glmClient.chat(prompt)

      // 4. 格式化并发送回复
      await session.bot.internal.sendGroupMsg(session.guildId, answer)

      ctx.logger.info(`已回答问题，耗时: ${Date.now() - session.timestamp}ms`)

    } catch (error) {
      ctx.logger.error('处理问题时出错:', error)
      try {
        await session.bot.internal.sendGroupMsg(session.guildId, '抱歉，处理问题时出现了错误，请稍后重试。')
      } catch (e) {
        // 忽略发送失败
      }
    } finally {
      // 撤回"正在思考"消息（如果支持）
      if (thinkingMsg) {
        try {
          await session.bot.deleteMessage(session.channelId, thinkingMsg)
        } catch {
          // 部分平台不支持撤回，忽略错误
        }
      }
    }
  })

  // 添加帮助命令
  ctx.command('qa.help', '显示问答机器人帮助信息')
    .action(async ({ session }) => {
      const helpText = `
📖 GitHub技术日报问答机器人使用指南

使用方法：
1. 在群聊中 @机器人 + 你的问题
   例如：@机器人 这个项目是做什么的？

2. 可以询问的内容包括：
   • 项目功能介绍
   • 配置方法
   • 技术原理
   • 历史日报内容
   • 代码结构说明

示例问题：
- 这个系统是如何工作的？
- 怎么配置 QQ 通知？
- 最新分析了哪些项目？
- 如何部署这个系统？
      `.trim()
      try {
        await session.bot.internal.sendGroupMsg(session.guildId, helpText)
      } catch (e) {
        ctx.logger.error('发送帮助信息失败:', e)
      }
    })

  // 添加重新加载知识库命令
  ctx.command('qa.reload', '重新加载知识库')
    .action(async ({ session }) => {
      try {
        await knowledgeBase.initialize()
        ctx.logger.info('知识库已重新加载')
        try {
          await session.bot.internal.sendGroupMsg(session.guildId, '✅ 知识库已重新加载')
        } catch (e) {
          ctx.logger.error('发送重载成功消息失败:', e)
        }
      } catch (error) {
        ctx.logger.error('重新加载知识库失败:', error)
        try {
          await session.bot.internal.sendGroupMsg(session.guildId, '❌ 重新加载知识库失败')
        } catch (e) {
          ctx.logger.error('发送重载失败消息失败:', e)
        }
      }
    })
}

exports.apply = apply

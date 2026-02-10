/**
 * GLM API 客户端
 *
 * 功能：
 * 1. 封装 GLM API 调用
 * 2. 管理对话上下文
 * 3. 错误处理和重试
 */

const axios = require('axios')

class GLMClient {
  constructor(config) {
    this.config = config
    this.conversationHistory = new Map()
  }

  /**
   * 发送聊天请求
   */
  async chat(prompt, userId, systemPrompt) {
    const messages = []

    // 添加系统提示
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      })
    }

    // 添加历史对话（如果有）
    if (userId) {
      const history = this.conversationHistory.get(userId) || []
      // 只保留最近的 5 轮对话
      const recentHistory = history.slice(-10)
      messages.push(...recentHistory)
    }

    // 添加当前用户消息
    messages.push({
      role: 'user',
      content: prompt
    })

    try {
      const response = await this.callAPI(messages)

      // 保存到历史记录
      if (userId) {
        const history = this.conversationHistory.get(userId) || []
        history.push({ role: 'user', content: prompt })
        history.push({ role: 'assistant', content: response })

        // 限制历史记录长度
        if (history.length > 20) {
          history.splice(0, history.length - 20)
        }

        this.conversationHistory.set(userId, history)
      }

      return response

    } catch (error) {
      console.error('GLM API 调用失败:', error)
      throw error
    }
  }

  /**
   * 调用 GLM API
   */
  async callAPI(messages) {
    const response = await axios.post(
      this.config.apiUrl,
      {
        model: this.config.model,
        messages: messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature
      },
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30秒超时
      }
    )

    if (response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content
    }

    throw new Error('GLM API 返回数据格式异常')
  }

  /**
   * 清除用户的对话历史
   */
  clearHistory(userId) {
    this.conversationHistory.delete(userId)
  }

  /**
   * 清除所有对话历史
   */
  clearAllHistory() {
    this.conversationHistory.clear()
  }

  /**
   * 获取用户的对话历史
   */
  getHistory(userId) {
    return this.conversationHistory.get(userId) || []
  }
}

exports.GLMClient = GLMClient

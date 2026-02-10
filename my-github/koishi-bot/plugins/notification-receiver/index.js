/**
 * 通知接收插件
 * 接收来自主项目的通知请求，并发送到 QQ 群
 */

const { Service } = require('koishi')

exports.name = 'notification-receiver'

function apply(ctx) {
  // 监听来自 HTTP 的通知请求
  ctx.on('notification-request', async (data) => {
    const { group_id, message } = data

    try {
      // 使用 internal API 发送群消息
      await ctx.bots.forEach(bot => {
        bot.internal.sendGroupMsg(group_id, message)
      })

      console.log('[notification-receiver] 消息已发送到群:', group_id)
      return { success: true }
    } catch (error) {
      console.error('[notification-receiver] 发送失败:', error)
      return { success: false, error: error.message }
    }
  })

  // 添加一个简单的 HTTP 接口（如果支持）
  ctx.server.get('/api/send-qq-message', async (req, res) => {
    const { group_id, message, secret } = req.query

    // 验证密钥
    if (secret !== process.env.API_SECRET || process.env.API_SECRET === undefined) {
      const envSecret = 'github_daily_secret' // 默认使用与 QQ_BOT_TOKEN 相同的密钥
      if (req.query.secret !== envSecret) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    try {
      const result = await ctx.emit({
        type: 'notification-request',
        group_id: group_id || process.env.QQ_GROUP_ID,
        message: decodeURIComponent(message || '')
      })

      res.json({ success: true, result })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  })
}

exports.apply = apply

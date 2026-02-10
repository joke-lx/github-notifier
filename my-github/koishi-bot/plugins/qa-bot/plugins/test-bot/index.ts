export const name = 'test-bot'

export function apply(ctx) {
  ctx.middleware((session, next) => {
    // 只处理群消息
    if (session.subtype !== 'group') return next()
    
    // 检查是否 @机器人
    if (!session.content?.includes(session.selfId)) return next()
    
    // 回复消息
    session.send('Hello! 机器人已连接成功！')
    
    return next()
  })
}

export const name = 'simple-bot';

export function apply(ctx) {
  ctx.on('message', (session) => {
    // 只处理群消息
    if (session.subtype !== 'group') return;

    // 检查是否 @机器人
    const content = session.content || '';
    const hasAt = content.includes(`<at id="${session.selfId}"`);

    if (!hasAt) return;

    console.log('[simple-bot] @检测成功');
    console.log('[simple-bot] session 详情:', {
      guildId: session.guildId,
      channelId: session.channelId,
      userId: session.userId,
      selfId: session.selfId,
      subtype: session.subtype,
      platform: session.platform
    });

    // 尝试使用 OneBot 内部 API 直接发送群消息
    // 群消息需要使用 groupId，对于 QQ 来说就是 guildId
    const groupId = session.guildId;

    console.log('[simple-bot] 尝试发送群消息到 groupId:', groupId);

    session.bot.internal.sendGroupMsg(groupId, 'Hello! QQ机器人连接成功！')
      .then(() => console.log('[simple-bot] 发送成功'))
      .catch(err => console.error('[simple-bot] 发送失败:', err.message));
  });
}

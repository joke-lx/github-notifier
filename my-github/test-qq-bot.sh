#!/bin/bash
# QQ Bot 推送测试脚本

echo "=== QQ Bot 推送测试 ==="
echo ""

# 加载环境变量
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 检查配置
echo "当前配置："
echo "  QQ_BOT_HOST: ${QQ_BOT_HOST:-127.0.0.1}"
echo "  QQ_BOT_PORT: ${QQ_BOT_PORT:-3000}"
echo "  QQ_GROUP_ID: ${QQ_GROUP_ID}"
echo "  QQ_BOT_TOKEN: ${QQ_BOT_TOKEN:0:10}..."
echo ""

# 检查 NapCat 是否运行
echo "检查 NapCat 状态..."
if ! docker ps | grep -q napcat; then
    echo "  ❌ NapCat 容器未运行"
    echo "  启动命令: cd ~/napcat && ./start.sh"
    exit 1
fi
echo "  ✓ NapCat 容器运行中"

# 检查 API 是否可用
echo ""
echo "检查 NapCat API..."
API_URL="http://${QQ_BOT_HOST:-127.0.0.1}:${QQ_BOT_PORT:-3000}"

# 测试获取状态
STATUS=$(curl -s "${API_URL}/get_status" 2>&1)
if [ $? -eq 0 ] && echo "$STATUS" | grep -q "online"; then
    echo "  ✓ NapCat API 可用，Bot 已在线"
else
    echo "  ⚠️  NapCat 可能未登录 QQ"
    echo "  请先扫码登录: http://127.0.0.1:6099/webui/"
    echo "  或查看二维码: docker logs napcat | grep -A 30 '二维码'"
fi

# 发送测试消息
echo ""
echo "发送测试消息到 QQ 群 ${QQ_GROUP_ID}..."
cat > /tmp/test-qq-payload.json << PAYLOAD
{
  "group_id": "${QQ_GROUP_ID}",
  "message": "🤖 GitHub 技术日报系统测试\n\n这是一条测试消息，如果你看到这条消息，说明 QQ Bot 推送功能配置成功！\n\n时间: $(date '+%Y-%m-%d %H:%M:%S')"
}
PAYLOAD

RESPONSE=$(curl -s -X POST "${API_URL}/send_group_msg" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${QQ_BOT_TOKEN}" \
  -d @/tmp/test-qq-payload.json 2>&1)

if echo "$RESPONSE" | grep -q "retcode.*0\|message_id"; then
    echo "  ✓ 测试消息发送成功！"
    echo ""
    echo "请检查 QQ 群是否收到测试消息。"
else
    echo "  ❌ 消息发送失败"
    echo "  响应: $RESPONSE"
    echo ""
    echo "可能的原因："
    echo "  1. QQ Bot 未登录（请先扫码登录）"
    echo "  2. Bot 不在目标群中"
    echo "  3. API 配置错误"
fi

echo ""
echo "=== 查看更多状态 ==="
echo "  NapCat 日志: docker logs -f napcat"
echo "  WebUI 配置: http://127.0.0.1:6099/webui/"
echo "  重启 NapCat: docker restart napcat"

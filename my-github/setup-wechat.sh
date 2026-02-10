#!/bin/bash
# Server酱 微信推送 - 1分钟配置完成

echo "=== Server酱 微信推送配置 ==="
echo ""
echo "📱 第一步：获取 SendKey"
echo ""
echo "1. 打开手机微信，扫描下方二维码关注「Server酱」"
echo ""
echo "   [二维码图片]"
echo ""
echo "   或访问：https://sct.ftqq.com/"
echo ""
echo "2. 微信扫码登录网站"
echo ""
echo "3. 点击「SendKey」菜单"
echo ""
echo "4. 复制显示的 Key（类似：SCT123456...）"
echo ""
echo "=================================="
echo ""
read -p "📝 粘贴你的 SendKey: " SEND_KEY

if [ -z "$SEND_KEY" ]; then
    echo "❌ SendKey 不能为空"
    exit 1
fi

echo ""
echo "正在配置..."

# 更新 .env
sed -i "s/SERVERCHAN_SEND_KEY=.*/SERVERCHAN_SEND_KEY=$SEND_KEY/" /root/my-github/.env

echo "✓ 配置完成！"
echo ""
echo "=================================="
echo ""
echo "📧 配置预览："
grep "SERVERCHAN" /root/my-github/.env
echo ""
echo "=================================="
echo ""
echo "🧪 现在可以测试："
echo "   cd /root/my-github"
echo "   npm run dev"
echo ""
echo "✅ 测试成功后重启服务："
echo "   pm2 restart github-daily"
echo ""
echo "📱 你的微信将收到技术日报推送！"

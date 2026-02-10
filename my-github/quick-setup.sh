#!/bin/bash
# QQ Bot 快速配置脚本

echo "=== NapCat QQ Bot 配置向导 ==="
echo ""
echo "请先在你的电脑上完成以下步骤："
echo ""
echo "1. 下载并运行 NapCat"
echo "   https://github.com/NapNeko/NapCatQQ/releases"
echo ""
echo "2. 用手机 QQ 扫码登录"
echo ""
echo "3. 安装 ngrok 并启动："
echo "   ngrok http 3000"
echo ""
echo "4. 复制 ngrok 给你的公网地址（如 https://abc123.ngrok.io）"
echo ""
echo "=================================="
echo ""
read -p "输入 ngrok 地址 (如 abc123.ngrok.io): " NGROK_HOST
read -p "输入你在 NapCat 中设置的 Secret: " SECRET
read -p "输入你要发送消息的 QQ 群号: " GROUP_ID

echo ""
echo "正在配置..."

# 更新 .env 文件
sed -i "s/QQ_BOT_TOKEN=.*/QQ_BOT_TOKEN=$SECRET/" .env
sed -i "s/QQ_GROUP_ID=.*/QQ_GROUP_ID=$GROUP_ID/" .env
sed -i "s|QQ_BOT_HOST=.*|QQ_BOT_HOST=$NGROK_HOST|" .env
sed -i "s/QQ_BOT_PORT=.*/QQ_BOT_PORT=443/" .env

echo "✓ 配置已更新"
echo ""
echo "配置预览："
grep "QQ_" .env
echo ""
echo "现在可以测试运行："
echo "  npm run dev"
echo ""
echo "测试成功后重启服务："
echo "  pm2 restart github-daily"

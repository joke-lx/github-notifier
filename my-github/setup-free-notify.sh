#!/bin/bash
# 免费通知方式配置向导

echo "=== 免费通知方式配置向导 ==="
echo ""
echo "请选择一个通知方式（完全免费，无限制）："
echo ""
echo "1. Telegram Bot (推荐)"
echo "   - 完全免费，全球可用"
echo "   - 消息无限制"
echo "   - 需要科学上网"
echo ""
echo "2. 钉钉机器人"
echo "   - 完全免费，国内可用"
echo "   - 消息无限制"
echo "   - 需要钉钉账号"
echo ""
echo "3. 飞书机器人"
echo "   - 完全免费，国内可用"
echo "   - 消息无限制"
echo "   - 需要飞书账号"
echo ""
read -p "请输入选择 (1/2/3): " choice

case $choice in
  1)
    echo ""
    echo "=== 配置 Telegram Bot ==="
    echo ""
    echo "步骤 1: 创建 Telegram Bot"
    echo "  1. 在 Telegram 搜索 @BotFather"
    echo "  2. 发送 /newbot 创建新机器人"
    echo "  3. 按提示设置名称"
    echo "  4. 获得类似这样的 Token: 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
    echo ""
    read -p "请输入 Bot Token: " bot_token
    
    echo ""
    echo "步骤 2: 获取 Chat ID"
    echo "  1. 在 Telegram 搜索 @userinfobot"
    echo "  2. 发送任意消息"
    echo "  3. 获得你的 Chat ID（纯数字）"
    echo ""
    read -p "请输入 Chat ID: " chat_id
    
    # 更新 .env 文件
    sed -i "s/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$bot_token/" /root/my-github/.env 2>/dev/null || echo "TELEGRAM_BOT_TOKEN=$bot_token" >> /root/my-github/.env
    sed -i "s/TELEGRAM_CHAT_ID=.*/TELEGRAM_CHAT_ID=$chat_id/" /root/my-github/.env 2>/dev/null || echo "TELEGRAM_CHAT_ID=$chat_id" >> /root/my-github/.env
    
    echo ""
    echo "✓ Telegram 配置完成！"
    ;;
    
  2)
    echo ""
    echo "=== 配置钉钉机器人 ==="
    echo ""
    echo "步骤 1: 创建钉钉群机器人"
    echo "  1. 打开钉钉群 -> 群设置"
    echo "  2. 智能群助手 -> 添加机器人 -> 自定义"
    echo "  3. 设置机器人名称"
    echo "  4. 获得 webhook URL"
    echo ""
    read -p "请输入 Webhook URL: " webhook
    
    # 更新 .env 文件
    sed -i "s|DINGTALK_WEBHOOK=.*|DINGTALK_WEBHOOK=$webhook|" /root/my-github/.env 2>/dev/null || echo "DINGTALK_WEBHOOK=$webhook" >> /root/my-github/.env
    
    echo ""
    echo "✓ 钉钉配置完成！"
    ;;
    
  3)
    echo ""
    echo "=== 配置飞书机器人 ==="
    echo ""
    echo "步骤 1: 创建飞书群机器人"
    echo "  1. 打开飞书群 -> 群设置"
    echo "  2. 群机器人 -> 添加机器人 -> 自定义"
    echo "  3. 设置机器人名称"
    echo "  4. 获得 webhook URL"
    echo ""
    read -p "请输入 Webhook URL: " webhook
    
    # 更新 .env 文件
    sed -i "s|FEISHU_WEBHOOK=.*|FEISHU_WEBHOOK=$webhook|" /root/my-github/.env 2>/dev/null || echo "FEISHU_WEBHOOK=$webhook" >> /root/my-github/.env
    
    echo ""
    echo "✓ 飞书配置完成！"
    ;;
    
  *)
    echo "无效选择"
    exit 1
    ;;
esac

echo ""
echo "=== 测试通知 ==="
echo ""
echo "运行以下命令测试通知："
echo "  cd /root/my-github"
echo "  npm run dev"

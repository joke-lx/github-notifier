#!/bin/bash

# WeCom酱 微信通知配置脚本

echo "=== WeCom酱 微信通知配置 ==="
echo ""
echo "WeCom酱是完全开源免费的微信推送方案！"
echo "每天 1000 条免费消息"
echo "官网: https://www.wecom酱.com/"
echo ""

# 检查 .env 文件是否存在
if [ -f .env ]; then
  echo "✓ 检测到 .env 文件"
else
  echo "⚠️  .env 文件不存在，将创建新文件"
  touch .env
fi

echo ""
echo "步骤 1: 获取 WeCom酱 SendKey"
echo ""
echo "1. 访问 https://www.wecom酱.com/"
echo "2. 微信扫码登录"
echo "3. 进入「SendKey」页面"
echo "4. 复制你的 Key（通常以 SCT 开头）"
echo ""
echo "SendKey 格式: SCTxxxxx"
echo ""

read -p "请粘贴 SendKey: " sendkey

# 验证 SendKey 不为空
if [ -z "$sendkey" ]; then
  echo "❌ SendKey 不能为空"
  exit 1
fi

echo ""
echo "✓ 检测到 SendKey: ${sendkey:0:8}..."

# 检查是否已存在 WECOM_SEND_KEY 配置
if grep -q "^WECOM_SEND_KEY=" .env; then
  # 更新现有配置
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s|^WECOM_SEND_KEY=.*|WECOM_SEND_KEY=$sendkey|" .env
  else
    # Linux
    sed -i "s|^WECOM_SEND_KEY=.*|WECOM_SEND_KEY=$sendkey|" .env
  fi
  echo "✓ 已更新 .env 中的 WeCom酱配置"
else
  # 添加新配置
  echo "" >> .env
  echo "# WeCom酱微信推送配置（每天 1000 条免费消息，开源免费）" >> .env
  echo "WECOM_SEND_KEY=$sendkey" >> .env
  echo "✓ 已添加 WeCom酱配置到 .env"
fi

echo ""
read -p "是否要测试 WeCom酱 推送? (y/n): " test_notify

if [ "$test_notify" == "y" ]; then
  echo ""
  echo "正在发送测试消息..."

  # 使用 node 发送测试消息
  node test-wecom.js

  if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 配置成功！"
  else
    echo ""
    echo "⚠️  测试失败，请检查："
    echo "  1. SendKey 是否正确"
    echo "  2. 网络连接是否正常"
    echo "  3. 是否已完成微信扫码登录"
  fi
else
  echo ""
  echo "✓ WeCom酱配置完成！"
  echo "  运行 'npm run test-wecom' 测试推送"
fi

echo ""
echo "配置信息："
echo "  SendKey: ${sendkey:0:8}..."
echo "  每日限额: 1000 条消息"
echo "  配置文件: .env"
echo ""
echo "使用说明："
echo "  - 消息会直接发送到个人微信"
echo "  - 每天 1000 条免费消息"
echo "  - 完全开源，永久免费"
echo "  - 系统将自动推送每日技术日报"
echo ""

#!/bin/bash
# WxPusher 微信通知配置脚本

echo "=== WxPusher 微信通知配置 ==="
echo ""
echo "WxPusher 是完全免费的微信推送方案！"
echo "官网: https://wxpusher.zjiecode.com"
echo ""
echo "步骤 1: 创建 WxPusher 应用"
echo ""
echo "1. 微信搜索关注「WxPusher」公众号"
echo "2. 进入公众号，点击「你的应用」"
echo "3. 创建应用（随便填写）"
echo "4. 获得 AppToken"
echo "5. 记录你的 UID（在「扫码关注」里查看）"
echo ""
read -p "请输入 AppToken: " app_token
read -p "请输入你的 UID: " uid

# 更新 .env 文件
cd /root/my-github
sed -i '/^WXPUSHER_TOKEN=/d' .env
sed -i '/^WXPUSHER_UIDS=/d' .env

echo "" >> .env
echo "# WxPusher 微信通知配置" >> .env
echo "WXPUSHER_TOKEN=$app_token" >> .env
echo "WXPUSHER_UIDS=$uid" >> .env

echo ""
echo "✓ WxPusher 配置完成！"
echo ""
echo "配置信息："
echo "  AppToken: $app_token"
echo "  UID: $uid"
echo ""
echo "=== 测试微信推送 ==="
echo ""
echo "运行以下命令测试："
echo "  cd /root/my-github"
echo "  npm run dev"

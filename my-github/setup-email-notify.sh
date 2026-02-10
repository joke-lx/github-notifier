#!/bin/bash
# QQ 邮件通知配置脚本

echo "=== QQ 邮件通知配置向导 ==="
echo ""
echo "请先完成以下步骤："
echo ""
echo "1. 登录 https://mail.qq.com"
echo "2. 点击 设置 → 账户"
echo "3. 开启 IMAP/SMTP 服务"
echo "4. 发送短信获取授权码（16位，不是QQ密码）"
echo ""
echo "=================================="
echo ""
read -p "输入你的 QQ 邮箱: " EMAIL_USER
read -p "输入授权码 (16位): " EMAIL_PASS

echo ""
echo "正在配置..."

# 更新 .env 文件
sed -i "s/EMAIL_USER=.*/EMAIL_USER=$EMAIL_USER/" .env
sed -i "s/EMAIL_PASS=.*/EMAIL_PASS=$EMAIL_PASS/" .env

echo "✓ 配置已更新"
echo ""
echo "配置预览："
grep "EMAIL" .env | head -2
echo ""
echo "现在可以测试运行："
echo "  npm run dev"
echo ""
echo "测试成功后重启服务："
echo "  pm2 restart github-daily"

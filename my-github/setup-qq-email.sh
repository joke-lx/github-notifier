#!/bin/bash
# QQ 邮箱配置脚本

echo "=== QQ 邮箱通知配置 ==="
echo ""
echo "QQ 邮箱通过 SMTP 发送通知，完全免费！"
echo ""
echo "步骤 1: 获取 QQ 邮箱授权码"
echo ""
echo "1. 登录 QQ 邮箱网页版: https://mail.qq.com"
echo "2. 点击「设置」->「账户」"
echo "3. 找到「POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务」"
echo "4. 开启「IMAP/SMTP服务」"
echo "5. 生成授权码（不是 QQ 密码！）"
echo "6. 复制授权码"
echo ""
read -p "请输入你的 QQ 邮箱: " email
read -p "请输入授权码（不是QQ密码）: " password

# 验证邮箱格式
if [[ ! $email =~ ^[0-9]+@qq\.com$ ]]; then
    echo "错误：QQ邮箱格式应为 数字@qq.com"
    exit 1
fi

# 更新 .env 文件
cd /root/my-github

# 删除旧的配置
sed -i '/^EMAIL_USER=/d' .env
sed -i '/^EMAIL_PASS=/d' .env

# 添加新配置
echo "" >> .env
echo "# QQ 邮箱配置" >> .env
echo "EMAIL_USER=$email" >> .env
echo "EMAIL_PASS=$password" >> .env

echo ""
echo "✓ QQ 邮箱配置完成！"
echo ""
echo "配置信息："
echo "  邮箱: $email"
echo "  SMTP: smtp.qq.com:465"
echo ""
echo "=== 测试邮件通知 ==="
echo ""
echo "运行以下命令测试："
echo "  cd /root/my-github"
echo "  npm run dev"
echo ""
echo "完成后每天早上 8 点会自动发送技术日报到你的 QQ 邮箱！"

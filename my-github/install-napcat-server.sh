#!/bin/bash
# 在云服务器上部署 NapCat QQ Bot

set -e

echo "=== 在云服务器上部署 NapCat QQ Bot ==="
echo ""

# 检查是否安装了 Docker
if ! command -v docker &> /dev/null; then
    echo "正在安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo "✓ Docker 安装完成"
else
    echo "✓ Docker 已安装"
fi

echo ""
echo "=================================="
echo ""

# 创建 NapCat 目录
mkdir -p ~/napcat/data
cd ~/napcat

# 生成配置文件
cat > config.json << 'EOF'
{
  "qq": "你的QQ号",
  "http": {
    "enable": true,
    "host": "0.0.0.0",
    "port": 3000,
    "secret": "github_daily_secret",
    "enableHeart": true,
    "enablePost": true
  }
}
EOF

echo "NapCat 配置文件已创建: ~/napcat/config.json"
echo ""
echo "请手动编辑配置文件，修改以下内容："
echo "  1. \"qq\": 改成你的 QQ 号"
echo "  2. \"secret\": 可以改成你自己的密钥（或者保持默认）"
echo ""
read -p "按回车继续..."

# 拉取 NapCat Docker 镜像
echo ""
echo "正在拉取 NapCat Docker 镜像..."
docker pull mlikiowa/napcat-docker:latest

# 创建启动脚本
cat > start.sh << 'EOF'
#!/bin/bash
cd ~/napcat
docker run -d \
  --name napcat \
  --restart=unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config.json:/app/config.json \
  mlikiowa/napcat-docker:latest

echo "NapCat 已启动"
echo ""
echo "查看日志以获取二维码："
echo "  docker logs -f napcat"
echo ""
echo "或者运行："
echo "  ./show-qrcode.sh"
EOF

chmod +x start.sh

# 创建查看二维码的脚本
cat > show-qrcode.sh << 'EOF'
#!/bin/bash
echo "正在获取二维码..."
echo ""
docker logs napcat 2>&1 | grep -A 20 "二维码" || docker logs -f napcat
EOF

chmod +x show-qrcode.sh

echo ""
echo "=== 安装完成 ==="
echo ""
echo "下一步操作："
echo ""
echo "1. 编辑配置文件："
echo "   vim ~/napcat/config.json"
echo "   修改 QQ 号"
echo ""
echo "2. 启动 NapCat："
echo "   cd ~/napcat"
echo "   ./start.sh"
echo ""
echo "3. 查看日志获取二维码："
echo "   ./show-qrcode.sh"
echo ""
echo "4. 使用手机 QQ 扫码登录"
echo ""
echo "5. 配置技术日报系统："
echo "   cd /root/my-github"
echo "   ./quick-setup.sh"

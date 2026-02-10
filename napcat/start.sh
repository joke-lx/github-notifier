#!/bin/bash
cd ~/napcat
docker run -d \
  --name napcat \
  --restart=unless-stopped \
  -p 3000:3000 \
  -p 3001:3001 \
  -p 6099:6099 \
  --add-host=host.docker.internal:host-gateway \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/config.json:/app/config.json \
  docker.1ms.run/mlikiowa/napcat-docker:latest

echo "✓ NapCat 容器已启动"
echo ""
echo "查看日志以获取二维码："
echo "  docker logs -f napcat"
echo ""
echo "访问 WebUI 配置："
echo "  http://$(hostname -I | awk '{print $1}'):6099/webui/"

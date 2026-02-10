#!/bin/bash
# NapCat QQ Bot 管理脚本

case "$1" in
  start)
    echo "启动 NapCat..."
    cd ~/napcat && ./start.sh
    ;;
  stop)
    echo "停止 NapCat..."
    docker stop napcat 2>/dev/null && echo "  ✓ 已停止" || echo "  ⚠️  容器未运行"
    ;;
  restart)
    echo "重启 NapCat..."
    docker restart napcat && echo "  ✓ 已重启" || echo "  ❌ 重启失败"
    ;;
  status)
    echo "=== NapCat 状态 ==="
    if docker ps | grep -q napcat; then
      echo "  ✓ 容器运行中"
      echo ""
      echo "=== API 状态 ==="
      curl -s http://127.0.0.1:3000/get_status 2>&1 | head -5
    else
      echo "  ❌ 容器未运行"
    fi
    ;;
  logs)
    echo "=== NapCat 日志 (最近 50 行) ==="
    docker logs --tail 50 napcat 2>&1
    echo ""
    echo "查看实时日志: docker logs -f napcat"
    ;;
  qrcode)
    echo "=== 获取登录二维码 ==="
    docker logs napcat 2>&1 | grep -A 30 "二维码"
    echo ""
    echo "WebUI 登录: http://127.0.0.1:6099/webui/"
    ;;
  update)
    echo "更新 NapCat..."
    docker pull docker.1ms.run/mlikiowa/napcat-docker:latest
    docker stop napcat
    docker rm napcat
    cd ~/napcat && ./start.sh
    echo "  ✓ 更新完成"
    ;;
  test)
    /root/my-github/test-qq-bot.sh
    ;;
  *)
    echo "NapCat QQ Bot 管理脚本"
    echo ""
    echo "用法: $0 {start|stop|restart|status|logs|qrcode|update|test}"
    echo ""
    echo "命令说明："
    echo "  start    - 启动 NapCat"
    echo "  stop     - 停止 NapCat"
    echo "  restart  - 重启 NapCat"
    echo "  status   - 查看运行状态"
    echo "  logs     - 查看日志"
    echo "  qrcode   - 获取登录二维码"
    echo "  update   - 更新到最新版本"
    echo "  test     - 测试 QQ 推送功能"
    echo ""
    echo "配置文件: ~/napcat/config.json"
    echo "环境配置: /root/my-github/.env"
    ;;
esac

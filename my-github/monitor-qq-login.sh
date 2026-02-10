#!/bin/bash
# 监控 QQ Bot 登录状态

echo "=== QQ Bot 登录监控 ==="
echo ""
echo "按 Ctrl+C 停止监控"
echo ""

while true; do
    clear
    echo "=== QQ Bot 登录状态 ==="
    echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # 检查是否已登录
    if docker logs napcat 2>&1 | grep -q "登录成功\|Login success\|已登录"; then
        echo "✅ 登录成功！"
        echo ""
        echo "测试 QQ Bot 推送..."
        cd /root/my-github
        ./test-qq-bot.sh
        break
    fi
    
    # 获取最新二维码
    QR_URL=$(docker logs napcat 2>&1 | grep "二维码解码URL" | tail -1 | sed 's/.*二维码解码URL: //')
    
    echo "⏳ 等待扫码登录..."
    echo ""
    echo "=== 二维码信息 ==="
    echo "$QR_URL"
    echo ""
    echo "=== 扫码方式 ==="
    echo "1. 浏览器访问: http://172.31.0.145:8080/napcat-qrcode.png"
    echo "2. 复制链接到: https://cli.im 生成二维码"
    echo "3. 用手机 QQ 扫一扫"
    echo ""
    echo "⚠️  二维码每 2 分钟刷新"
    echo ""
    echo "最新日志:"
    docker logs napcat 2>&1 | grep -E "二维码|登录|Login" | tail -3
    
    sleep 10
done

echo ""
echo "=== 登录完成 ==="
echo "QQ Bot 已准备就绪！"

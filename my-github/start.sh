#!/bin/bash
# GitHub 技术日报启动脚本

cd /root/my-github

# 使用 --expose-gc 启用以支持手动垃圾回收
export NODE_OPTIONS="--expose-gc"

# 启动服务
pm2 start src/index.js --name github-daily --time

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup systemd -u root --hp /root

echo "✓ 系统已启动"
echo "✓ 定时任务: 每天 08:00 执行"
echo ""
echo "常用命令:"
echo "  pm2 logs github-daily    # 查看日志"
echo "  pm2 monit                # 实时监控"
echo "  pm2 restart github-daily # 重启服务"
echo "  npm run dev              # 手动执行测试"
echo "  npm run clean            # 手动清理内存"

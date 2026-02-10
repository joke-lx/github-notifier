# NapCat 安装配置指南

## 问题说明
QQ官方机器人已弃用WebSocket模式，个人开发者无法使用（需要ICP备案）。
解决方案：使用 NapCat（第三方协议，使用个人QQ号）。

## 安装步骤

### 1. 安装 NapCat

```bash
cd /root/my-github
git clone https://github.com/Mlikiowa/NapCatQQ.git
cd NapCatQQ

# 或使用下载预编译版本
# 访问 https://github.com/Mlikiowa/NapCatQQ/releases
```

### 2. 配置 NapCat

编辑 `NapCatQQ/config/websocket.json`:
```json
{
  "address": "0.0.0.0",
  "port": 3001,
  "accessToken": "",
  "enableHeart": true,
  "enablePost": false
}
```

### 3. 启动 NapCat 并登录

```bash
cd NapCatQQ
./NapCat  # 或使用适合您系统的启动脚本
```

首次启动会要求扫码登录QQ（使用您的QQ号 3889877189）

### 4. Koishi 已配置完成

koishi.yml 已配置为连接 NapCat:
```yaml
adapter-onebot:qq:
  protocol: ws
  selfId: '3889877189'
  endpoint: ws://127.0.0.1:3001
```

### 5. 启动顺序

1. 先启动 NapCat（确保QQ在线）
2. 再启动 Koishi
```bash
# 终端1
cd /root/my-github/NapCatQQ
./NapCat

# 终端2
cd /root/my-github/koishi-bot
npm start
```

## 验证方法

1. NapCat 应显示QQ已登录
2. Koishi 日志应显示 "adapter connected"
3. 在群 922402862 中 @机器人 发送消息测试

## 优势

- ✅ 使用个人QQ号，无需申请
- ✅ 支持WebSocket消息推送
- ✅ 无需ICP备案
- ✅ 完全兼容Koishi

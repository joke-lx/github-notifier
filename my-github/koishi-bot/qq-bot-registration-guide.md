# QQ 官方机器人注册指南

## 概述

本文档指导您如何在 QQ 开放平台注册并配置官方机器人，以便与 Koishi 框架集成。

---

## 第一步：注册 QQ 开放平台账号

1. 访问 **QQ 开放平台**: https://bot.q.qq.com/

2. 点击右上角「登录」，使用 QQ 账号登录

3. 首次登录需要完善开发者信息：
   - 手机号验证
   - 实名认证（个人或企业）

---

## 第二步：创建机器人

1. 登录后进入「管理后台」

2. 点击左侧菜单「创建机器人」

3. 填写机器人基本信息：
   ```
   机器人名称: GitHub技术日报助手
   机器人简介: 提供GitHub前端技术资讯和项目问答服务
   机器人类型: 选择「社群机器人」或「资讯机器人」
   ```

4. 提交后等待审核（通常 1-3 个工作日）

---

## 第三步：获取机器人凭证

审核通过后，在「开发设置」页面获取三项关键信息：

| 参数 | 说明 | 示例 |
|------|------|------|
| **AppID** | 机器人唯一标识 | `1234567890` |
| **Secret** | 机器人密钥 | `abc123def456` |
| **Token** | 机器人令牌 | `xyz789ghi012` |

**⚠️ 重要提示**: 这些凭证需要保密，不要泄露！

---

## 第四步：配置 Koishi

将获取的凭证填入 `koishi.yml` 配置文件：

```yaml
adapter-qq:
  id: "1234567890"           # 替换为您的 AppID
  key: "abc123def456"        # 替换为您的 Secret
  token: "xyz789ghi012"      # 替换为您的 Token
  type: private              # 私域机器人
  sandbox: true              # 沙盒环境（测试时使用）
```

---

## 第五步：将机器人添加到 QQ 群

1. 在 QQ 群设置中，点击「群机器人」

2. 点击「添加机器人」

3. 搜索您的机器人名称或输入 AppID

4. 添加成功后，机器人即可在群中使用

---

## 第六步：测试机器人

1. 启动 Koishi:
   ```bash
   cd /root/my-github/koishi-bot
   npm run dev
   ```

2. 在 QQ 群中测试：
   ```
   @GitHub技术日报助手 你好
   ```

3. 机器人应该会回复欢迎消息

---

## 常见问题

### Q: 审核需要多久？
A: 通常 1-3 个工作日，节假日可能延长。

### Q: 机器人可以在哪些群使用？
A: 目前私域机器人只能在开发者自己的 QQ 群中使用（最多 10 个群）。

### Q: 如何切换到生产环境？
A: 将 `sandbox: true` 改为 `sandbox: false`

### Q: 机器人没有反应怎么办？
A: 检查以下几点：
   1. 凭证是否正确填写
   2. 机器人是否已添加到群
   3. Koishi 服务是否正常运行
   4. 日志中是否有错误信息

---

## 相关链接

- [QQ 开放平台](https://bot.q.qq.com/)
- [Koishi QQ 适配器文档](https://koishi.chat/zh-CN/plugins/adapter/qq.html)
- [QQ 机器人 API 文档](https://bot.q.qq.com/wiki/)

---

## 配置检查清单

- [ ] 已注册 QQ 开放平台账号
- [ ] 已创建机器人并通过审核
- [ ] 已获取 AppID、Secret、Token
- [ ] 已更新 koishi.yml 配置文件
- [ ] 已安装 Koishi 依赖 (`npm install`)
- [ ] 已将机器人添加到 QQ 群
- [ ] 已测试 @机器人 功能

---

## 下一步

完成上述配置后，运行以下命令启动机器人：

```bash
cd /root/my-github/koishi-bot
npm install
npm run dev
```

如需后台运行，可以使用 PM2：

```bash
npm install -g pm2
pm2 start koishi-bot/package.json --name koishi-qa-bot -- start
```

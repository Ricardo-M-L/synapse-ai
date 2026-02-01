# 微信机器人接入指南

Synapse AI 支持接入微信个人号，让你的 AI 助手成为微信好友！

## 功能特性

- ✅ 个人聊天：私聊消息自动回复
- ✅ 群聊响应：支持 @提及 触发
- ✅ 白名单：可配置允许的用户/群组
- ✅ 多消息类型：文字、图片、文件
- ✅ 持久化记忆：跨对话保持上下文

## 快速开始

### 1. 安装依赖

```bash
# 安装 wechaty 微信协议库
npm install wechaty@latest
npm install wechaty-puppet-wechat@latest

# 或使用 padlocal 协议（更稳定，需申请 Token）
npm install wechaty-puppet-padlocal@latest
```

### 2. 配置微信

编辑 `config.json`：

```json
{
  "channels": {
    "wechat": {
      "enabled": true,
      "requireMentionInGroup": true,
      "autoAcceptFriend": false,
      "allowedUsers": [],
      "allowedGroups": []
    }
  }
}
```

### 3. 启动服务

```bash
npm run dev
```

首次启动会显示二维码，用微信扫码登录。

## 配置说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `enabled` | boolean | 是否启用微信通道 |
| `requireMentionInGroup` | boolean | 群聊中是否需要 @AI 才响应 |
| `autoAcceptFriend` | boolean | 是否自动通过好友申请 |
| `allowedUsers` | string[] | 白名单用户，为空则允许所有人 |
| `allowedGroups` | string[] | 允许的群聊列表 |

## 使用场景

### 场景 1：个人助理

在微信里直接问 AI：

```
你：帮我写个 Python 脚本，批量重命名文件
AI：好的，这是一个使用 os 模块的脚本...

你：昨天说的那个方案还有吗
AI：记得，关于用户系统的架构方案...
```

### 场景 2：群聊助手

在群里 @AI 提问：

```
小明：@SynapseAI 这个报错怎么解决？
[截图]
AI：这个错误是因为...

小红：@SynapseAI 帮我查一下今天天气
AI：北京今天晴，15-25°C...
```

### 场景 3：文件处理

直接发送文件给 AI 处理：

```
你：[发送 report.pdf]
AI：已收到文件，正在分析...

AI：这是报告摘要：
1. 第三季度收入增长 25%
2. 用户活跃度提升...
```

## 协议选择

| 协议 | 稳定性 | 成本 | 适用场景 |
|------|--------|------|----------|
| Web 协议 | 中 | 免费 | 个人使用 |
| PadLocal | 高 | 付费 | 企业/长期运行 |
| Windows Hook | 高 | 免费 | 本地部署 |

## 注意事项

⚠️ **风险提示**：
1. 微信官方不鼓励第三方机器人，存在封号风险
2. 建议使用小号测试，不要登录主号
3. 控制消息频率，避免被判定为 spam
4. 遵守微信使用规范，不发送违规内容

## 故障排查

### 无法扫码登录
- 检查网络连接
- 确认微信版本兼容
- 尝试重启服务

### 消息不响应
- 检查 `enabled` 配置
- 确认白名单设置
- 查看日志输出

### 群聊无响应
- 检查是否被 @提及
- 确认群聊在白名单中
- 检查 `requireMentionInGroup` 设置

## 示例代码

```typescript
import { WeChatChannel } from './src/channels/wechat';

const wechat = new WeChatChannel({
  enabled: true,
  requireMentionInGroup: true,
  allowedUsers: ['wxid_abc123'], // 只响应特定用户
});

wechat.on('message', async (msg) => {
  console.log(`收到消息: ${msg.content}`);
  
  // 调用 AI 处理
  const response = await aiAgent.chat(msg.content);
  
  // 回复消息
  await wechat.sendMessage(msg.from.id, response);
});

await wechat.start();
```

## 下一步

- [ ] 添加企业微信支持
- [ ] 添加钉钉机器人
- [ ] 添加飞书机器人

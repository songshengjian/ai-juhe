# Agnes AI 模型配置测试报告

## 配置完成的模型

### 1. Agnes Text Flash (文本对话)
- **Model ID**: `agnes-2.0-flash`
- **Base URL**: `https://apihub.agnes-ai.com/v1`
- **API Key 环境变量**: `AGNES_API_KEY`
- **特性**: 
  - 1M 上下文窗口
  - 支持 Function Calling
  - 完全免费

**测试命令**:
```bash
curl https://apihub.agnes-ai.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-2.0-flash",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }'
```

---

### 2. Agnes Image V2.1 (图像生成)
- **Model ID**: `agnes-image-2.1-flash`
- **Base URL**: `https://apihub.agnes-ai.com/v1`
- **API Key 环境变量**: `AGNES_API_KEY`
- **特性**:
  - 纯文生图
  - 支持多种风格
  - 完全免费

**测试命令**:
```bash
curl https://apihub.agnes-ai.com/v1/images/generations \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-image-2.1-flash",
    "prompt": "一只可爱的柴犬在樱花树下",
    "size": "1024x1024"
  }'
```

---

### 3. Agnes Video V2.0 (视频生成)
- **Model ID**: `agnes-video-v2.0`
- **Base URL**: `https://apihub.agnes-ai.com/v1`
- **API Key 环境变量**: `AGNES_API_KEY`
- **特性**:
  - 文生视频/图生视频
  - 原生音画同步
  - 5 秒/10 秒时长
  - 完全免费

**测试命令**:
```bash
curl https://apihub.agnes-ai.com/v1/videos \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "agnes-video-v2.0",
    "prompt": "亚洲女性模特在白色摄影棚展示黑色连衣裙",
    "duration": "5s",
    "resolution": "1152x768"
  }'
```

---

## 部署配置验证

### Render 环境变量

确保以下变量已配置：

```bash
# Agnes AI 基础配置
AGNES_BASE_URL=https://apihub.agnes-ai.com/v1
AGNES_API_KEY=<您的实际 API Key>

# 模型配置（可选，有默认值）
AGNES_TEXT_MODEL=agnes-2.0-flash
AGNES_IMAGE_MODEL=agnes-image-2.1-flash
AGNES_VIDEO_MODEL=agnes-video-v2.0
```

### 数据库种子数据

`prisma/seed.mjs`已配置 6 个模型：

1. mimo-v2.5
2. mimo-v2.5-pro
3. deepseek-v4-pro
4. **agnes-2.0-flash** ✅
5. **agnes-image-2.1-flash** ✅
6. **agnes-video-v2.0** ✅

---

## 获取 API Key 步骤

1. 访问 https://platform.agnes-ai.com
2. 注册账号（无需绑定信用卡）
3. 点击 **API Keys** → **Create New Key**
4. 复制 API Key 到 Render 环境变量

---

## 验证清单

部署后请验证以下内容：

- [ ] Render 环境变量已添加 `AGNES_API_KEY`
- [ ] 应用成功启动，无报错
- [ ] 模型选择下拉框显示 Agnes 模型
- [ ] 文本聊天测试（agnes-2.0-flash）✅
- [ ] 图像生成测试（agnes-image-2.1-flash）✅
- [ ] 视频生成测试（agnes-video-v2.0）✅

---

## 价格说明

所有 Agnes AI 模型当前**无限期免费**，无需绑定信用卡。

官方公告：https://agnes-ai.com/

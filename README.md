# AI Juhe Chat

基于 Next.js 15、Prisma、MySQL 与 Redis 的多模型聊天应用，提供项目管理、文件上下文解析和 SSE 流式回复。

## 功能

- ChatGPT 风格界面、模型切换、深浅主题和移动端侧栏。
- 邮箱密码注册登录，用户项目、对话和文件相互隔离。
- 项目支持新建、分享链接、重命名和删除。
- 上传文件后提取文本并作为模型上下文：支持文本、Markdown、CSV、JSON、DOCX、XLSX 和基础 PDF 文字提取。
- 回复开始时显示“思考中”，模型数据到达后流式输出。
- MySQL 持久化数据；Redis 用于会话标记、上下文缓存和限流。

## Docker 部署

真实密钥请只保存在本机 `.env` 中，该文件已被 `.gitignore` 与 `.dockerignore` 排除。

1. 基于 `.env.example` 创建 `.env`，填入数据库密码、`NEXTAUTH_SECRET` 与模型 API 配置。

2. 启动应用、MySQL 与 Redis：

```bash
docker compose up --build -d
```

3. 查看服务状态：

```bash
docker compose ps
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。容器启动时会自动执行 Prisma 建表和模型种子初始化。

容器映射端口：

- 应用：`3000`
- MySQL：宿主机 `3307` 映射到容器 `3306`，避免与本机 MySQL 冲突。
- Redis：宿主机 `6380` 映射到容器 `6379`

停止服务：

```bash
docker compose down
```

清除容器数据库与已上传文件：

```bash
docker compose down -v
```

## 本机开发

本机已有 MySQL 时，可直接使用开发服务：

```bash
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

开发模式使用 Turbopack，以避免 Windows 下 Webpack 文件监听扫描系统路径的问题。

## 配置说明

- `DATABASE_URL`：本机运行时使用的 MySQL 连接串。
- `MYSQL_PASSWORD`：Docker 内 MySQL root 密码；应与容器内应用连接使用的值一致。
- `REDIS_URL`：Redis 连接串。Redis 不可用时，登录仍可使用，缓存能力会降级。
- `UPLOAD_DIR`：上传文件保存目录；Docker 中已挂载持久卷。
- `MIMO_*`、`CLAUDEMAX_*`、`GPT_PRO_55_*`：模型服务配置。
- `NVIDIA_*`：NVIDIA NIM OpenAI 兼容网关配置，默认端点为 `https://integrate.api.nvidia.com/v1`。

`ClaudeMax` 与 `GPT-Pro-5.5` 需要实际可访问且兼容 OpenAI `/chat/completions` 流式协议的端点地址，仅有密钥不足以调用。

## 校验

```bash
npx tsc --noEmit
npm run lint
npm run build
```

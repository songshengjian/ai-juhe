# Render 部署完整指南（完全免费方案）

本项目已配置为使用 **PostgreSQL**，可以直接部署到 Render。

## 💰 完全免费方案（$0/月）

### 免费配额

| 服务 | 免费额度 | 说明 |
|------|---------|------|
| **Web Service** | 750 小时/月 | 会休眠，首次访问需等待 30-60 秒 |
| **PostgreSQL** | 1GB 存储 | Render 原生支持 |
| **Redis** | 10,000 命令/天 | 使用 Upstash（需手动配置） |

**总计：$0/月**，不需要信用卡！

## 一键部署

### 方式一：使用 render.yaml 文件

1. 将代码推送到 GitHub
2. 访问 [Render Dashboard](https://dashboard.render.com/)
3. 点击 **New +** → **Blueprint**
4. 选择您的 GitHub 仓库
5. 点击 **Apply**

Render 会自动创建：
- Web Service（应用）
- PostgreSQL 数据库
- Redis 实例

### 方式二：手动创建

#### 1. 创建 PostgreSQL 数据库

1. Dashboard → New + → Database
2. 配置：
   - **Name**: `ai-juhe-db`
   - **Region**: Singapore（或最近区域）
   - **Plan**: Starter（免费）
   - **Database Name**: `ai_chat`
3. 创建后保存连接字符串

#### 2. 创建 Redis

1. Dashboard → New + → Redis
2. 配置：
   - **Name**: `ai-juhe-redis`
   - **Region**: Singapore
   - **Plan**: Starter（付费，$10/月）
   
**或使用 Upstash Redis（免费）**：
- 访问 [Upstash](https://upstash.com/)
- 创建免费 Redis
- 保存 REST URL

#### 3. 创建 Web Service

1. Dashboard → New + → Web Service
2. 配置：

```
Name: ai-juhe-chat
Region: Singapore
Branch: main
Root Directory: (留空)
Runtime: Docker
Build Command: (留空)
Start Command: (留空)
```

3. **实例类型**：
   - **Starter**: $0/月（会休眠）
   - **Individual**: $7/月（不休眠）

4. **添加环境变量**：

```bash
# 数据库（从 Render Database 复制）
DATABASE_URL=postgresql://user:password@host:5432/ai_chat

# Redis（从 Render Redis 或 Upstash 复制）
REDIS_URL=redis://user:password@host:port

# NextAuth
NEXTAUTH_URL=https://ai-juhe-chat.onrender.com
NEXTAUTH_SECRET=<生成随机密钥>

# 上传目录
UPLOAD_DIR=/app/.data/uploads

# 模型 API（替换为真实密钥）
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
MIMO_API_KEY=<您的 Mimo API Key>
MIMO_MODEL=mimo-v2.5
VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VOLCENGINE_API_KEY=<您的火山引擎 API Key>
```

5. **添加磁盘**：
   - Click **Add Disk**
   - **Name**: `uploads`
   - **Mount Path**: `/app/.data/uploads`
   - **Size**: `5 GB`

6. 点击 **Create Web Service**

---

## 数据库初始化

部署成功后需要初始化数据库：

### 方法一：通过 Render Shell

1. Dashboard → 您的服务 → **Shell**
2. 执行：

```bash
npx prisma db push
npm run db:seed
```

### 方法二：添加自动初始化

Dockerfile 已经配置了自动初始化（最后一行 CMD）：

```dockerfile
CMD ["sh", "-c", "npx prisma db push && npm run db:seed && npm run start -- --hostname 0.0.0.0 --port 3000"]
```

首次部署时会自动执行。

---

## 环境变量说明

### 必须配置

| 变量名 | 来源 | 说明 |
|--------|------|------|
| `DATABASE_URL` | Render PostgreSQL | 数据库连接串 |
| `REDIS_URL` | Render Redis / Upstash | Redis 连接串 |
| `NEXTAUTH_SECRET` | 生成随机值 | 用于 NextAuth 加密 |
| `NEXTAUTH_URL` | Render 域名 | 如 `https://xxx.onrender.com` |

### 可选配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MIMO_API_KEY` | - | 小米 Mimo API |
| `VOLCENGINE_API_KEY` | - | 火山引擎 API |
| `MIMO_MODEL` | `mimo-v2.5` | 模型名称 |

---

## 成本估算

### 最低成本方案（$0/月）

- **Web Service**: Starter 免费套餐
- **PostgreSQL**: Starter 免费套餐
- **Redis**: Upstash 免费套餐（$0）
- **总计**: $0/月

**限制**：
- Web Service 每月 750 小时，会休眠
- 首次访问启动需要 30-60 秒
- PostgreSQL 1GB 存储

### 推荐生产方案（$17/月）

- **Web Service**: Individual ($7/月)
- **PostgreSQL**: Basic ($15/月) 或 Starter 免费
- **Redis**: Upstash 付费或 Render ($10/月)
- **总计**: $17-32/月

**优势**：
- 不休眠，响应快
- 更多存储空间
- 更好的性能

---

## 健康检查

部署后访问以下端点验证：

```bash
# 检查应用是否运行
curl https://ai-juhe-chat.onrender.com/api/auth/session

# 检查数据库连接
curl https://ai-juhe-chat.onrender.com/api/health

# 查看日志
Dashboard → 您的服务 → Logs
```

---

## 常见问题

### 1. 数据库迁移失败

```bash
# 通过 Shell 手动执行
npx prisma db push
```

### 2. Redis 连接失败

检查 REDIS_URL 格式：
- Render Redis: `redis://default:password@host:port`
- Upstash: `redis://default:password@host:port?ssl=true`

### 3. 上传文件失败

确认已添加持久化磁盘：
- Mount Path: `/app/.data/uploads`

### 4. 服务访问超时

- Starter 实例会休眠，首次访问需等待
- 检查日志是否有错误
- 确认环境变量配置正确

---

## 持续部署

代码推送到 GitHub 后，Render 会自动：
1. 检测新提交
2. 重新构建 Docker 镜像
3. 滚动更新服务
4. 执行数据库迁移（如有）

可在 Dashboard → Settings → Auto Deploy 中配置。

---

## 本地测试 PostgreSQL

```bash
# 1. 复制环境变量
cp .env.example .env
# 修改 DATABASE_URL 为本地 PostgreSQL

# 2. 启动本地 PostgreSQL
docker run -d --name postgres \
  -e POSTGRES_DB=ai_chat \
  -e POSTGRES_PASSWORD=12345678 \
  -p 5432:5432 \
  postgres:15-alpine

# 3. 初始化数据库
npm run db:generate
npm run db:push
npm run db:seed

# 4. 运行应用
npm run dev
```

---

## 相关文件

- `prisma/schema.prisma` - 数据库 Schema（PostgreSQL）
- `docker-compose.yml` - Docker Compose 配置（PostgreSQL）
- `Dockerfile` - Docker 构建配置
- `render.yaml` - Render Blueprint 配置
- `.env.example` - 环境变量模板

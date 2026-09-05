# 海洋院团总支数字工作台

> Ocean Youth League Digital Workspace

面向高校团总支内部使用的「任务协作 + 文件资料管理 + 审核归档 + 部门协同」数字化工作平台。

设计理念：**资料跟着任务走，而不是只存在文件夹里。**

## 技术栈

| 技术 | 说明 |
|---|---|
| **Next.js 16** | App Router, Route Handlers, React Server Components |
| **TypeScript** | 严格模式 |
| **PostgreSQL + Prisma ORM** | 服务端数据持久化 |
| **Tailwind CSS v4** | 原子化 CSS |
| **shadcn/ui** | 基础组件，二次设计 |
| **Framer Motion** | 克制微动效 |
| **Lucide Icons** | 图标库 |
| **React Hook Form + Zod** | 表单与校验 |
| **date-fns** | 日期处理 |

## 目录结构

```
app/
  login/              # 登录页
  (workspace)/        # 工作空间（含 Sidebar & Header）
    dashboard/        # 工作台首页
    tasks/            # 任务管理
      my/             # 我的任务
      new/            # 创建任务
      [id]/           # 任务详情
    files/            # 材料中心
    reviews/          # 审核中心
    calendar/         # 工作日历
    templates/        # 模板中心
    departments/      # 部门
      [id]/           # 部门详情
    members/          # 成员
    notifications/    # 通知中心
    settings/         # 系统设置
components/
  ui/                 # shadcn/ui 组件
  layout/             # Sidebar, Header, CommandPalette
data/
  mock.ts             # 尚未接入模块使用的展示 Mock 数据
hooks/
  use-auth.tsx        # 认证 Context
lib/
  db.ts               # Prisma Client 服务端单例
  api/                 # API DTO、客户端与通用响应工具
  utils.ts            # 工具函数
  permissions.ts      # RBAC 权限层
  storage.ts          # Storage Adapter 抽象
types/
  index.ts            # TypeScript 类型定义
prisma/
  schema.prisma       # PostgreSQL 数据模型
docs/
  server-infrastructure-2026-09-05.md  # Rocky 服务器实测状态
ops/
  systemd/user/       # 用户级 service/timer 模板
  scripts/            # 无密码 PostgreSQL 本地备份脚本
  ADMIN_TODO.md       # root 管理员最小操作清单
```

## 当前接入状态

已完成 PostgreSQL / Prisma 基础、正式 migration、开发 seed、数据库 Session、HttpOnly Cookie 登录、RBAC，以及 Departments、Members、Tasks API。`/tasks`、`/tasks/new`、`/tasks/[id]` 已连接真实 API。

仍使用 Mock 或尚未接入真实后端的模块包括：Dashboard 部分统计、Files、Reviews、Calendar、Notifications、Templates 和 Settings 部分功能。

不使用 Supabase 或阿里云 OSS。文件模块将使用 Rocky Linux 本地文件系统；服务器存储只能位于 `/home/wyz`，当前用户级生产根目录为 `FILE_STORAGE_ROOT=/home/wyz/tzz-data/blobs`。未来管理员如建立安全 bind mount，可将应用路径切换为 `/srv/tzz-data/blobs`，但物理数据仍保留在 `/home/wyz/tzz-data`。

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置数据库环境变量后启动开发服务器
npm run dev

# 3. 打开浏览器
open http://localhost:3000
```

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

将 `.env.example` 复制为 `.env.local`，并只在服务端配置。真实 `.env.local` 不允许提交到 Git：

```env
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE"
SEED_DEFAULT_PASSWORD="仅用于首次 seed 的强密码"
NODE_ENV=development
HOSTNAME=127.0.0.1
PORT=3000
FILE_STORAGE_ROOT=/home/wyz/tzz-data/blobs
UPLOAD_TMP_ROOT=/home/wyz/tzz-data/tmp
QUARANTINE_ROOT=/home/wyz/tzz-data/quarantine
EXPORT_ROOT=/home/wyz/tzz-data/exports
THUMBNAIL_ROOT=/home/wyz/tzz-data/thumbnails
```

Seed 中的邮箱仅用于开发和首次服务器测试，正式上线前必须替换为真实确认过的账号。`SEED_DEFAULT_PASSWORD` 不会写入 Git，且测试密码必须在上线前修改。重复执行 seed 会更新组织结构，但不会重置既有用户密码。

## Rocky Linux 首次数据库初始化

应用代码准备好且 `.env.local` 已配置后，运行：

```bash
npm install
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run build
npm run start
```

开发测试使用 `npm run dev`。在没有真实 PostgreSQL 的本地环境中，不要把 migration 或 seed 当作已验证成功。

## 文件存储规划

文件本体不会写入 PostgreSQL。生产环境使用五个独立根目录分别承载正式 blob、上传临时文件、隔离区、导出文件和缩略图。数据库只保存文件元数据和相对 `storageKey`，例如 `ab/cd/UUID.ext`；绝对路径、空路径段、`.` 和 `..` 均非法。应用先验证 `storageKey`，再与 `FILE_STORAGE_ROOT` 组合实际路径。

现有 `lib/storage.ts` 仍是前端演示适配器，将在文件模块接入时替换为仅服务端可用的本地文件存储实现。开发阶段可以使用 Node 流式响应；生产下载必须经过 API 鉴权和 Nginx `X-Accel-Redirect`，blob 目录不得作为公开静态目录。

已有的存储抽象接口为：

```typescript
interface StorageAdapter {
  uploadFile(key, file, options)
  deleteFile(key)
  getSignedUrl(key, expiresIn)
  createMultipartUpload(key, file, options)
}
```

## 服务器基础设施记录

- [Rocky Linux 实测状态](docs/server-infrastructure-2026-09-05.md)
- [用户级运维模板](ops/README.md)
- [管理员最小操作清单](ops/ADMIN_TODO.md)

仓库只记录模板和验证结果。真实 `.env.local`、生产环境文件、PostgreSQL data、dump、日志和上传文件均不得提交。

## 权限模型

| 角色 | 说明 |
|---|---|
| SECRETARY | 总书记 — 全部权限 |
| DEPUTY_SECRETARY | 副书记 — 创建/审核/管理 |
| MINISTER | 部长 — 管理本部门 |
| VICE_MINISTER | 副部长 — 查看/上传 |
| MEMBER | 成员 — 查看/上传自己的任务 |
| GUEST | 访客 — 仅上传 |

## 设计说明

- **视觉方向**：Awwwards 风格现代数字工作空间
- **配色**：极简黑白灰 + 单一品牌强调色
- **字体**：Inter (EN/数字) + 系统无衬线 (CN)
- **动效**：150-350ms，支持 prefers-reduced-motion
- **圆角**：中等克制 (8-12px)
- **阴影**：极少使用，靠空间和边框区分层级

## License

Internal Use Only — 海洋科学与工程学院团总支

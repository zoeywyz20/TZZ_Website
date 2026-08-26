# 海洋院团总支数字工作台

> Ocean Youth League Digital Workspace

面向高校团总支内部使用的「任务协作 + 文件资料管理 + 审核归档 + 部门协同」数字化工作平台。

设计理念：**资料跟着任务走，而不是只存在文件夹里。**

## 技术栈

| 技术 | 说明 |
|---|---|
| **Next.js 16** | App Router, Route Handlers, React Server Components |
| **TypeScript** | 严格模式 |
| **PostgreSQL + Prisma ORM** | 服务端数据持久化（逐模块接入中） |
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
  mock.ts             # Mock 数据（成员、部门、任务、文件等）
hooks/
  use-auth.tsx        # 认证 Context
lib/
  db.ts               # Prisma Client 服务端单例
  api/                 # API 通用响应工具
  utils.ts            # 工具函数
  permissions.ts      # RBAC 权限层
  storage.ts          # Storage Adapter 抽象
types/
  index.ts            # TypeScript 类型定义
prisma/
  schema.prisma       # PostgreSQL 数据模型
```

## 如何运行

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器
open http://localhost:3000
```

默认以 Mock 模式运行，无需配置数据库或对象存储。

## 环境变量

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

开发模式下不需要填写真实值。

## Mock 模式

当前所有数据来自 `data/mock.ts`，包括：

- 9 位真实角色成员
- 3 个部门
- 8 个真实任务（含交付清单）
- 文件记录、审核历史
- 通知、活动日志
- 模板数据

可直接 `npm run dev` 完整体验。

## PostgreSQL / Prisma

将 `.env.example` 复制为 `.env.local`，并只在服务端配置：

```env
DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE"
FILE_STORAGE_ROOT=/data/tzz/files
```

初始化开发数据库并验证连接：

```bash
npm run db:validate
npm run db:migrate:dev -- --name init
npm run dev
curl http://localhost:3000/api/health
```

当前 API 基础设施已经接入 PostgreSQL；现有页面仍按部门、成员、文件、任务的顺序逐步从 `data/mock.ts` 迁移。

## 文件存储规划

文件本体不会写入 PostgreSQL。生产环境使用 `FILE_STORAGE_ROOT` 指向 Rocky Linux 文件系统，数据库只保存文件元数据和服务端存储键。现有 `lib/storage.ts` 仍是前端演示适配器，将在文件模块接入时替换为仅服务端可用的本地文件存储实现。

已有的存储抽象接口为：

```typescript
interface StorageAdapter {
  uploadFile(key, file, options)
  deleteFile(key)
  getSignedUrl(key, expiresIn)
  createMultipartUpload(key, file, options)
}
```

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

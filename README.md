<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 学生加权平均分计算器 - 全栈版

🏫 **成绩管理系统** — 支持学生管理、课程管理、成绩录入、加权平均分/GPA 计算、Excel 导入导出、班级统计排名。

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 19 + TypeScript + Tailwind CSS 4 + Vite 6 |
| **后端** | Express 4 + TypeScript (tsx 运行时) |
| **数据库** | SQLite (sql.js) |
| **图表** | Recharts (饼图、环形图) |
| **Excel** | xlsx (导入/导出) |
| **动画** | Motion (Framer Motion) |

## 快速开始

### 前置要求

- **Node.js** >= 18

### 安装与运行

```bash
# 1. 克隆项目
git clone https://github.com/wangeuoxi/avg_calculator.git
cd avg_calculator

# 2. 安装所有依赖 (前端 + 后端)
npm install
cd server && npm install && cd ..

# 3. 一键启动前后端
npm run dev
```

启动后：
- **前端页面**: http://localhost:3000
- **后端 API**: http://localhost:3001
- 前端通过 Vite proxy 自动转发 `/api/*` 到后端

### 分别启动（可选）

```bash
# 只启动后端
npm start

# 只启动前端
npm run dev:client

# 只启动后端
npm run dev:server
```

## 功能特性

### 📊 学生管理
- 添加/删除学生（自动生成学号）
- 编辑学生姓名
- 侧边栏显示课程数、GPA 概览

### 📚 课程与成绩管理
- 为每个学生添加课程和成绩
- 实时编辑成绩（自动计算加权分和绩点）
- 支持等级制成绩（优秀/良好/中等/及格/不及格 ↔ 分数自动转换）
- 批量管理课程学分

### 📈 统计分析
- **个人统计**：加权平均分、总学分、GPA、及格率、成绩分布饼图
- **班级统计**：班级平均分、班级平均 GPA、按加权平均分排名
- **GPA 仪表盘**：环形图显示 GPA，与班级平均对比

### 📁 Excel 导入导出
- **导入**：自动识别包含"学号"和"姓名"的表头，支持任意多列课程
- **导出**：导出排名表（学号、姓名、总学分、加权平均分、平均 GPA）

### 💾 数据持久化
- 数据存储在 `server/data/grades.db` (SQLite)
- 关闭浏览器不会丢失数据
- 可跨设备共享（拷贝数据库文件即可）

## API 接口文档

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/students` | 学生列表 (含加权平均分) |
| `GET` | `/api/students/:id` | 学生详情 + 成绩 |
| `POST` | `/api/students` | 创建学生 |
| `PUT` | `/api/students/:id` | 更新学生姓名 |
| `DELETE` | `/api/students/:id` | 删除学生 (级联删除成绩) |
| `GET` | `/api/courses` | 课程列表 |
| `POST` | `/api/courses` | 创建/更新课程学分 |
| `PUT` | `/api/courses/:name` | 更新课程学分 |
| `DELETE` | `/api/courses/:name` | 删除课程 (级联删除成绩) |
| `POST` | `/api/grades/:sid` | 添加/更新成绩 |
| `DELETE` | `/api/grades/:sid/:cn` | 删除成绩 |
| `DELETE` | `/api/grades/:sid` | 清空学生所有成绩 |
| `GET` | `/api/stats/class` | 班级统计数据 |
| `GET` | `/api/stats/student/:id` | 学生个人统计数据 |
| `GET` | `/api/stats/export-ranking` | 导出排名数据 |

## 项目结构

```
avg_calculator/
├── src/                    # 前端源码
│   ├── App.tsx             # 主应用组件
│   ├── api.ts              # API 客户端 (封装请求)
│   ├── main.tsx            # React 入口
│   ├── types.ts            # TypeScript 类型
│   ├── index.css           # Tailwind CSS + 自定义样式
│   └── lib/
│       └── utils.ts        # 工具函数 (加权平均/GPA计算)
├── server/                 # 后端源码
│   ├── src/
│   │   ├── index.ts        # Express 入口
│   │   ├── db.ts           # SQLite 数据库初始化与操作
│   │   ├── routes/
│   │   │   ├── students.ts # 学生 CRUD API
│   │   │   ├── courses.ts  # 课程 CRUD API
│   │   │   ├── grades.ts   # 成绩 CRUD API
│   │   │   └── stats.ts    # 统计分析 API
│   │   └── middleware/
│   │       └── errorHandler.ts
│   ├── package.json
│   └── tsconfig.json
├── index.html              # 前端 HTML 入口
├── package.json            # 根 package.json (含前后端启动脚本)
├── vite.config.ts          # Vite 配置 + API Proxy
├── metadata.json           # AI Studio 元数据
└── README.md
```

## 构建部署

```bash
# 构建前端
npm run build

# 生产环境：用 nginx 代理前端构建产物，后端跑 Node
npm start   # 后端监听 3001 端口
```

## 许可证

MIT

import express from 'express';
import cors from 'cors';
import studentsRouter from './routes/students.js';
import coursesRouter from './routes/courses.js';
import gradesRouter from './routes/grades.js';
import statsRouter from './routes/stats.js';
import { initDb } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/students', studentsRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/grades', gradesRouter);
app.use('/api/stats', statsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// 启动前初始化数据库
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`✨ 成绩管理系统后端已启动: http://localhost:${PORT}`);
    console.log(`📊 数据库: MySQL`);
    console.log(`📚 API 文档:`);
    console.log(`   GET    /api/students        - 学生列表`);
    console.log(`   POST   /api/students        - 创建学生`);
    console.log(`   PUT    /api/students/:id    - 更新学生`);
    console.log(`   DELETE /api/students/:id    - 删除学生`);
    console.log(`   GET    /api/courses         - 课程列表`);
    console.log(`   POST   /api/courses         - 创建/更新课程`);
    console.log(`   DELETE /api/courses/:name   - 删除课程`);
    console.log(`   POST   /api/grades/:sid     - 添加/更新成绩`);
    console.log(`   DELETE /api/grades/:sid/:cn - 删除成绩`);
    console.log(`   GET    /api/stats/class     - 班级统计`);
    console.log(`   GET    /api/stats/student/:id - 学生个人统计`);
    console.log(`   GET    /api/health          - 健康检查`);
  });
}).catch(err => {
  console.error('❌ 数据库初始化失败:', err.message);
  process.exit(1);
});

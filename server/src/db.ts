import mysql from 'mysql2/promise';

// 数据库配置，从环境变量读取（部署时设置）
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'avg_calculator',
  password: process.env.DB_PASSWORD || 'avg_calculator_pass',
  database: process.env.DB_NAME || 'avg_calculator',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
};

let pool: mysql.Pool | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (pool) return pool;
  pool = mysql.createPool(DB_CONFIG);
  return pool;
}

export async function initDb(): Promise<void> {
  // 先连 MySQL（不带 database 名），创建数据库
  const initConn = await mysql.createConnection({
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
  });
  await initConn.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await initConn.end();

  // 获取连接池
  const p = await getPool();

  // 建表
  await p.execute(`
    CREATE TABLE IF NOT EXISTS students (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS courses (
      name VARCHAR(200) PRIMARY KEY,
      credit DECIMAL(5,1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS grades (
      id VARCHAR(100) PRIMARY KEY,
      student_id VARCHAR(100) NOT NULL,
      course_name VARCHAR(200) NOT NULL,
      grade DECIMAL(5,1) NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_student_course (student_id, course_name),
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY (course_name) REFERENCES courses(name) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try { await p.execute(`CREATE INDEX idx_grades_student ON grades(student_id)`); } catch {}
  try { await p.execute(`CREATE INDEX idx_grades_course ON grades(course_name)`); } catch {}

  console.log('✅ 数据库初始化完成');
}

export async function getDb(): Promise<mysql.Pool> {
  return getPool();
}

export async function getRows(db: mysql.Pool, sql: string, params: any[] = []): Promise<any[]> {
  const [rows] = await db.execute(sql, params);
  return rows as any[];
}

export async function getRow(db: mysql.Pool, sql: string, params: any[] = []): Promise<any | null> {
  const [rows] = await db.execute(sql, params);
  const arr = rows as any[];
  return arr.length > 0 ? arr[0] : null;
}

export async function runSql(db: mysql.Pool, sql: string, params: any[] = []): Promise<{ affectedRows: number }> {
  const [result] = await db.execute(sql, params);
  return result as any;
}

// MySQL 不需要手动 saveDb，这里保留为无操作函数，避免改 route 文件时 import 出错
export function saveDb(_db?: any) {
  // MySQL 自动持久化，无需手动保存
}

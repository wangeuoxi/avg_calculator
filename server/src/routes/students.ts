import { Router, Request, Response } from 'express';
import { getDb, getRows, getRow, runSql, saveDb } from '../db.js';

const router = Router();

// GET /api/students
router.get('/', async (req: Request, res: Response) => {
  const db = await getDb();
  const students = getRows(db, `
    SELECT s.*,
      (SELECT COUNT(*) FROM grades g WHERE g.student_id = s.id) as course_count,
      COALESCE((
        SELECT SUM(g.grade * c.credit) / NULLIF(SUM(c.credit), 0)
        FROM grades g
        JOIN courses c ON c.name = g.course_name
        WHERE g.student_id = s.id
      ), 0) as weighted_avg
    FROM students s
    ORDER BY s.name
  `);
  res.json(students);
});

// GET /api/students/:id
router.get('/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  const student = getRow(db, 'SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!student) {
    res.status(404).json({ error: '学生不存�? });
    return;
  }

  const grades = getRows(db, `
    SELECT g.id, g.grade, c.name as course_name, c.credit
    FROM grades g
    JOIN courses c ON c.name = g.course_name
    WHERE g.student_id = ?
    ORDER BY c.name
  `, [req.params.id]);

  res.json({ ...student, grades });
});

// POST /api/students
router.post('/', async (req: Request, res: Response) => {
  const db = await getDb();
  const { id, name } = req.body;

  if (!id || !name) {
    res.status(400).json({ error: '学号和姓名不能为�? });
    return;
  }

  const existing = getRow(db, 'SELECT id FROM students WHERE id = ?', [id]);
  if (existing) {
    res.status(409).json({ error: '该学号已存在' });
    return;
  }

  runSql(db, "INSERT INTO students (id, name) VALUES (?, ?)", [id, name]);
  saveDb(db);

  const student = getRow(db, 'SELECT * FROM students WHERE id = ?', [id]);
  res.status(201).json(student);
});

// PUT /api/students/:id
router.put('/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  const { name } = req.body;

  if (!name) {
    res.status(400).json({ error: '姓名不能为空' });
    return;
  }

  const result = runSql(db,
    "UPDATE students SET name = ?, updated_at = NOW() WHERE id = ?",
    [name, req.params.id]
  );

  if (result.changes === 0) {
    res.status(404).json({ error: '学生不存�? });
    return;
  }

  saveDb(db);
  const student = getRow(db, 'SELECT * FROM students WHERE id = ?', [req.params.id]);
  res.json(student);
});

// DELETE /api/students/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  runSql(db, 'DELETE FROM grades WHERE student_id = ?', [req.params.id]);
  const result = runSql(db, 'DELETE FROM students WHERE id = ?', [req.params.id]);

  if (result.changes === 0) {
    res.status(404).json({ error: '学生不存�? });
    return;
  }

  saveDb(db);
  res.json({ message: '删除成功' });
});

// POST /api/students/import - 批量导入
router.post('/import', async (req: Request, res: Response) => {
  const db = await getDb();
  const { students } = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: '数据不能为空' });
    return;
  }

  try {
    for (const stu of students) {
      const existing = getRow(db, 'SELECT id FROM students WHERE id = ?', [stu.id]);
      if (existing) {
        runSql(db, "UPDATE students SET name = ?, updated_at = NOW() WHERE id = ?", [stu.name, stu.id]);
      } else {
        runSql(db, 'INSERT INTO students (id, name) VALUES (?, ?)', [stu.id, stu.name]);
      }

      for (const g of stu.grades || []) {
        const course = getRow(db, 'SELECT * FROM courses WHERE name = ?', [g.course_name]);
        if (!course) {
          runSql(db, 'INSERT INTO courses (name, credit) VALUES (?, 1)', [g.course_name]);
        }

        const existingGrade = getRow(db, 'SELECT * FROM grades WHERE student_id = ? AND course_name = ?', [stu.id, g.course_name]);
        const gradeId = existingGrade
          ? existingGrade.id
          : `G${Date.now()}${Math.random().toString(36).substr(2, 4)}`;

        if (existingGrade) {
          runSql(db, "UPDATE grades SET grade = ?, updated_at = NOW() WHERE id = ?", [g.grade, gradeId]);
        } else {
          runSql(db, 'INSERT INTO grades (id, student_id, course_name, grade) VALUES (?, ?, ?, ?)', [gradeId, stu.id, g.course_name, g.grade]);
        }
      }
    }

    saveDb(db);
    res.json({ success: true, count: students.length });
  } catch (err: any) {
    res.status(500).json({ error: '导入失败: ' + err.message });
  }
});

export default router;

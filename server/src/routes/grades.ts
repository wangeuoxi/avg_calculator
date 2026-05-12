import { Router, Request, Response } from 'express';
import { getDb, getRows, getRow, runSql, saveDb } from '../db.js';

const router = Router();

// POST /api/grades/:studentId - add/update grade
router.post('/:studentId', async (req: Request, res: Response) => {
  const db = await getDb();
  const { course_name, grade } = req.body;

  if (!course_name || grade === undefined) {
    res.status(400).json({ error: '课程名称和成绩不能为空' });
    return;
  }

  const student = getRow(db, 'SELECT * FROM students WHERE id = ?', [req.params.studentId]);
  if (!student) {
    res.status(404).json({ error: '学生不存在' });
    return;
  }

  // Auto-create course if not exists
  let course = getRow(db, 'SELECT * FROM courses WHERE name = ?', [course_name]);
  if (!course) {
    runSql(db, 'INSERT INTO courses (name, credit) VALUES (?, 1)', [course_name]);
  }

  // Upsert grade
  const existingGrade = getRow(db,
    'SELECT * FROM grades WHERE student_id = ? AND course_name = ?',
    [req.params.studentId, course_name]
  );

  const gradeId = existingGrade
    ? existingGrade.id
    : `G${Date.now()}${Math.random().toString(36).substr(2, 4)}`;

  if (existingGrade) {
    runSql(db,
      "UPDATE grades SET grade = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
      [grade, gradeId]
    );
  } else {
    runSql(db,
      'INSERT INTO grades (id, student_id, course_name, grade) VALUES (?, ?, ?, ?)',
      [gradeId, req.params.studentId, course_name, grade]
    );
  }

  saveDb(db);

  const result = getRow(db, `
    SELECT g.*, c.credit
    FROM grades g
    JOIN courses c ON c.name = g.course_name
    WHERE g.id = ?
  `, [gradeId]);

  res.status(existingGrade ? 200 : 201).json(result);
});

// DELETE /api/grades/:studentId/:courseName
router.delete('/:studentId/:courseName', async (req: Request, res: Response) => {
  const db = await getDb();
  const result = runSql(db,
    'DELETE FROM grades WHERE student_id = ? AND course_name = ?',
    [req.params.studentId, req.params.courseName]
  );

  if (result.changes === 0) {
    res.status(404).json({ error: '成绩记录不存在' });
    return;
  }

  saveDb(db);
  res.json({ message: '删除成功' });
});

// DELETE /api/grades/:studentId - clear all grades for a student
router.delete('/:studentId', async (req: Request, res: Response) => {
  const db = await getDb();
  runSql(db, 'DELETE FROM grades WHERE student_id = ?', [req.params.studentId]);
  saveDb(db);
  res.json({ message: '已清空该学生所有成绩' });
});

export default router;

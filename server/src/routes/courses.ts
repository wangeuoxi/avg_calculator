import { Router, Request, Response } from 'express';
import { getDb, getRows, getRow, runSql, saveDb } from '../db.js';

const router = Router();

// GET /api/courses
router.get('/', async (req: Request, res: Response) => {
  const db = await getDb();
  const courses = getRows(db, `
    SELECT c.*,
      (SELECT COUNT(*) FROM grades g WHERE g.course_name = c.name) as student_count
    FROM courses c
    ORDER BY c.name
  `);
  res.json(courses);
});

// POST /api/courses
router.post('/', async (req: Request, res: Response) => {
  const db = await getDb();
  const { name, credit } = req.body;

  if (!name) {
    res.status(400).json({ error: '课程名称不能为空' });
    return;
  }

  const existing = getRow(db, 'SELECT * FROM courses WHERE name = ?', [name]);
  if (existing) {
    runSql(db,
      "UPDATE courses SET credit = ?, updated_at = NOW() WHERE name = ?",
      [credit ?? 1, name]
    );
  } else {
    runSql(db, 'INSERT INTO courses (name, credit) VALUES (?, ?)', [name, credit ?? 1]);
  }

  saveDb(db);
  const course = getRow(db, 'SELECT * FROM courses WHERE name = ?', [name]);
  res.status(existing ? 200 : 201).json(course);
});

// PUT /api/courses/:name
router.put('/:name', async (req: Request, res: Response) => {
  const db = await getDb();
  const { credit } = req.body;

  if (credit === undefined) {
    res.status(400).json({ error: '学分不能为空' });
    return;
  }

  const result = runSql(db,
    "UPDATE courses SET credit = ?, updated_at = NOW() WHERE name = ?",
    [credit, req.params.name]
  );

  if (result.changes === 0) {
    res.status(404).json({ error: '课程不存�? });
    return;
  }

  saveDb(db);
  const course = getRow(db, 'SELECT * FROM courses WHERE name = ?', [req.params.name]);
  res.json(course);
});

// DELETE /api/courses/:name
router.delete('/:name', async (req: Request, res: Response) => {
  const db = await getDb();
  runSql(db, 'DELETE FROM grades WHERE course_name = ?', [req.params.name]);
  const result = runSql(db, 'DELETE FROM courses WHERE name = ?', [req.params.name]);

  if (result.changes === 0) {
    res.status(404).json({ error: '课程不存�? });
    return;
  }

  saveDb(db);
  res.json({ message: '删除成功' });
});

export default router;

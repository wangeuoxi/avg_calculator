import { Router, Request, Response } from 'express';
import { getDb, getRows, getRow, runSql, saveDb } from '../db.js';

const router = Router();

function calculateGPA(grade: number): number {
  if (grade >= 90) return 4.0;
  if (grade >= 85) return 3.7;
  if (grade >= 82) return 3.3;
  if (grade >= 78) return 3.0;
  if (grade >= 75) return 2.7;
  if (grade >= 72) return 2.3;
  if (grade >= 68) return 2.0;
  if (grade >= 64) return 1.5;
  if (grade >= 60) return 1.0;
  return 0;
}

// GET /api/stats/class
router.get('/class', async (req: Request, res: Response) => {
  const db = await getDb();
  const students = getRows(db, 'SELECT id, name FROM students ORDER BY name');

  if (students.length === 0) {
    res.json({
      total_students: 0,
      weighted_avg: 0,
      avg_gpa: 0,
      pass_rate: 0,
      students: []
    });
    return;
  }

  const studentStats = students.map(student => {
    const grades = getRows(db, `
      SELECT g.grade, c.credit
      FROM grades g
      JOIN courses c ON c.name = g.course_name
      WHERE g.student_id = ?
    `, [student.id]);

    const totalCredits = grades.reduce((sum: number, g: any) => sum + g.credit, 0);
    const weightedSum = grades.reduce((sum: number, g: any) => sum + g.grade * g.credit, 0);
    const weightedAvg = totalCredits > 0 ? weightedSum / totalCredits : 0;
    const gpaSum = grades.reduce((sum: number, g: any) => sum + calculateGPA(g.grade) * g.credit, 0);
    const avgGPA = totalCredits > 0 ? gpaSum / totalCredits : 0;
    const passCount = grades.filter((g: any) => g.grade >= 60).length;
    const totalCount = grades.length;

    return {
      student_id: student.id,
      student_name: student.name,
      course_count: totalCount,
      total_credits: Math.round(totalCredits * 10) / 10,
      weighted_avg: Math.round(weightedAvg * 100) / 100,
      avg_gpa: Math.round(avgGPA * 100) / 100,
      pass_rate: totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0
    };
  });

  const validStats = studentStats.filter(s => s.course_count > 0);
  const classWeightedAvg = validStats.length > 0
    ? Math.round(validStats.reduce((sum, s) => sum + s.weighted_avg, 0) / validStats.length * 100) / 100
    : 0;
  const classAvgGPA = validStats.length > 0
    ? Math.round(validStats.reduce((sum, s) => sum + s.avg_gpa, 0) / validStats.length * 100) / 100
    : 0;
  const totalPassStudents = validStats.filter(s => s.pass_rate >= 60).length;
  const passRate = validStats.length > 0
    ? Math.round((totalPassStudents / validStats.length) * 100)
    : 0;

  const ranked = [...studentStats].sort((a, b) => b.weighted_avg - a.weighted_avg);

  res.json({
    total_students: students.length,
    weighted_avg: classWeightedAvg,
    avg_gpa: classAvgGPA,
    pass_rate: passRate,
    students: ranked
  });
});

// GET /api/stats/student/:id
router.get('/student/:id', async (req: Request, res: Response) => {
  const db = await getDb();
  const student = getRow(db, 'SELECT * FROM students WHERE id = ?', [req.params.id]);
  if (!student) {
    res.status(404).json({ error: '学生不存在' });
    return;
  }

  const grades = getRows(db, `
    SELECT g.id, g.grade, c.name as course_name, c.credit
    FROM grades g
    JOIN courses c ON c.name = g.course_name
    WHERE g.student_id = ?
    ORDER BY c.name
  `, [req.params.id]);

  const totalCredits = grades.reduce((sum: number, g: any) => sum + g.credit, 0);
  const weightedSum = grades.reduce((sum: number, g: any) => sum + g.grade * g.credit, 0);
  const weightedAvg = totalCredits > 0
    ? Math.round((weightedSum / totalCredits) * 100) / 100
    : 0;
  const gpaSum = grades.reduce((sum: number, g: any) => sum + calculateGPA(g.grade) * g.credit, 0);
  const avgGPA = totalCredits > 0
    ? Math.round((gpaSum / totalCredits) * 100) / 100
    : 0;
  const passCount = grades.filter((g: any) => g.grade >= 60).length;

  const distribution = {
    excellent: grades.filter((g: any) => g.grade >= 90).length,
    good: grades.filter((g: any) => g.grade >= 80 && g.grade < 90).length,
    fair: grades.filter((g: any) => g.grade >= 70 && g.grade < 80).length,
    pass: grades.filter((g: any) => g.grade >= 60 && g.grade < 70).length,
    fail: grades.filter((g: any) => g.grade < 60).length
  };

  res.json({
    ...student,
    course_count: grades.length,
    total_credits: totalCredits,
    weighted_avg: weightedAvg,
    avg_gpa: avgGPA,
    pass_rate: grades.length > 0 ? Math.round((passCount / grades.length) * 100) : 0,
    distribution,
    grades
  });
});

// GET /api/stats/export-ranking
router.get('/export-ranking', async (req: Request, res: Response) => {
  const db = await getDb();
  const students = getRows(db, 'SELECT * FROM students ORDER BY name');

  const ranking = students.map((student: any) => {
    const grades = getRows(db, `
      SELECT g.grade, c.credit
      FROM grades g
      JOIN courses c ON c.name = g.course_name
      WHERE g.student_id = ?
    `, [student.id]);

    const totalCredits = grades.reduce((sum: number, g: any) => sum + g.credit, 0);
    const weightedSum = grades.reduce((sum: number, g: any) => sum + g.grade * g.credit, 0);
    const weightedAvg = totalCredits > 0 ? weightedSum / totalCredits : 0;
    const gpaSum = grades.reduce((sum: number, g: any) => sum + calculateGPA(g.grade) * g.credit, 0);
    const avgGPA = totalCredits > 0 ? gpaSum / totalCredits : 0;

    return {
      student_id: student.id,
      student_name: student.name,
      course_count: grades.length,
      total_credits: Math.round(totalCredits * 10) / 10,
      weighted_avg: Math.round(weightedAvg * 100) / 100,
      avg_gpa: Math.round(avgGPA * 100) / 100
    };
  });

  // 支持 ?sort=gpa 按 GPA 排序，默认按加权平均分排序
  const sortBy = req.query.sort === 'gpa' ? 'avg_gpa' : 'weighted_avg';
  ranking.sort((a: any, b: any) => (b as any)[sortBy] - (a as any)[sortBy]);

  res.json(ranking);
});

export default router;

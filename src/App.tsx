import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Users, 
  Plus, 
  FileUp, 
  FileDown, 
  Trash2, 
  Settings, 
  GraduationCap, 
  BookOpen, 
  AlertCircle,
  ChevronRight,
  Search,
  RotateCcw,
  Save,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn, calculateWeightedAverage, calculateAverageGPA, calculateGPA } from './lib/utils';
import {
  fetchStudents,
  fetchStudentDetail,
  fetchStudentStats,
  fetchClassStats,
  fetchCourses,
  fetchRanking,
  createStudent,
  updateStudent,
  deleteStudent,
  upsertCourse,
  updateCourseCredit,
  deleteCourse,
  upsertGrade,
  deleteGrade,
  clearStudentGrades,
  importStudents,
  type StudentRecord,
  type StudentFullStats,
  type ClassStats,
  type CourseRecord,
  type RankingEntry,
} from './api';

// ============ Types ============

interface Course {
  id: string;
  name: string;
  grade: number | string;
  credit: number | string;
}

interface Student {
  id: string;
  name: string;
  courses: Course[];
}

interface UndoState {
  type: 'delete-student' | 'delete-course' | 'clear-grades';
  studentId?: string;
  courseName?: string;
  data?: any;
}

// ============ Helpers ============

function parseGrade(val: any): number {
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s) return 0;
  const mapping: Record<string, number> = {
    '优秀': 95, '良好': 85, '中等': 75, '及格': 65, '不及格': 50,
    'A': 95, 'B': 85, 'C': 75, 'D': 65, 'F': 50
  };
  return mapping[s] || parseFloat(s) || 0;
}

const excludeHeaders = ['序号', '学号', '姓名', '平均绩点', '绩点', '排名', '备注'];

// ============ App Component ============

export default function App() {
  const [view, setView] = useState<'students' | 'courses'>('students');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Data
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentDetail, setStudentDetail] = useState<any | null>(null);
  const [studentStats, setStudentStats] = useState<StudentFullStats | null>(null);
  const [classStats, setClassStats] = useState<ClassStats | null>(null);
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);

  // UI state
  const [loading, setLoading] = useState({ students: true, detail: false, stats: false, courses: false });
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Course management
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  // ============ Data Fetching ============

  const loadStudentsAndStats = useCallback(async () => {
    try {
      const [stuData, clsStats] = await Promise.all([
        fetchStudents(),
        fetchClassStats().catch(() => null),
      ]);
      setStudents(stuData);
      setClassStats(clsStats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(prev => ({ ...prev, students: false }));
    }
  }, []);

  const loadStudentDetail = useCallback(async (id: string) => {
    setLoading(prev => ({ ...prev, detail: true }));
    try {
      const [detail, stats] = await Promise.all([
        fetchStudentDetail(id),
        fetchStudentStats(id),
      ]);
      setStudentDetail(detail);
      setStudentStats(stats);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(prev => ({ ...prev, detail: false }));
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setLoading(prev => ({ ...prev, courses: true }));
    try {
      const data = await fetchCourses();
      setCourses(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(prev => ({ ...prev, courses: false }));
    }
  }, []);

  const loadRanking = useCallback(async () => {
    try {
      const data = await fetchRanking();
      setRanking(data);
    } catch (_) {}
  }, []);

  // Initial load
  useEffect(() => {
    loadStudentsAndStats();
    loadCourses();
    loadRanking();
  }, [loadStudentsAndStats, loadCourses, loadRanking]);

  // Load detail when student selected
  useEffect(() => {
    if (selectedStudentId) {
      loadStudentDetail(selectedStudentId);
    } else {
      setStudentDetail(null);
      setStudentStats(null);
    }
  }, [selectedStudentId, loadStudentDetail]);

  // ============ Undo ============

  const triggerUndo = (state: UndoState) => {
    setUndoState(state);
    setShowUndo(true);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndo(false);
      setUndoState(null);
    }, 5000);
  };

  const handleUndo = () => {
    setShowUndo(false);
    setUndoState(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    // Reload everything to restore state
    loadStudentsAndStats();
    loadCourses();
    loadRanking();
    if (selectedStudentId) loadStudentDetail(selectedStudentId);
  };

  // ============ Student Actions ============

  const handleAddStudent = async () => {
    const newId = `S${Date.now()}`;
    try {
      await createStudent(newId, '新学生');
      await loadStudentsAndStats();
      setSelectedStudentId(newId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteStudent(id);
      triggerUndo({ type: 'delete-student', studentId: id });
      if (selectedStudentId === id) setSelectedStudentId(null);
      loadRanking();
      await loadStudentsAndStats();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateStudentName = async (id: string, name: string) => {
    try {
      await updateStudent(id, name);
      await loadStudentsAndStats();
      if (selectedStudentId === id) loadStudentDetail(id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateStudentId = async (oldId: string, newId: string) => {
    // Create new student, copy grades, delete old
    try {
      const detail = await fetchStudentDetail(oldId);
      await createStudent(newId, detail.name);
      if (detail.grades) {
        for (const g of detail.grades) {
          await upsertGrade(newId, g.course_name, g.grade);
        }
      }
      await deleteStudent(oldId);
      setSelectedStudentId(newId);
      await loadStudentsAndStats();
      loadStudentDetail(newId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ============ Course Actions ============

  const handleAddCourseToStudent = async (studentId: string, courseName: string, grade: number) => {
    try {
      await upsertGrade(studentId, courseName, grade);
      await upsertCourse(courseName, 1).catch(() => {});
      loadStudentDetail(studentId);
      loadCourses();
      loadStudentsAndStats();
      loadRanking();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateGrade = async (studentId: string, courseName: string, grade: number) => {
    try {
      await upsertGrade(studentId, courseName, grade);
      loadStudentDetail(studentId);
      loadStudentsAndStats();
      loadRanking();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteGrade = async (studentId: string, courseName: string) => {
    try {
      await deleteGrade(studentId, courseName);
      loadStudentDetail(studentId);
      loadStudentsAndStats();
      loadRanking();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleClearGrades = async (studentId: string) => {
    try {
      await clearStudentGrades(studentId);
      triggerUndo({ type: 'clear-grades', studentId });
      loadStudentDetail(studentId);
      loadStudentsAndStats();
      loadCourses();
      loadRanking();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUpdateCourseCredit = async (name: string, credit: number) => {
    try {
      await updateCourseCredit(name, credit);
      loadCourses();
      if (selectedStudentId) loadStudentDetail(selectedStudentId);
    } catch (e: any) {
      // Course might not exist yet, try creating
      try {
        await upsertCourse(name, credit);
        loadCourses();
      } catch (_) {}
    }
  };

  const handleAddCourseGlobal = async (name: string, credit: number) => {
    try {
      await upsertCourse(name, credit);
      loadCourses();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteCourseGlobal = async (name: string) => {
    try {
      await deleteCourse(name);
      triggerUndo({ type: 'delete-course', courseName: name });
      loadCourses();
      loadStudentsAndStats();
      loadRanking();
      if (selectedStudentId) loadStudentDetail(selectedStudentId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ============ Excel Import ============

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
          
          if (rawData.length < 2) {
            setError('Excel 文件为空或格式不正确');
            setImporting(false);
            return;
          }

          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(rawData.length, 10); i++) {
            if (rawData[i].includes('学号') && rawData[i].includes('姓名')) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex === -1) {
            setError('未找到包含"学号"和"姓名"的表头行');
            setImporting(false);
            return;
          }

          const headers = rawData[headerRowIndex];
          const idIdx = headers.indexOf('学号');
          const nameIdx = headers.indexOf('姓名');

          const courseColumns = headers.map((h: string, idx: number) => ({ name: String(h), index: idx }))
            .filter(h => h.name && !excludeHeaders.includes(h.name) && h.index !== idIdx && h.index !== nameIdx);

          // 组装所有数据，一次批量提交
          const studentsData: { id: string; name: string; grades: { course_name: string; grade: number }[] }[] = [];

          for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            const id = String(row[idIdx] || '').trim();
            const name = String(row[nameIdx] || '').trim();
            if (!id || !name) continue;

            const grades: { course_name: string; grade: number }[] = [];
            for (const col of courseColumns) {
              const gradeVal = row[col.index];
              if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== '') {
                grades.push({ course_name: col.name, grade: parseGrade(gradeVal) });
              }
            }
            studentsData.push({ id, name, grades });
          }

          // 一次请求搞定
          await importStudents(studentsData);

          await Promise.all([
            loadStudentsAndStats(),
            loadCourses(),
            loadRanking(),
          ]);

          if (selectedStudentId) loadStudentDetail(selectedStudentId);
        } catch (err: any) {
          setError('导入失败: ' + err.message);
        } finally {
          setImporting(false);
        }
      };
      reader.readAsBinaryString(file);
      e.target.value = '';
    } catch (err: any) {
      setError('导入失败: ' + err.message);
      setImporting(false);
    }
  };

  // ============ Export ============

  const handleExportRanking = async (sortBy: 'weighted' | 'gpa' = 'weighted') => {
    try {
      const cls = classStats || await fetchClassStats().catch(() => null);
      const rank = await fetchRanking(sortBy);

      const title = sortBy === 'gpa' ? 'GPA 排名表' : '加权平均分排名表';
      const fileName = sortBy === 'gpa' ? '学生GPA排名表.xlsx' : '学生加权平均分排名表.xlsx';

      const rankingData = rank.map((r, i) => ({
        '排名': i + 1,
        '学号': r.student_id,
        '姓名': r.student_name,
        '课程数': r.course_count,
        '总学分': r.total_credits,
        '加权平均分': r.weighted_avg.toFixed(2),
        '平均GPA': r.avg_gpa.toFixed(2)
      }));

      const finalData = [
        ...rankingData,
        {},
        {
          '排名': '',
          '学号': '班级统计',
          '姓名': '-',
          '课程数': '-',
          '总学分': '-',
          '加权平均分': cls?.weighted_avg?.toFixed(2) || '0.00',
          '平均GPA': cls?.avg_gpa?.toFixed(2) || '0.00'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(finalData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title);
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      setError('导出失败: ' + err.message);
    }
  };

  // ============ Reset ============

  const handleReset = async () => {
    try {
      const studentsList = await fetchStudents();
      for (const s of studentsList) {
        await deleteStudent(s.id);
      }
      const coursesList = await fetchCourses();
      for (const c of coursesList) {
        await deleteCourse(c.name);
      }
      setSelectedStudentId(null);
      await Promise.all([
        loadStudentsAndStats(),
        loadCourses(),
        loadRanking(),
      ]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ============ Derived Data for Selected Student ============

  const convertedStudentCourses: Course[] = useMemo(() => {
    if (!studentStats?.grades) return [];
    return studentStats.grades.map(g => ({
      id: g.id,
      name: g.course_name,
      grade: g.grade,
      credit: g.credit,
    }));
  }, [studentStats]);

  const selectedStudentName = studentDetail?.name || studentStats?.name || '';

  // ============ Render ============

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:text-red-200">
              <Plus className="w-4 h-4 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo Notification */}
      <AnimatePresence>
        {showUndo && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">数据已被删除</span>
            </div>
            <div className="w-px h-4 bg-white/20"></div>
            <button 
              onClick={handleUndo}
              className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              撤回
            </button>
            <button 
              onClick={() => setShowUndo(false)}
              className="text-white/40 hover:text-white transition-colors"
            >
              <Plus className="w-4 h-4 rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <span>成绩管理系统</span>
            </div>
            <button 
              onClick={handleReset}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
          </div>

          <div className="flex flex-col gap-2 mb-6">
            <button 
              onClick={() => setView('students')}
              className={cn(
                "w-full py-2.5 px-4 rounded-xl flex items-center gap-3 transition-all text-sm font-medium",
                view === 'students' ? "bg-blue-600 text-white shadow-md" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <Users className="w-4 h-4" />
              学生列表
            </button>
            <button 
              onClick={() => { setView('courses'); loadCourses(); }}
              className={cn(
                "w-full py-2.5 px-4 rounded-xl flex items-center gap-3 transition-all text-sm font-medium",
                view === 'courses' ? "bg-blue-600 text-white shadow-md" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <BookOpen className="w-4 h-4" />
              课程库管理
            </button>
          </div>

          <div className="h-px bg-slate-100 mb-6"></div>

          <button 
            onClick={handleAddStudent}
            disabled={loading.students}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 mb-4 disabled:opacity-50"
          >
            {loading.students ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            添加学生
          </button>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors text-sm text-slate-600">
              <FileUp className="w-4 h-4" />
              {importing ? '导入中...' : '导入 Excel'}
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} disabled={importing} />
            </label>
            <button 
              onClick={() => handleExportRanking('weighted')}
              className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-sm text-slate-600"
            >
              <FileDown className="w-4 h-4" />
              按加权平均分导出
            </button>
            <button 
              onClick={() => handleExportRanking('gpa')}
              className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-sm text-slate-600"
            >
              <FileDown className="w-4 h-4" />
              按 GPA 导出
            </button>
          </div>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {loading.students ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
            </div>
          ) : view === 'students' ? (
            students.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-sm text-slate-400">暂无学生</p>
              </div>
            ) : (
              students.map(student => (
                <div
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl transition-all group relative cursor-pointer",
                    selectedStudentId === student.id 
                      ? "bg-blue-50 text-blue-700 border border-blue-100" 
                      : "hover:bg-slate-50 text-slate-600 border border-transparent"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-sm truncate max-w-[140px]">{student.name}</h4>
                      <p className="text-xs opacity-60 mt-1 font-mono">{student.id}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded border border-slate-200 block mb-1">
                        {student.course_count || 0} 门课
                      </span>
                      <span className="text-[10px] font-bold text-blue-600">
                        GPA: {(student.weighted_avg || 0) > 0 ? calculateGPA(student.weighted_avg!).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (student.weighted_avg || 0))}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStudent(student.id);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )
          ) : null}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {view === 'students' ? (
            <>
              {/* Header Stats */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <div className="glass-card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shrink-0">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium mb-1">加权平均分</p>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                      {selectedStudentId && studentStats
                        ? studentStats.weighted_avg.toFixed(2)
                        : '0.00'}
                    </h2>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedStudentId && studentStats ? Math.min(100, studentStats.weighted_avg) : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium mb-1">总学分</p>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">
                      {selectedStudentId && studentStats ? studentStats.total_credits.toFixed(1) : '0.0'}
                    </h2>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedStudentId && studentStats ? Math.min(100, (studentStats.total_credits / 160) * 100) : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 font-medium mb-1">班级概况</p>
                    <div className="flex items-baseline gap-2 mb-2">
                      <h2 className="text-2xl font-bold text-slate-800">
                        {classStats ? classStats.weighted_avg.toFixed(1) : '0.0'}
                      </h2>
                      <span className="text-xs text-slate-400 font-mono font-bold text-purple-600">
                        GPA: {classStats ? classStats.avg_gpa.toFixed(2) : '0.00'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${classStats ? Math.min(100, (classStats.avg_gpa / 4.0) * 100) : 0}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => { setView('courses'); loadCourses(); }}
                  className="glass-card p-6 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:rotate-45 transition-transform">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-medium mb-1">课程库管理</p>
                    <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                      批量操作 <ChevronRight className="w-4 h-4" />
                    </h2>
                  </div>
                </button>
              </div>

              {selectedStudentId ? (
                <div className="grid grid-cols-12 gap-8">
                  {/* Left Column: Editor & Table */}
                  <div className="col-span-8 space-y-8">
                    <StudentDetails 
                      studentId={selectedStudentId}
                      studentName={selectedStudentName}
                      courses={convertedStudentCourses}
                      onUpdateName={(name) => handleUpdateStudentName(selectedStudentId, name)}
                      onUpdateId={(newId) => handleUpdateStudentId(selectedStudentId, newId)}
                      onAddCourse={(name, grade) => handleAddCourseToStudent(selectedStudentId, name, grade)}
                      loading={loading.detail}
                    />
                    <GradeTable 
                      courses={convertedStudentCourses}
                      onUpdateGrade={(courseName, grade) => handleUpdateGrade(selectedStudentId, courseName, grade)}
                      onDeleteGrade={(courseName) => handleDeleteGrade(selectedStudentId, courseName)}
                      onClearAll={() => handleClearGrades(selectedStudentId)}
                      loading={loading.detail}
                    />
                  </div>

                  {/* Right Column: Charts & Summary */}
                  <div className="col-span-4 space-y-6">
                    <GPAChart 
                      studentGPA={studentStats?.avg_gpa || 0}
                      classGPA={classStats?.avg_gpa || 0}
                    />
                    <GradeDistribution grades={convertedStudentCourses} />
                    
                    <div className="glass-card p-6 bg-blue-600 text-white border-none">
                      <div className="flex items-center gap-2 mb-4">
                        <Save className="w-4 h-4" />
                        <h3 className="font-semibold">数据存储</h3>
                      </div>
                      <p className="text-xs text-blue-100 leading-relaxed mb-6">
                        所有数据已持久化存储在后端数据库中，关闭页面不会丢失。
                      </p>
                      
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-sm text-blue-100 block">及格率</span>
                            <span className="text-3xl font-bold">
                              {studentStats ? studentStats.pass_rate : 0}%
                            </span>
                          </div>
                          <div className="relative w-20 h-20 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="transparent" />
                              <motion.circle
                                cx="40" cy="40" r="34" stroke="white" strokeWidth="6" fill="transparent"
                                strokeDasharray={2 * Math.PI * 34}
                                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                                animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - (studentStats ? studentStats.pass_rate / 100 : 0)) }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <AlertCircle className="w-5 h-5 text-blue-200" />
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-white/10" />

                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <span className="text-sm text-blue-100 block">平均 GPA (4.0)</span>
                            <span className="text-3xl font-bold">
                              {studentStats ? studentStats.avg_gpa.toFixed(2) : '0.00'}
                            </span>
                          </div>
                          <div className="relative w-20 h-20 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="transparent" />
                              <motion.circle
                                cx="40" cy="40" r="34" stroke="white" strokeWidth="6" fill="transparent"
                                strokeDasharray={2 * Math.PI * 34}
                                initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                                animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - ((studentStats?.avg_gpa || 0) / 4.0)) }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <GraduationCap className="w-5 h-5 text-blue-200" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-4">
                    <Users className="w-16 h-16 text-slate-200" />
                  </div>
                  <p className="text-lg font-medium">请选择或添加一名学生</p>
                  <p className="text-sm mt-2">点击左侧列表中的学生开始管理成绩</p>
                </div>
              )}
            </>
          ) : (
            <CourseManagementPage 
              courses={courses}
              onUpdateCredit={handleUpdateCourseCredit}
                  onAddCourse={handleAddCourseGlobal}
                  onDeleteCourse={handleDeleteCourseGlobal}
                  onBack={() => setView('students')}
                  loading={loading.courses}
                  students={students}
                  onRefresh={() => { loadCourses(); loadStudentsAndStats(); }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ============ Sub-components ============

function StudentDetails({
  studentId,
  studentName,
  courses,
  onUpdateName,
  onUpdateId,
  onAddCourse,
  loading,
}: {
  studentId: string;
  studentName: string;
  courses: Course[];
  onUpdateName: (name: string) => void;
  onUpdateId: (id: string) => void;
  onAddCourse: (name: string, grade: number) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(studentName);
  const [editId, setEditId] = useState(studentId);
  const [newCourse, setNewCourse] = useState({ name: '', grade: 95 });

  useEffect(() => setName(studentName), [studentName]);
  useEffect(() => setEditId(studentId), [studentId]);

  const handleAdd = () => {
    if (!newCourse.name) return;
    onAddCourse(newCourse.name, newCourse.grade);
    setNewCourse({ name: '', grade: 95 });
  };

  if (loading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="glass-card p-8">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
        <h3 className="font-bold text-slate-800">学生信息 & 添加课程</h3>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">姓名</label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== studentName && onUpdateName(name)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">学号</label>
          <input 
            type="text" 
            value={editId}
            onChange={(e) => setEditId(e.target.value)}
            onBlur={() => editId !== studentId && onUpdateId(editId)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-mono"
          />
        </div>
      </div>

      <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex items-end gap-4">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">课程名称</label>
          <input 
            type="text" 
            placeholder="例如：高等数学"
            value={newCourse.name}
            onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-all"
          />
        </div>
        <div className="w-24 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">成绩 (0-100)</label>
          <input 
            type="number" 
            value={newCourse.grade}
            onChange={(e) => setNewCourse({ ...newCourse, grade: parseInt(e.target.value) || 0 })}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-all text-center"
          />
        </div>
        <button 
          onClick={handleAdd}
          className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          添加
        </button>
      </div>
    </div>
  );
}

function GradeTable({
  courses,
  onUpdateGrade,
  onDeleteGrade,
  onClearAll,
  loading,
}: {
  courses: Course[];
  onUpdateGrade: (courseName: string, grade: number) => void;
  onDeleteGrade: (courseName: string) => void;
  onClearAll: () => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="glass-card p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">成绩单</h3>
        <button 
          onClick={onClearAll}
          className="text-xs text-red-500 hover:underline flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          清空列表
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="px-6 py-4">课程名称</th>
              <th className="px-6 py-4 text-center">成绩</th>
              <th className="px-6 py-4 text-center">学分</th>
              <th className="px-6 py-4 text-center">绩点</th>
              <th className="px-6 py-4 text-center">加权分</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                  暂无课程数据，请手动添加或导入 Excel
                </td>
              </tr>
            ) : (
              courses.map(course => (
                <tr key={course.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-700">{course.name}</td>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="number" 
                      value={course.grade}
                      onChange={(e) => onUpdateGrade(course.name, parseInt(e.target.value) || 0)}
                      className={cn(
                        "w-16 py-1 rounded-lg text-center font-bold border border-transparent focus:border-blue-300 outline-none transition-all",
                        Number(course.grade) >= 90 ? "bg-emerald-50 text-emerald-600" :
                        Number(course.grade) >= 80 ? "bg-blue-50 text-blue-600" :
                        Number(course.grade) >= 60 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                      )}
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-slate-500">{course.credit}</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-blue-600 font-bold">
                    {calculateGPA(course.grade).toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-slate-400">
                    {(Number(course.grade) * Number(course.credit)).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onDeleteGrade(course.name)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GPAChart({ studentGPA, classGPA }: { studentGPA: number; classGPA: number }) {
  const maxGPA = 4.0;

  return (
    <div className="glass-card p-6">
      <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-blue-600" />
        GPA 仪表盘
      </h3>
      
      <div className="flex justify-center mb-8">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="64" cy="64" r="58" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
            <motion.circle
              cx="64" cy="64" r="58" stroke="#3b82f6" strokeWidth="8" fill="transparent"
              strokeDasharray={2 * Math.PI * 58}
              initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - (studentGPA / maxGPA)) }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-800">{studentGPA.toFixed(2)}</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GPA</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>班级平均</span>
            <span className="text-purple-600">{classGPA.toFixed(2)}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-purple-500"
              initial={{ width: 0 }}
              animate={{ width: `${(classGPA / maxGPA) * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              studentGPA >= classGPA ? "bg-emerald-500" : "bg-amber-500"
            )} />
            <span className="text-xs text-slate-500">
              {studentGPA >= classGPA ? "领先班级平均" : "落后班级平均"}
            </span>
          </div>
          <span className={cn(
            "text-xs font-bold",
            studentGPA >= classGPA ? "text-emerald-600" : "text-amber-600"
          )}>
            {Math.abs(studentGPA - classGPA).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function GradeDistribution({ grades }: { grades: Course[] }) {
  const data = useMemo(() => {
    const counts = {
      excellent: grades.filter(c => Number(c.grade) >= 90).length,
      good: grades.filter(c => Number(c.grade) >= 80 && Number(c.grade) < 90).length,
      fair: grades.filter(c => Number(c.grade) >= 70 && Number(c.grade) < 80).length,
      pass: grades.filter(c => Number(c.grade) >= 60 && Number(c.grade) < 70).length,
      fail: grades.filter(c => Number(c.grade) < 60).length,
    };

    return [
      { name: '优秀 (90-100)', value: counts.excellent, color: '#10b981' },
      { name: '良好 (80-89)', value: counts.good, color: '#3b82f6' },
      { name: '中等 (70-79)', value: counts.fair, color: '#f59e0b' },
      { name: '及格 (60-69)', value: counts.pass, color: '#64748b' },
      { name: '不及格 (<60)', value: counts.fail, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [grades]);

  return (
    <div className="glass-card p-6">
      <h3 className="font-bold text-slate-800 mb-6">成绩分布</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-slate-500">{item.name}</span>
            </div>
            <span className="font-bold text-slate-700">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Course Management Page ============

function CourseManagementPage({
  courses,
  onUpdateCredit,
  onAddCourse,
  onDeleteCourse,
  onBack,
  loading,
  students,
  onRefresh,
}: {
  courses: CourseRecord[];
  onUpdateCredit: (name: string, credit: number) => void;
  onAddCourse: (name: string, credit: number) => void;
  onDeleteCourse: (name: string) => void;
  onBack: () => void;
  loading: boolean;
  students: StudentRecord[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchCredit, setBatchCredit] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCredit, setNewCourseCredit] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredCourses = courses.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleBatchDelete = () => {
    if (selected.length === 0) return;
    selected.forEach(name => onDeleteCourse(name));
    setSelected([]);
  };

  const handleBatchUpdateCredit = () => {
    const val = parseFloat(batchCredit);
    if (isNaN(val) || selected.length === 0) return;
    selected.forEach(name => onUpdateCredit(name, val));
    setBatchCredit('');
    setSelected([]);
  };

  const handleAddNewCourse = () => {
    if (!newCourseName) return;
    onAddCourse(newCourseName, newCourseCredit);
    setNewCourseName('');
    setNewCourseCredit(1);
    setShowAddForm(false);
  };

  const handleKeepCommon = () => {
    if (students.length === 0) return;
    // We can't easily get course names from all students via the side panel,
    // so just refresh
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors">
            <RotateCcw className="w-5 h-5 text-slate-400 rotate-90" />
          </button>
          <h2 className="text-2xl font-bold text-slate-800">课程库管理</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 transition-all",
            selected.length > 0 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4 pointer-events-none"
          )}>
            <span className="text-xs text-slate-400 whitespace-nowrap">批量设学分:</span>
            <input 
              type="number" 
              placeholder="学分"
              value={batchCredit}
              onChange={(e) => setBatchCredit(e.target.value)}
              className="w-16 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-xs text-center outline-none focus:border-blue-400"
            />
            <button 
              onClick={handleBatchUpdateCredit}
              className="bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-100 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            手动添加课程
          </button>
          <button 
            disabled={selected.length === 0}
            onClick={handleBatchDelete}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
              selected.length > 0 ? "bg-red-500 text-white shadow-md" : "bg-slate-200 text-slate-400 cursor-not-allowed"
            )}
          >
            <Trash2 className="w-4 h-4" />
            批量删除已选 ({selected.length})
          </button>
        </div>
      </div>

      {/* Add New Course Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-6 mb-4">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">课程名称</label>
                  <input 
                    type="text" 
                    placeholder="输入课程名称"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNewCourse()}
                  />
                </div>
                <div className="w-24 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">学分</label>
                  <input 
                    type="number" 
                    value={newCourseCredit}
                    onChange={(e) => setNewCourseCredit(parseFloat(e.target.value) || 1)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-all text-center"
                  />
                </div>
                <button 
                  onClick={handleAddNewCourse}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all active:scale-95 font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  添加
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索课程名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
            <BookOpen className="w-4 h-4" />
            共 {courses.length} 门课程
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-100">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input 
                      type="checkbox" 
                      checked={selected.length === filteredCourses.length && filteredCourses.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(filteredCourses.map(c => c.name));
                        else setSelected([]);
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-4">课程名称</th>
                  <th className="px-6 py-4 text-center">选修人数</th>
                  <th className="px-6 py-4 text-center">当前学分</th>
                  <th className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      未找到匹配的课程
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map(course => {
                    const isSelected = selected.includes(course.name);
                    return (
                      <tr key={course.name} className={cn("hover:bg-slate-50/50 transition-colors", isSelected && "bg-blue-50/30")}>
                        <td className="px-6 py-4">
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelected([...selected, course.name]);
                              else setSelected(selected.filter(n => n !== course.name));
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">{course.name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold",
                            (course.student_count || 0) === students.length && students.length > 0
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500"
                          )}>
                            {course.student_count || 0} / {students.length} 人
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="number" 
                            value={course.credit}
                            onChange={(e) => onUpdateCredit(course.name, parseFloat(e.target.value) || 1)}
                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:border-blue-400 outline-none"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => onDeleteCourse(course.name)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

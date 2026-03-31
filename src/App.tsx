import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Save
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Student, Course, GlobalCourseCredit } from './types';
import { cn, calculateWeightedAverage, calculateAverageGPA, calculateClassAverage, calculateGPA, calculateClassAverageGPA } from './lib/utils';

export default function App() {
  const [view, setView] = useState<'students' | 'courses'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [globalCredits, setGlobalCredits] = useState<Record<string, number | string>>({});
  const [courseSearch, setCourseSearch] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [undoState, setUndoState] = useState<{ students: Student[], globalCredits: Record<string, number | string> } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const triggerUndoableAction = (newStudents: Student[], newCredits: Record<string, number | string>) => {
    setUndoState({ students, globalCredits });
    setStudents(newStudents);
    setGlobalCredits(newCredits);
    setShowUndo(true);
    
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      setShowUndo(false);
      setUndoState(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (undoState) {
      setStudents(undoState.students);
      setGlobalCredits(undoState.globalCredits);
      setUndoState(null);
      setShowUndo(false);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    }
  };
  
  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('grade-calculator-data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setStudents(parsed.students || []);
        setGlobalCredits(parsed.globalCredits || {});
      } catch (e) {
        console.error("Failed to load data", e);
      }
    }
  }, []);

  // Auto-save
  useEffect(() => {
    localStorage.setItem('grade-calculator-data', JSON.stringify({ students, globalCredits }));
  }, [students, globalCredits]);

  const selectedStudent = useMemo(() => 
    students.find(s => s.id === selectedStudentId) || null
  , [students, selectedStudentId]);

  const handleAddStudent = () => {
    const newId = `S${Date.now()}`;
    const newStudent: Student = {
      id: newId,
      name: '新学生',
      courses: []
    };
    setStudents(prev => [...prev, newStudent]);
    setSelectedStudentId(newId);
  };

  const handleDeleteStudent = (id: string) => {
    const newStudents = students.filter(s => s.id !== id);
    triggerUndoableAction(newStudents, globalCredits);
    if (selectedStudentId === id) setSelectedStudentId(null);
  };

  const handleUpdateStudent = (updated: Student) => {
    setStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      // Read as array of arrays to handle dynamic formats
      const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (rawData.length < 2) return;

      // Find the header row (contains "学号" and "姓名")
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rawData.length, 10); i++) {
        const row = rawData[i];
        if (row.includes('学号') && row.includes('姓名')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        console.error('未找到包含“学号”和“姓名”的表头行，请检查 Excel 格式。');
        return;
      }

      const headers = rawData[headerRowIndex];
      const idIdx = headers.indexOf('学号');
      const nameIdx = headers.indexOf('姓名');
      
      // Identify course columns (exclude metadata columns)
      const excludeHeaders = ['序号', '学号', '姓名', '平均绩点', '绩点', '排名', '备注'];
      const courseColumns = headers.map((h, idx) => ({ name: String(h), index: idx }))
        .filter(h => h.name && !excludeHeaders.includes(h.name) && h.index !== idIdx && h.index !== nameIdx);

      const newStudents = [...students];
      const newGlobalCredits = { ...globalCredits };

      const parseGrade = (val: any): number => {
        if (typeof val === 'number') return val;
        const s = String(val).trim();
        if (!s) return 0;
        const mapping: Record<string, number> = {
          '优秀': 95, '良好': 85, '中等': 75, '及格': 65, '不及格': 50,
          'A': 95, 'B': 85, 'C': 75, 'D': 65, 'F': 50
        };
        return mapping[s] || parseFloat(s) || 0;
      };

      // Process data rows
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        const id = String(row[idIdx] || '').trim();
        const name = String(row[nameIdx] || '').trim();

        if (!id || !name) continue;

        let student = newStudents.find(s => s.id === id);
        if (!student) {
          student = { id, name, courses: [] };
          newStudents.push(student);
        } else {
          student.name = name; // Update name if changed
        }

        courseColumns.forEach(col => {
          const gradeVal = row[col.index];
          if (gradeVal !== undefined && gradeVal !== null && String(gradeVal).trim() !== '') {
            const grade = parseGrade(gradeVal);
            
            // Auto-populate global credits if not exists
            if (newGlobalCredits[col.name] === undefined) {
              newGlobalCredits[col.name] = 1;
            }
            
            const credit = newGlobalCredits[col.name];

            const existingCourse = student!.courses.find(c => c.name === col.name);
            if (existingCourse) {
              existingCourse.grade = grade;
              // Only update credit if it's not already set to something non-default
              if (existingCourse.credit === 1) existingCourse.credit = credit;
            } else {
              student!.courses.push({
                id: Math.random().toString(36).substr(2, 9),
                name: col.name,
                grade,
                credit
              });
            }
          }
        });
      }

      setStudents(newStudents);
      setGlobalCredits(newGlobalCredits);
      // Clear input
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const handleExportRanking = () => {
    const classAvg = calculateClassAverage(students);
    const classAvgGPA = calculateClassAverageGPA(students);

    const rankingData = students.map(s => ({
      '学号': s.id,
      '姓名': s.name,
      '课程数': s.courses.length,
      '总学分': s.courses.reduce((sum, c) => sum + c.credit, 0),
      '加权平均分': calculateWeightedAverage(s.courses).toFixed(2),
      '平均GPA': calculateAverageGPA(s.courses).toFixed(2)
    })).sort((a, b) => parseFloat(b['加权平均分']) - parseFloat(a['加权平均分']));

    // Add summary row
    const finalData = [
      ...rankingData,
      {}, // Empty row
      {
        '学号': '班级统计',
        '姓名': '-',
        '课程数': '-',
        '总学分': '-',
        '加权平均分': classAvg.toFixed(2),
        '平均GPA': classAvgGPA.toFixed(2)
      }
    ];

    const ws = XLSX.utils.json_to_sheet(finalData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "排名表");
    XLSX.writeFile(wb, "学生成绩排名表.xlsx");
  };

  const handleReset = () => {
    setStudents([]);
    setSelectedStudentId(null);
    setGlobalCredits({});
    localStorage.removeItem('grade-calculator-data');
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
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
              <span className="text-sm font-medium">已删除数据</span>
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
        <div className="p-6 border-bottom border-slate-100">
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
              onClick={() => setView('courses')}
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
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 mb-4"
          >
            <Plus className="w-4 h-4" />
            添加学生
          </button>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors text-sm text-slate-600">
              <FileUp className="w-4 h-4" />
              导入 Excel
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
            </label>
            <button 
              onClick={handleExportRanking}
              className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors text-sm text-slate-600"
            >
              <FileDown className="w-4 h-4" />
              导出排名
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {view === 'students' ? (
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
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-sm truncate max-w-[140px]">{student.name}</h4>
                      <p className="text-xs opacity-60 mt-1 font-mono">{student.id}</p>
                    </div>
                    <span className="text-[10px] bg-white/50 px-1.5 py-0.5 rounded border border-slate-200">
                      {student.courses.length} 门课
                    </span>
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
          ) : (
            <div className="px-2 py-4 text-center">
              <p className="text-xs text-slate-400">切换至课程库管理视图</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          {view === 'students' ? (
            <>
              {/* Header Stats */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                {/* ... existing stats ... */}
                <div className="glass-card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-medium mb-1">加权平均分</p>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {selectedStudent ? calculateWeightedAverage(selectedStudent.courses).toFixed(2) : '0.00'}
                    </h2>
                  </div>
                </div>

                <div className="glass-card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-medium mb-1">总学分</p>
                    <h2 className="text-2xl font-bold text-slate-800">
                      {selectedStudent ? selectedStudent.courses.reduce((sum, c) => sum + c.credit, 0).toFixed(1) : '0.0'}
                    </h2>
                  </div>
                </div>

                <div className="glass-card p-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 font-medium mb-1">班级概况</p>
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-2xl font-bold text-slate-800">
                        {calculateClassAverage(students).toFixed(1)}
                      </h2>
                      <span className="text-xs text-slate-400 font-mono">
                        GPA: {calculateClassAverageGPA(students).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setView('courses')}
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

              {selectedStudent ? (
                <div className="grid grid-cols-12 gap-8">
                  {/* Left Column: Editor & Table */}
                  <div className="col-span-8 space-y-8">
                    <StudentDetails 
                      student={selectedStudent} 
                      onUpdate={handleUpdateStudent} 
                      globalCredits={globalCredits}
                    />
                    <GradeTable 
                      student={selectedStudent} 
                      onUpdate={handleUpdateStudent} 
                    />
                  </div>

                  {/* Right Column: Charts & Summary */}
                  <div className="col-span-4 space-y-6">
                    <GradeDistribution student={selectedStudent} />
                    
                    <div className="glass-card p-6 bg-blue-600 text-white border-none">
                      <div className="flex items-center gap-2 mb-4">
                        <Save className="w-4 h-4" />
                        <h3 className="font-semibold">自动保存</h3>
                      </div>
                      <p className="text-xs text-blue-100 leading-relaxed mb-6">
                        当前数据存储在浏览器内存中，刷新页面会丢失。请及时导出 Excel 保存。
                      </p>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-sm text-blue-100">及格率</span>
                          <span className="text-2xl font-bold">
                            {selectedStudent.courses.length > 0 
                              ? Math.round((selectedStudent.courses.filter(c => Number(c.grade) >= 60).length / selectedStudent.courses.length) * 100)
                              : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between items-end">
                          <span className="text-sm text-blue-100">平均 GPA (4.0)</span>
                          <span className="text-2xl font-bold">
                            {calculateAverageGPA(selectedStudent.courses).toFixed(2)}
                          </span>
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
              students={students}
              setStudents={setStudents}
              globalCredits={globalCredits}
              setGlobalCredits={setGlobalCredits}
              triggerUndoableAction={triggerUndoableAction}
              onBack={() => setView('students')}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function CourseManagementPage({ 
  students, 
  setStudents, 
  globalCredits, 
  setGlobalCredits,
  triggerUndoableAction,
  onBack
}: { 
  students: Student[]; 
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  globalCredits: Record<string, number | string>;
  setGlobalCredits: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  triggerUndoableAction: (newStudents: Student[], newCredits: Record<string, number | string>) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchCredit, setBatchCredit] = useState<string>('');

  const filteredCourses = useMemo(() => {
    return Object.entries(globalCredits).filter(([name]) => 
      name.toLowerCase().includes(search.toLowerCase())
    );
  }, [globalCredits, search]);

  const handleBatchDelete = () => {
    if (selected.length === 0) return;
    const newCredits = { ...globalCredits };
    selected.forEach(name => delete newCredits[name]);
    const newStudents = students.map(s => ({
      ...s,
      courses: s.courses.filter(c => !selected.includes(c.name))
    }));
    
    triggerUndoableAction(newStudents, newCredits);
    setSelected([]);
  };

  const handleBatchUpdateCredit = () => {
    const val = parseFloat(batchCredit);
    if (isNaN(val) || selected.length === 0) return;
    
    const newCredits = { ...globalCredits };
    selected.forEach(name => {
      newCredits[name] = val;
    });
    setGlobalCredits(newCredits);
    
    setStudents(prev => prev.map(s => ({
      ...s,
      courses: s.courses.map(c => selected.includes(c.name) ? { ...c, credit: val } : c)
    })));
    
    setBatchCredit('');
    setSelected([]);
  };

  const handleKeepCommon = () => {
    const courseCounts: Record<string, number> = {};
    students.forEach(s => {
      s.courses.forEach(c => {
        courseCounts[c.name] = (courseCounts[c.name] || 0) + 1;
      });
    });
    const commonCourses = Object.keys(courseCounts).filter(name => courseCounts[name] === students.length);
    setStudents(prev => prev.map(s => ({
      ...s,
      courses: s.courses.filter(c => commonCourses.includes(c.name))
    })));
    // Also update global credits to only include common ones
    const newCredits: Record<string, number | string> = {};
    commonCourses.forEach(name => {
      newCredits[name] = globalCredits[name] || 1;
    });
    setGlobalCredits(newCredits);
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
            onClick={handleKeepCommon}
            className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors border border-amber-100"
          >
            仅保留共有课程
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
            共识别 {Object.keys(globalCredits).length} 门课程
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={selected.length === filteredCourses.length && filteredCourses.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(filteredCourses.map(([name]) => name));
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
                filteredCourses.map(([name, credit]) => {
                  const count = students.filter(s => s.courses.some(c => c.name === name)).length;
                  const isSelected = selected.includes(name);
                  return (
                    <tr key={name} className={cn("hover:bg-slate-50/50 transition-colors", isSelected && "bg-blue-50/30")}>
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelected([...selected, name]);
                            else setSelected(selected.filter(n => n !== name));
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">{name}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold",
                          count === students.length ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        )}>
                          {count} / {students.length} 人
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="number" 
                          value={credit}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGlobalCredits(prev => ({ ...prev, [name]: val }));
                            setStudents(prev => prev.map(s => ({
                              ...s,
                              courses: s.courses.map(c => c.name === name ? { ...c, credit: val } : c)
                            })));
                          }}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:border-blue-400 outline-none"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            const newCredits = { ...globalCredits };
                            delete newCredits[name];
                            const newStudents = students.map(s => ({
                              ...s,
                              courses: s.courses.filter(c => c.name !== name)
                            }));
                            triggerUndoableAction(newStudents, newCredits);
                          }}
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
      </div>
    </div>
  );
}
function StudentDetails({ 
  student, 
  onUpdate, 
  globalCredits 
}: { 
  student: Student; 
  onUpdate: (s: Student) => void; 
  globalCredits: Record<string, number> 
}) {
  const [newCourse, setNewCourse] = useState({ name: '', grade: 95, credit: 1 });

  const handleAddCourse = () => {
    if (!newCourse.name) return;
    const course: Course = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCourse.name,
      grade: newCourse.grade,
      credit: globalCredits[newCourse.name] || newCourse.credit
    };
    onUpdate({
      ...student,
      courses: [...student.courses, course]
    });
    setNewCourse({ name: '', grade: 95, credit: 1 });
  };

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
            value={student.name}
            onChange={(e) => onUpdate({ ...student, name: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">学号</label>
          <input 
            type="text" 
            value={student.id}
            onChange={(e) => onUpdate({ ...student, id: e.target.value })}
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
            onChange={(e) => setNewCourse({ ...newCourse, grade: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-all text-center"
          />
        </div>
        <div className="w-20 space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase">学分</label>
          <input 
            type="number" 
            value={globalCredits[newCourse.name] !== undefined ? globalCredits[newCourse.name] : newCourse.credit}
            onChange={(e) => setNewCourse({ ...newCourse, credit: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 transition-all text-center"
          />
        </div>
        <button 
          onClick={handleAddCourse}
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
  student, 
  onUpdate 
}: { 
  student: Student; 
  onUpdate: (s: Student) => void 
}) {
  const handleDeleteCourse = (courseId: string) => {
    onUpdate({
      ...student,
      courses: student.courses.filter(c => c.id !== courseId)
    });
  };

  const handleUpdateCourse = (courseId: string, field: keyof Course, value: any) => {
    onUpdate({
      ...student,
      courses: student.courses.map(c => c.id === courseId ? { ...c, [field]: value } : c)
    });
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">成绩单</h3>
        <button 
          onClick={() => onUpdate({ ...student, courses: [] })}
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
            {student.courses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                  暂无课程数据，请手动添加或导入 Excel
                </td>
              </tr>
            ) : (
              student.courses.map(course => (
                <tr key={course.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 font-medium text-slate-700">{course.name}</td>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="number" 
                      value={course.grade}
                      onChange={(e) => handleUpdateCourse(course.id, 'grade', e.target.value)}
                      className={cn(
                        "w-16 py-1 rounded-lg text-center font-bold border border-transparent focus:border-blue-300 outline-none transition-all",
                        Number(course.grade) >= 90 ? "bg-emerald-50 text-emerald-600" :
                        Number(course.grade) >= 80 ? "bg-blue-50 text-blue-600" :
                        Number(course.grade) >= 60 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                      )}
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="number" 
                      value={course.credit}
                      onChange={(e) => handleUpdateCourse(course.id, 'credit', e.target.value)}
                      className="w-12 py-1 bg-transparent text-center text-slate-500 border border-transparent focus:border-slate-200 rounded-lg outline-none"
                    />
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-blue-600 font-bold">
                    {calculateGPA(course.grade).toFixed(1)}
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-slate-400">
                    {(Number(course.grade) * Number(course.credit)).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteCourse(course.id)}
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

function GradeDistribution({ student }: { student: Student }) {
  const data = useMemo(() => {
    const counts = {
      excellent: student.courses.filter(c => Number(c.grade) >= 90).length,
      good: student.courses.filter(c => Number(c.grade) >= 80 && Number(c.grade) < 90).length,
      fair: student.courses.filter(c => Number(c.grade) >= 70 && Number(c.grade) < 80).length,
      pass: student.courses.filter(c => Number(c.grade) >= 60 && Number(c.grade) < 70).length,
      fail: student.courses.filter(c => Number(c.grade) < 60).length,
    };

    return [
      { name: '优秀 (90-100)', value: counts.excellent, color: '#10b981' },
      { name: '良好 (80-89)', value: counts.good, color: '#3b82f6' },
      { name: '中等 (70-79)', value: counts.fair, color: '#f59e0b' },
      { name: '及格 (60-69)', value: counts.pass, color: '#64748b' },
      { name: '不及格 (<60)', value: counts.fail, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [student.courses]);

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

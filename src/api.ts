const API_BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '网络请求失败' }));
    throw new Error(err.error || `请求失败 (${res.status})`);
  }

  return res.json();
}

// ============ Students ============

export interface StudentRecord {
  id: string;
  name: string;
  course_count?: number;
  weighted_avg?: number;
  created_at?: string;
}

export async function fetchStudents(): Promise<StudentRecord[]> {
  return request('/students');
}

export async function fetchStudentDetail(id: string): Promise<{
  id: string;
  name: string;
  grades: { id: string; grade: number; course_name: string; credit: number }[];
}> {
  return request(`/students/${id}`);
}

export async function createStudent(id: string, name: string): Promise<StudentRecord> {
  return request('/students', {
    method: 'POST',
    body: JSON.stringify({ id, name }),
  });
}

export async function updateStudent(id: string, name: string): Promise<StudentRecord> {
  return request(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export async function deleteStudent(id: string): Promise<void> {
  await request(`/students/${id}`, { method: 'DELETE' });
}

// ============ Courses ============

export interface CourseRecord {
  name: string;
  credit: number;
  student_count?: number;
}

export async function fetchCourses(): Promise<CourseRecord[]> {
  return request('/courses');
}

export async function upsertCourse(name: string, credit: number): Promise<CourseRecord> {
  return request('/courses', {
    method: 'POST',
    body: JSON.stringify({ name, credit }),
  });
}

export async function updateCourseCredit(name: string, credit: number): Promise<CourseRecord> {
  return request(`/courses/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify({ credit }),
  });
}

export async function deleteCourse(name: string): Promise<void> {
  await request(`/courses/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

// ============ Grades ============

export async function upsertGrade(studentId: string, courseName: string, grade: number): Promise<any> {
  return request(`/grades/${studentId}`, {
    method: 'POST',
    body: JSON.stringify({ course_name: courseName, grade }),
  });
}

export async function deleteGrade(studentId: string, courseName: string): Promise<void> {
  await request(`/grades/${studentId}/${encodeURIComponent(courseName)}`, { method: 'DELETE' });
}

export async function clearStudentGrades(studentId: string): Promise<void> {
  await request(`/grades/${studentId}`, { method: 'DELETE' });
}

// ============ Stats ============

export interface StudentStats {
  student_id: string;
  student_name: string;
  course_count: number;
  total_credits: number;
  weighted_avg: number;
  avg_gpa: number;
  pass_rate: number;
}

export interface ClassStats {
  total_students: number;
  weighted_avg: number;
  avg_gpa: number;
  pass_rate: number;
  students: StudentStats[];
}

export async function fetchClassStats(): Promise<ClassStats> {
  return request('/stats/class');
}

export interface StudentFullStats {
  id: string;
  name: string;
  course_count: number;
  total_credits: number;
  weighted_avg: number;
  avg_gpa: number;
  pass_rate: number;
  distribution: {
    excellent: number;
    good: number;
    fair: number;
    pass: number;
    fail: number;
  };
  grades: { id: string; grade: number; course_name: string; credit: number }[];
}

export async function fetchStudentStats(id: string): Promise<StudentFullStats> {
  return request(`/stats/student/${id}`);
}

export interface RankingEntry {
  student_id: string;
  student_name: string;
  course_count: number;
  total_credits: number;
  weighted_avg: number;
  avg_gpa: number;
}

export async function fetchRanking(): Promise<RankingEntry[]> {
  return request('/stats/export-ranking');
}

export async function importStudents(students: { id: string; name: string; grades: { course_name: string; grade: number }[] }[]): Promise<any> {
  return request('/students/import', {
    method: 'POST',
    body: JSON.stringify({ students }),
  });
}

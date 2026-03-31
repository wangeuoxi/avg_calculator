export interface Course {
  id: string;
  name: string;
  grade: number | string;
  credit: number | string;
}

export interface Student {
  id: string; // Student ID (学号)
  name: string;
  courses: Course[];
}

export interface GlobalCourseCredit {
  name: string;
  credit: number | string;
}

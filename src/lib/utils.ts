import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateWeightedAverage(courses: { grade: number | string; credit: number | string }[]) {
  const totalCredits = courses.reduce((sum, c) => sum + (Number(c.credit) || 0), 0);
  if (totalCredits === 0) return 0;
  const weightedSum = courses.reduce((sum, c) => sum + (Number(c.grade) || 0) * (Number(c.credit) || 0), 0);
  return weightedSum / totalCredits;
}

export function calculateGPA(grade: number | string) {
  const g = Number(grade) || 0;
  // Standard 4.0 scale conversion
  if (g >= 90) return 4.0;
  if (g >= 85) return 3.7;
  if (g >= 82) return 3.3;
  if (g >= 78) return 3.0;
  if (g >= 75) return 2.7;
  if (g >= 72) return 2.3;
  if (g >= 68) return 2.0;
  if (g >= 64) return 1.5;
  if (g >= 60) return 1.0;
  return 0;
}

export function calculateAverageGPA(courses: { grade: number | string; credit: number | string }[]) {
  const totalCredits = courses.reduce((sum, c) => sum + (Number(c.credit) || 0), 0);
  if (totalCredits === 0) return 0;
  const weightedGPASum = courses.reduce((sum, c) => sum + calculateGPA(c.grade) * (Number(c.credit) || 0), 0);
  return weightedGPASum / totalCredits;
}

export function calculateClassAverage(students: { courses: { grade: number | string; credit: number | string }[] }[]) {
  if (students.length === 0) return 0;
  const averages = students.map(s => calculateWeightedAverage(s.courses));
  const validAverages = averages.filter(avg => avg > 0);
  if (validAverages.length === 0) return 0;
  return validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length;
}

export function calculateClassAverageGPA(students: { courses: { grade: number | string; credit: number | string }[] }[]) {
  if (students.length === 0) return 0;
  const gpas = students.map(s => calculateAverageGPA(s.courses));
  const validGPAs = gpas.filter(gpa => gpa > 0);
  if (validGPAs.length === 0) return 0;
  return validGPAs.reduce((sum, gpa) => sum + gpa, 0) / validGPAs.length;
}

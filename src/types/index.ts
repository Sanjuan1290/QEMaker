// ── Auth ──────────────────────────────────────────────────
export interface Admin {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// ── Class ─────────────────────────────────────────────────
export interface Class {
  id: string;
  name: string;
  code: string;
  admin_id: string;
  created_at: string;
}

// ── Quiz ──────────────────────────────────────────────────
export interface QuizOption {
  label: string;   // 'a' | 'b' | 'c' | 'd'
  text: string;
}

export interface Question {
  number: number;
  question: string;
  options: QuizOption[];
  correctAnswer?: string;
}

export interface Quiz {
  id: string;
  title: string;
  class_id: string;
  class_code: string;
  admin_id: string;
  questions: Question[];
  raw_input?: string;
  is_active: boolean;
  max_attempts: number;   // ← NEW: 1 = no retakes, 2+ = allowed retakes
  created_at: string;
}

// ── Submission ────────────────────────────────────────────
export interface AnswerRecord {
  questionNumber: number;
  question: string;
  chosen: string;
  chosenText: string;
  correct: string;
  correctText: string;
  isCorrect: boolean;
}

export interface Submission {
  id: string;
  quiz_id: string;
  class_id: string;
  class_code: string;
  email: string;
  full_name: string;
  section: string;
  year_course: string;
  answers: AnswerRecord[];
  score: number;
  total: number;
  percentage: number;
  submitted_at: string;
}

export interface Student {
  email: string;
  full_name: string;
  section: string;
  year_course: string;
  submissionsCount: number;
}

// ── Toast ─────────────────────────────────────────────────
export type ToastType = 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ClassStudent {
  email: string;
  full_name: string;
  section: string;
  year_course: string;
  submissionsCount: number;
  lastSubmittedAt: string;
  avgPercentage: number;
  quizzesTaken: string[];
}
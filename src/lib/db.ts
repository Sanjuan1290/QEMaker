import { supabase } from './supabase';
import { Class, Quiz, Question, Submission, Student } from '../types';
import { generateUniqueCode } from '../utils/generateCode';
import { parseQuiz } from '../utils/parseQuiz';

// ── Helper: get current user id ───────────────────────────
async function getAdminId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// ═══════════════════════════════════════════════════════════
//  CLASSES
// ═══════════════════════════════════════════════════════════

export async function fetchClasses(): Promise<Class[]> {
  const adminId = await getAdminId();
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Class[];
}

export async function createClass(name: string): Promise<Class> {
  const adminId = await getAdminId();
  const code    = await generateUniqueCode();
  const { data, error } = await supabase
    .from('classes')
    .insert({ name: name.trim(), code, admin_id: adminId })
    .select()
    .single();
  if (error) throw error;
  return data as Class;
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
//  QUIZZES  (admin)
// ═══════════════════════════════════════════════════════════

export async function fetchQuizzes(): Promise<Quiz[]> {
  const adminId = await getAdminId();
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, class_id, class_code, admin_id, questions, is_active, created_at')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Quiz[];
}

export async function createQuiz(
  title: string,
  classId: string,
  classCode: string,
  rawInput: string,
): Promise<Quiz> {
  const adminId  = await getAdminId();
  const questions: Question[] = parseQuiz(rawInput);
  if (questions.length === 0) throw new Error('No valid questions found. Check your formatting.');

  const { data, error } = await supabase
    .from('quizzes')
    .insert({
      title:      title.trim(),
      class_id:   classId,
      class_code: classCode,
      admin_id:   adminId,
      questions,
      raw_input:  rawInput,
      is_active:  true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Quiz;
}

export async function fetchQuizById(id: string): Promise<Quiz> {
  const adminId = await getAdminId();
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', id)
    .eq('admin_id', adminId)
    .single();
  if (error) throw error;
  return data as Quiz;
}

export async function toggleQuiz(id: string, current: boolean): Promise<Quiz> {
  const { data, error } = await supabase
    .from('quizzes')
    .update({ is_active: !current })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Quiz;
}

export async function deleteQuiz(id: string): Promise<void> {
  // Cascade delete on submissions is handled by DB foreign key
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) throw error;
}

// ═══════════════════════════════════════════════════════════
//  QUIZ  (student / public)
// ═══════════════════════════════════════════════════════════

/**
 * Fetches a quiz for a student — strips correctAnswer from all questions
 * so answers are never exposed to the client during the exam.
 */
export async function fetchQuizForStudent(id: string): Promise<{ quiz: Quiz; className: string }> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, class_id, class_code, is_active, questions, created_at')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new Error('Quiz not found or not active.');

  // Strip correct answers before returning to student
  const safeQuestions = (data.questions as Question[]).map(q => ({
    ...q,
    correctAnswer: undefined,
  }));

  // Fetch class name
  const { data: cls } = await supabase
    .from('classes')
    .select('name')
    .eq('id', data.class_id)
    .single();

  return {
    quiz: { ...data, questions: safeQuestions, admin_id: '', raw_input: '' } as Quiz,
    className: cls?.name || '',
  };
}

// ═══════════════════════════════════════════════════════════
//  SUBMISSIONS
// ═══════════════════════════════════════════════════════════

export async function fetchSubmissions(quizId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('quiz_id', quizId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data as Submission[];
}

export async function submitQuiz(payload: {
  quizId: string;
  email: string;
  fullName: string;
  section: string;
  yearCourse: string;
  answers: Record<number, string>;
}): Promise<Submission> {
  const { quizId, email, fullName, section, yearCourse, answers } = payload;

  // Fetch the full quiz (with correct answers) for grading
  const { data: quizData, error: quizErr } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .eq('is_active', true)
    .single();

  if (quizErr || !quizData) throw new Error('Quiz not found or inactive.');

  const quiz = quizData as Quiz;
  let score = 0;

  const gradedAnswers = quiz.questions.map(q => {
    const chosen    = answers[q.number] || null;
    const isCorrect = chosen !== null && chosen === q.correctAnswer;
    if (isCorrect) score++;

    const chosenOption  = q.options.find(o => o.label === chosen);
    const correctOption = q.options.find(o => o.label === q.correctAnswer);

    return {
      questionNumber: q.number,
      question:       q.question,
      chosen:         chosen || '',
      chosenText:     chosenOption?.text  || '',
      correct:        q.correctAnswer     || '',
      correctText:    correctOption?.text || '',
      isCorrect,
    };
  });

  const total      = quiz.questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      quiz_id:     quizId,
      class_id:    quiz.class_id,
      class_code:  quiz.class_code,
      email:       email.toLowerCase().trim(),
      full_name:   fullName.trim(),
      section:     section.trim(),
      year_course: yearCourse.trim(),
      answers:     gradedAnswers,
      score,
      total,
      percentage,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Submission;
}

// ═══════════════════════════════════════════════════════════
//  STUDENTS  (admin view)
// ═══════════════════════════════════════════════════════════

export async function fetchStudents(): Promise<Student[]> {
  const adminId = await getAdminId();

  // Get all quiz IDs for this admin
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id')
    .eq('admin_id', adminId);

  if (!quizzes || quizzes.length === 0) return [];
  const quizIds = quizzes.map((q: any) => q.id);

  // Get all submissions for those quizzes
  const { data: subs, error } = await supabase
    .from('submissions')
    .select('email, full_name, section, year_course')
    .in('quiz_id', quizIds)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  if (!subs) return [];

  // De-duplicate by email, count submissions
  const map = new Map<string, Student>();
  for (const s of subs as any[]) {
    if (!map.has(s.email)) {
      map.set(s.email, {
        email:            s.email,
        full_name:        s.full_name,
        section:          s.section,
        year_course:      s.year_course,
        submissionsCount: 0,
      });
    }
    map.get(s.email)!.submissionsCount++;
  }

  return Array.from(map.values());
}

// ═══════════════════════════════════════════════════════════
//  QUIZ EDITING
// ═══════════════════════════════════════════════════════════

/** Update the correct answer for a single question in a quiz */
export async function updateQuizCorrectAnswer(
  quizId: string,
  questionNumber: number,
  newCorrectAnswer: string
): Promise<Quiz> {
  const adminId = await getAdminId();
  const { data: existing, error: fetchErr } = await supabase
    .from('quizzes').select('*').eq('id', quizId).eq('admin_id', adminId).single();
  if (fetchErr || !existing) throw new Error('Quiz not found');

  const questions = (existing.questions as Question[]).map(q =>
    q.number === questionNumber ? { ...q, correctAnswer: newCorrectAnswer } : q
  );

  const { data, error } = await supabase
    .from('quizzes').update({ questions }).eq('id', quizId).select().single();
  if (error) throw error;
  return data as Quiz;
}

/** Update quiz title */
export async function updateQuizTitle(quizId: string, title: string): Promise<Quiz> {
  const { data, error } = await supabase
    .from('quizzes').update({ title: title.trim() }).eq('id', quizId).select().single();
  if (error) throw error;
  return data as Quiz;
}

// ═══════════════════════════════════════════════════════════
//  STUDENTS PER CLASS
// ═══════════════════════════════════════════════════════════

export interface ClassStudent extends Student {
  lastSubmittedAt: string;
  avgPercentage: number;
  quizzesTaken: string[]; // quiz titles
}

/** Fetch students who submitted quizzes in a specific class */
export async function fetchStudentsByClass(classId: string): Promise<ClassStudent[]> {
  const adminId = await getAdminId();

  // Get quiz IDs for this class (belonging to this admin)
  const { data: quizzes } = await supabase
    .from('quizzes').select('id, title').eq('class_id', classId).eq('admin_id', adminId);
  if (!quizzes || quizzes.length === 0) return [];

  const quizIds = quizzes.map((q: any) => q.id);
  const quizTitleMap = Object.fromEntries(quizzes.map((q: any) => [q.id, q.title]));

  const { data: subs, error } = await supabase
    .from('submissions')
    .select('email, full_name, section, year_course, percentage, submitted_at, quiz_id')
    .in('quiz_id', quizIds)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  if (!subs) return [];

  const map = new Map<string, ClassStudent>();
  for (const s of subs as any[]) {
    if (!map.has(s.email)) {
      map.set(s.email, {
        email: s.email, full_name: s.full_name,
        section: s.section, year_course: s.year_course,
        submissionsCount: 0, lastSubmittedAt: s.submitted_at,
        avgPercentage: 0, quizzesTaken: [],
      });
    }
    const st = map.get(s.email)!;
    st.submissionsCount++;
    st.avgPercentage = Math.round(
      (st.avgPercentage * (st.submissionsCount - 1) + s.percentage) / st.submissionsCount
    );
    if (!st.quizzesTaken.includes(quizTitleMap[s.quiz_id])) {
      st.quizzesTaken.push(quizTitleMap[s.quiz_id]);
    }
  }
  return Array.from(map.values());
}

/** Fetch all submissions across a class for score leaderboard */
export async function fetchClassSubmissions(classId: string): Promise<(Submission & { quizTitle: string })[]> {
  const adminId = await getAdminId();
  const { data: quizzes } = await supabase
    .from('quizzes').select('id, title').eq('class_id', classId).eq('admin_id', adminId);
  if (!quizzes || quizzes.length === 0) return [];

  const quizIds = quizzes.map((q: any) => q.id);
  const quizTitleMap = Object.fromEntries(quizzes.map((q: any) => [q.id, q.title]));

  const { data: subs, error } = await supabase
    .from('submissions').select('*').in('quiz_id', quizIds)
    .order('submitted_at', { ascending: false });
  if (error) throw error;

  return (subs as Submission[]).map(s => ({ ...s, quizTitle: quizTitleMap[s.quiz_id] || '' }));
}

/** Fetch quizzes for a specific class */
export async function fetchQuizzesByClass(classId: string): Promise<Quiz[]> {
  const adminId = await getAdminId();
  const { data, error } = await supabase
    .from('quizzes')
    .select('id, title, class_id, class_code, admin_id, questions, is_active, created_at')
    .eq('class_id', classId).eq('admin_id', adminId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Quiz[];
}

/**
 * Check if student already submitted this quiz (prevents retakes)
 */
export async function checkStudentSubmission(
  quizId: string, 
  email: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('quiz_id', quizId)
    .eq('email', email.toLowerCase().trim())
    .limit(1);

  if (error) throw error;
  return !!data?.length;
}

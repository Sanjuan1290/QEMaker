import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchQuizForStudent, submitQuiz, countStudentSubmissions, fetchStudentPastSubmission } from '../../lib/db';
import { Quiz, Submission } from '../../types';

type Phase = 'loading' | 'info' | 'quiz' | 'submitting' | 'error';
interface StudentInfo { email: string; fullName: string; section: string; yearCourse: string; }

/** Format seconds as mm:ss */
function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function TakeQuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [className, setClassName] = useState('');
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [info, setInfo] = useState<StudentInfo>({ email: '', fullName: '', section: '', yearCourse: '' });
  const [infoErrors, setInfoErrors] = useState<Partial<Record<keyof StudentInfo | 'emailTaken', string>>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  // attempt tracking
  const [attemptCount, setAttemptCount] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(1);
  // timer (seconds remaining, null = no limit)
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [timerWarning, setTimerWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const STORAGE_KEYS = {
    studentInfo: `quiz-info-${id}`,
    answers: `quiz-answers-${id}`,
    currentQuestion: `quiz-current-q-${id}`,
    timerStart: `quiz-timer-start-${id}`,
  };

  // ── Save progress ────────────────────────────────────────
  const saveProgress = useCallback(() => {
    if (!id || phase !== 'quiz') return;
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(answers));
    localStorage.setItem(STORAGE_KEYS.currentQuestion, currentQ.toString());
  }, [id, phase, answers, currentQ]);

  // ── Init quiz ────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!id) return;
      try {
        setPhase('loading');
        const { quiz: q, className: cn } = await fetchQuizForStudent(id);
        setQuiz(q);
        setClassName(cn);
        setMaxAttempts((q as any).max_attempts ?? 1);

        // Restore saved info (so they don't retype on retake)
        const savedInfo = localStorage.getItem(STORAGE_KEYS.studentInfo);
        if (savedInfo) {
          try { setInfo(JSON.parse(savedInfo)); } catch {}
        }

        // Restore answers
        const savedAnswers = localStorage.getItem(STORAGE_KEYS.answers);
        if (savedAnswers) {
          try { setAnswers(JSON.parse(savedAnswers)); } catch {}
        }
        const savedQ = localStorage.getItem(STORAGE_KEYS.currentQuestion);
        if (savedQ) setCurrentQ(parseInt(savedQ) || 0);

        setPhase('info');
      } catch (err: any) {
        setErrorMsg(err.message || 'Quiz not available.');
        setPhase('error');
      }
    };
    init();
  }, [id]);

  // ── Auto-save ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'quiz') return;
    const t = setTimeout(saveProgress, 500);
    return () => clearTimeout(t);
  }, [answers, currentQ, saveProgress]);

  // ── Timer ────────────────────────────────────────────────
  const startTimer = useCallback((totalSeconds: number) => {
    // Check if timer was already started (resuming mid-quiz)
    const storedStart = localStorage.getItem(STORAGE_KEYS.timerStart);
    let remaining = totalSeconds;
    if (storedStart) {
      const elapsed = Math.floor((Date.now() - parseInt(storedStart)) / 1000);
      remaining = Math.max(0, totalSeconds - elapsed);
    } else {
      localStorage.setItem(STORAGE_KEYS.timerStart, Date.now().toString());
    }
    setTimeLeft(remaining);
    if (remaining <= 0) {
      handleAutoSubmit();
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        if (prev <= 300) setTimerWarning(true); // last 5 min
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Validate info form ───────────────────────────────────
  const validateInfo = () => {
    const e: Partial<Record<keyof StudentInfo, string>> = {};
    if (!info.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) e.email = 'Invalid email format';
    if (!info.fullName.trim()) e.fullName = 'Required';
    if (!info.section.trim()) e.section = 'Required';
    if (!info.yearCourse.trim()) e.yearCourse = 'Required';
    setInfoErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit info form ─────────────────────────────────────
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInfo() || !id || !quiz) return;

    setCheckingEmail(true);
    try {
      const count = await countStudentSubmissions(id, info.email);
      const limit = (quiz as any).max_attempts ?? 1;
      setAttemptCount(count);

      if (count >= limit) {
        // Max attempts reached — show popup-style inline error
        setInfoErrors(prev => ({
          ...prev,
          email: `⚠️ You already took this quiz ${count} time${count > 1 ? 's' : ''} and have reached the maximum of ${limit} attempt${limit > 1 ? 's' : ''}. No more retakes allowed.`
        }));
        setCheckingEmail(false);
        return;
      }
    } catch {
      // If check fails, allow proceeding (graceful degradation)
    }
    setCheckingEmail(false);

    localStorage.setItem(STORAGE_KEYS.studentInfo, JSON.stringify(info));

    // Start timer if quiz has a time limit
    const timeLimitMinutes = (quiz as any).time_limit_minutes;
    if (timeLimitMinutes && timeLimitMinutes > 0) {
      startTimer(timeLimitMinutes * 60);
    }

    setPhase('quiz');
  };

  // ── Auto submit when timer runs out ─────────────────────
  const handleAutoSubmit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    handleSubmit(true);
  }, []);

  // ── Leave / cancel ───────────────────────────────────────
  const handleLeave = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem(STORAGE_KEYS.answers);
    localStorage.removeItem(STORAGE_KEYS.currentQuestion);
    localStorage.removeItem(STORAGE_KEYS.timerStart);
    // Keep studentInfo so they don't retype on retake
    setShowLeaveConfirm(false);
    window.history.back();
  };

  // ── Submit quiz ──────────────────────────────────────────
  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!quiz || !id) return;
    if (!autoSubmit) {
      const unanswered = quiz.questions.filter(q => !answers[q.number]).length;
      if (unanswered > 0 && !window.confirm(
        `${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
      )) return;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('submitting');
    setSubmitError('');
    try {
      const submission = await submitQuiz({
        quizId: id,
        email: info.email,
        fullName: info.fullName,
        section: info.section,
        yearCourse: info.yearCourse,
        answers,
      });

      // Clear quiz-specific progress
      localStorage.removeItem(STORAGE_KEYS.answers);
      localStorage.removeItem(STORAGE_KEYS.currentQuestion);
      localStorage.removeItem(STORAGE_KEYS.timerStart);

      const thisAttempt = attemptCount + 1;
      const limit = (quiz as any).max_attempts ?? 1;

      navigate(`/quiz/${id}/result`, {
        state: {
          submission,
          quizTitle: quiz.title,
          className,
          maxAttempts: limit,
          attemptNumber: thisAttempt,
          quizId: id,
        }
      });
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed.');
      setPhase('quiz');
    }
  }, [quiz, id, answers, info, navigate, className, attemptCount]);

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  if (phase === 'loading' || phase === 'submitting') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">
            {phase === 'loading' ? 'Loading quiz...' : 'Submitting your answers...'}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-sm w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-5 text-2xl">🚫</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Quiz Unavailable</h2>
          <p className="text-gray-500 text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  // ── INFO FORM ────────────────────────────────────────────
  if (phase === 'info') {
    const timeLimitMinutes = (quiz as any).time_limit_minutes;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Header */}
          <div className="text-center mb-7">
            {className && (
              <div className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold uppercase tracking-widest rounded-full mb-3">
                {className}
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <div className="flex items-center justify-center gap-3 mt-2 text-sm text-gray-500">
              <span>{quiz.questions.length} questions</span>
              {timeLimitMinutes > 0 && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {timeLimitMinutes} min time limit
                  </span>
                </>
              )}
              {maxAttempts > 1 && (
                <>
                  <span>·</span>
                  <span className="text-purple-600 font-medium">{maxAttempts} attempts allowed</span>
                </>
              )}
            </div>
          </div>

          <form onSubmit={handleInfoSubmit} noValidate className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
              <input
                type="email"
                autoComplete="email"
                className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${infoErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
                placeholder="sample@pcu.edu.ph"
                value={info.email}
                onChange={e => { setInfo(p => ({ ...p, email: e.target.value })); setInfoErrors(p => ({ ...p, email: '' })); }}
              />
              {infoErrors.email && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <p className="text-xs text-red-700 font-medium leading-relaxed">{infoErrors.email}</p>
                </div>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
              <input
                type="text"
                className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${infoErrors.fullName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
                placeholder="Last Name, First Name M.I."
                value={info.fullName}
                onChange={e => { setInfo(p => ({ ...p, fullName: e.target.value })); setInfoErrors(p => ({ ...p, fullName: '' })); }}
              />
              {infoErrors.fullName && <p className="mt-1 text-xs text-red-600">{infoErrors.fullName}</p>}
            </div>

            {/* Section + Course */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Section *</label>
                <input
                  type="text"
                  className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${infoErrors.section ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
                  placeholder="e.g. 2-A"
                  value={info.section}
                  onChange={e => { setInfo(p => ({ ...p, section: e.target.value })); setInfoErrors(p => ({ ...p, section: '' })); }}
                />
                {infoErrors.section && <p className="mt-1 text-xs text-red-600">{infoErrors.section}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Course *</label>
                <input
                  type="text"
                  className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm ${infoErrors.yearCourse ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50 focus:bg-white'}`}
                  placeholder="e.g. BSREM"
                  value={info.yearCourse}
                  onChange={e => { setInfo(p => ({ ...p, yearCourse: e.target.value })); setInfoErrors(p => ({ ...p, yearCourse: '' })); }}
                />
                {infoErrors.yearCourse && <p className="mt-1 text-xs text-red-600">{infoErrors.yearCourse}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={checkingEmail}
              className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {checkingEmail ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  {timeLimitMinutes > 0 ? `Start Exam (${timeLimitMinutes} min)` : 'Begin Exam'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {timeLimitMinutes > 0 && (
            <p className="mt-4 text-center text-xs text-amber-600 font-medium">
              ⏱ Timer starts when you click "Begin Exam"
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── QUIZ INTERFACE ───────────────────────────────────────
  const q = quiz.questions[currentQ];
  const answered = Object.keys(answers).length;
  const progress = (answered / quiz.questions.length) * 100;
  const timeLimitMinutes = (quiz as any).time_limit_minutes;
  const totalSeconds = timeLimitMinutes * 60;
  const timerPercent = timeLeft !== null && totalSeconds > 0 ? (timeLeft / totalSeconds) * 100 : 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Leave Confirmation */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-7">
            <div className="text-3xl mb-3">🚪</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Leave Quiz?</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Your current answers will be <strong>cleared</strong>. You can come back and retake using the same link
              {maxAttempts > 1 ? ` (you have ${maxAttempts - attemptCount} attempt${maxAttempts - attemptCount > 1 ? 's' : ''} remaining)` : ''}.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
                Keep Going
              </button>
              <button onClick={handleLeave} className="flex-1 py-2.5 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors">
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-base font-semibold text-gray-900 truncate">{quiz.title}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span>{info.fullName || 'Student'}</span>
                <span>·</span>
                <span className="text-green-600 font-medium">{answered}/{quiz.questions.length} answered</span>
                {attemptCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-purple-600">Attempt {attemptCount + 1}/{maxAttempts}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Timer */}
              {timeLeft !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  timerWarning ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-700'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatTime(timeLeft)}
                </div>
              )}

              {/* Leave button */}
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Leave
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Timer bar (shows if timer active) */}
        {timeLeft !== null && (
          <div className="h-0.5 bg-gray-100">
            <div
              className={`h-full transition-all duration-1000 ${timerWarning ? 'bg-red-500' : 'bg-amber-400'}`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Question Card */}
      <div className="max-w-2xl mx-auto px-6 py-10 pb-24">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-5 pb-5 border-b border-gray-100">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
            Question {q.number} of {quiz.questions.length}
            <span className="mx-1">·</span>
            Autosave <span className="text-green-600 font-semibold">ON</span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-7 leading-relaxed">{q.question}</h2>

          <div className="space-y-3">
            {q.options.map(opt => {
              const selected = answers[q.number] === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.number]: opt.label }))}
                  className={`w-full flex items-center gap-4 p-4 border-2 rounded-xl transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    ${selected
                      ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                    }`}
                >
                  <div className={`w-9 h-9 rounded-lg font-bold text-sm flex items-center justify-center shrink-0 transition-colors ${
                    selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {opt.label.toUpperCase()}
                  </div>
                  <span className="font-medium text-gray-800 leading-snug">{opt.text}</span>
                  {selected && (
                    <svg className="ml-auto w-5 h-5 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation — numbering on RIGHT */}
        <div className="mt-6 flex items-center gap-3">
          {/* Previous */}
          <button
            onClick={() => setCurrentQ(p => Math.max(0, p - 1))}
            disabled={currentQ === 0}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            ← Prev
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Question bubbles on the RIGHT */}
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {quiz.questions.map((_, i) => {
              const isCurrent = i === currentQ;
              const isAnswered = !!answers[quiz.questions[i].number];
              return (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  title={`Q${i + 1}${isAnswered ? ' ✓' : ''}`}
                  className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md scale-110'
                      : isAnswered
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-white text-gray-500 border border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Next / Submit */}
          {currentQ < quiz.questions.length - 1 ? (
            <button
              onClick={() => setCurrentQ(p => Math.min(quiz.questions.length - 1, p + 1))}
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-sm"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={answered === 0}
              className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
            >
              {answered === quiz.questions.length ? '✓ Submit' : `Submit (${answered}/${quiz.questions.length})`}
            </button>
          )}
        </div>

        {submitError && (
          <div className="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
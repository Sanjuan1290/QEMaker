import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchQuizForStudent, submitQuiz, checkStudentSubmission } from '../../lib/db';
import { Quiz } from '../../types';

type Phase = 'loading' | 'info' | 'quiz' | 'submitting' | 'error' | 'already-submitted';
interface StudentInfo { email: string; fullName: string; section: string; yearCourse: string; }

export default function TakeQuizPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [className, setClassName] = useState('');
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [info, setInfo] = useState<StudentInfo>({ email: '', fullName: '', section: '', yearCourse: '' });
  const [infoErrors, setInfoErrors] = useState<Partial<StudentInfo>>({});
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [submitError, setSubmitError] = useState('');

  // PERSISTENT STORAGE KEYS
  const STORAGE_KEYS = {
    studentInfo: `quiz-info-${id}`,
    answers: `quiz-answers-${id}`,
    currentQuestion: `quiz-current-q-${id}`,
    submitted: `quiz-submitted-${id}`
  };

  // SAVE TO LOCALSTORAGE (throttled)
  const saveProgress = useCallback(() => {
    if (!id || phase !== 'quiz') return;
    
    localStorage.setItem(STORAGE_KEYS.answers, JSON.stringify(answers));
    localStorage.setItem(STORAGE_KEYS.currentQuestion, currentQ.toString());
  }, [id, phase, answers, currentQ]);

  // LOAD FROM LOCALSTORAGE
  const loadProgress = useCallback(() => {
    if (!id) return;
    
    try {
      // Load student info
      const savedInfo = localStorage.getItem(STORAGE_KEYS.studentInfo);
      if (savedInfo) {
        setInfo(JSON.parse(savedInfo));
      }
      
      // Load quiz progress (only if NOT submitted)
      const submitted = localStorage.getItem(STORAGE_KEYS.submitted);
      if (!submitted) {
        const savedAnswers = localStorage.getItem(STORAGE_KEYS.answers);
        const savedCurrentQ = localStorage.getItem(STORAGE_KEYS.currentQuestion);
        
        if (savedAnswers) {
          setAnswers(JSON.parse(savedAnswers));
        }
        if (savedCurrentQ) {
          setCurrentQ(parseInt(savedCurrentQ));
        }
      }
    } catch (e) {
      console.warn('Failed to load saved progress:', e);
    }
  }, [id]);

  // CHECK SUBMISSION STATUS ON LOAD
  useEffect(() => {
    const initQuiz = async () => {
      if (!id) return;
      
      try {
        setPhase('loading');
        
        // Check if already submitted (server-side FIRST)
        const savedInfo = localStorage.getItem(STORAGE_KEYS.studentInfo);
        if (savedInfo) {
          const studentInfo = JSON.parse(savedInfo) as StudentInfo;
          const hasSubmitted = await checkStudentSubmission(id, studentInfo.email);
          
          if (hasSubmitted) {
            setErrorMsg('❌ You have already completed this quiz. No retakes allowed.');
            setPhase('already-submitted');
            
            // Clear local progress since submitted
            localStorage.removeItem(STORAGE_KEYS.answers);
            localStorage.removeItem(STORAGE_KEYS.currentQuestion);
            return;
          }
        }
        
        // Load quiz
        const { quiz: q, className: cn } = await fetchQuizForStudent(id);
        setQuiz(q);
        setClassName(cn);
        
        // Load any saved progress
        loadProgress();
        
        setPhase(savedInfo ? 'quiz' : 'info');
      } catch (error: any) {
        setErrorMsg(error.message || 'Quiz not available.');
        setPhase('error');
      }
    };

    initQuiz();
  }, [id]);

  // AUTO-SAVE ON ANSWERS/QUESTION CHANGE (throttled)
  useEffect(() => {
    if (phase !== 'quiz') return;
    
    const timeoutId = setTimeout(saveProgress, 500);
    return () => clearTimeout(timeoutId);
  }, [answers, currentQ, saveProgress]);

  // CLEANUP ON UNMOUNT
  useEffect(() => {
    return () => {
      if (phase === 'quiz') {
        saveProgress();
      }
    };
  }, []);

  const validateInfo = () => {
    const e: Partial<StudentInfo> = {};
    if (!info.email.trim()) e.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) e.email = 'Invalid email';
    if (!info.fullName.trim()) e.fullName = 'Required';
    if (!info.section.trim()) e.section = 'Required';
    if (!info.yearCourse.trim()) e.yearCourse = 'Required';
    setInfoErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInfo() || !id) return;
    
    // Save student info
    localStorage.setItem(STORAGE_KEYS.studentInfo, JSON.stringify(info));
    setPhase('quiz');
  };

  const handleSubmit = useCallback(async () => {
    if (!quiz || !id) return;
    
    const unanswered = quiz.questions.filter(q => !answers[q.number]).length;
    if (unanswered > 0 && !window.confirm(
      `${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?\n\nYour progress is saved!`
    )) return;
    
    setPhase('submitting');
    setSubmitError('');
    
    try {
      const submission = await submitQuiz({
        quizId: id,
        email: info.email,
        fullName: info.fullName,
        section: info.section,
        yearCourse: info.yearCourse,
        answers
      });
      
      // Mark as COMPLETED - clear quiz progress
      localStorage.setItem(STORAGE_KEYS.submitted, JSON.stringify({ 
        email: info.email, 
        timestamp: Date.now() 
      }));
      
      // Clear temporary progress
      localStorage.removeItem(STORAGE_KEYS.answers);
      localStorage.removeItem(STORAGE_KEYS.currentQuestion);
      
      navigate(`/quiz/${id}/result`, { 
        state: { submission, quizTitle: quiz.title, className } 
      });
    } catch (e: any) {
      setSubmitError(e.message || 'Submission failed.');
      setPhase('quiz');
    }
  }, [quiz, id, answers, info, navigate, className]);

  // Loading screen
  if (phase === 'loading' || phase === 'submitting') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">
            {phase === 'loading' ? 'Loading quiz...' : 'Submitting...'}
          </p>
          {phase === 'loading' && (
            <p className="text-xs text-gray-500 mt-2">Restoring your progress...</p>
          )}
        </div>
      </div>
    );
  }

  // Error screens
  if (phase === 'error' || phase === 'already-submitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-sm w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
            phase === 'already-submitted' ? 'bg-red-100' : 'bg-gray-100'
          }`}>
            <svg className={`w-8 h-8 ${phase === 'already-submitted' ? 'text-red-500' : 'text-gray-500'}`} 
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d={phase === 'already-submitted' 
                  ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                  : 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                } />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {phase === 'already-submitted' ? 'Quiz Already Taken' : 'Quiz Unavailable'}
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  // Student info form (only shows if no saved info)
  if (phase === 'info') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            {className && (
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                {className}
              </div>
            )}
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-1 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Information</h3>
            <p className="text-sm text-gray-600">
              Enter your details to begin. <strong>Your progress auto-saves!</strong>
            </p>
          </div>

          <form onSubmit={handleInfoSubmit} noValidate className="space-y-6">
            {/* Same form fields as before */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
              <input type="email" className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${infoErrors.email ? 'border-red-300 bg-red-50 focus:ring-red-500' : 'border-gray-200'}`} placeholder="student@example.com" value={info.email} onChange={e => { setInfo(p => ({ ...p, email: e.target.value })); setInfoErrors(p => ({ ...p, email: '' })); }} />
              {infoErrors.email && <p className="mt-1 text-xs text-red-600">{infoErrors.email}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input type="text" className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${infoErrors.fullName ? 'border-red-300 bg-red-50 focus:ring-red-500' : 'border-gray-200'}`} placeholder="Last Name, First Name Middle Initial" value={info.fullName} onChange={e => { setInfo(p => ({ ...p, fullName: e.target.value })); setInfoErrors(p => ({ ...p, fullName: '' })); }} />
              {infoErrors.fullName && <p className="mt-1 text-xs text-red-600">{infoErrors.fullName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Section *</label>
                <input type="text" className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${infoErrors.section ? 'border-red-300 bg-red-50 focus:ring-red-500' : 'border-gray-200'}`} placeholder="ex. 2-A" value={info.section} onChange={e => { setInfo(p => ({ ...p, section: e.target.value })); setInfoErrors(p => ({ ...p, section: '' })); }} />
                {infoErrors.section && <p className="mt-1 text-xs text-red-600">{infoErrors.section}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course *</label>
                <input type="text" className={`w-full px-4 py-3 border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${infoErrors.yearCourse ? 'border-red-300 bg-red-50 focus:ring-red-500' : 'border-gray-200'}`} placeholder="ex. BSREM" value={info.yearCourse} onChange={e => { setInfo(p => ({ ...p, yearCourse: e.target.value })); setInfoErrors(p => ({ ...p, yearCourse: '' })); }} />
                {infoErrors.yearCourse && <p className="mt-1 text-xs text-red-600">{infoErrors.yearCourse}</p>}
              </div>
            </div>
            <button type="submit" className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
              Begin Exam (Progress Auto-Saves)
            </button>
          </form>
        </div>
      </div>
    );
  }

  // QUIZ INTERFACE (main quiz taking screen)
  const q = quiz.questions[currentQ];
  const answered = Object.keys(answers).length;
  const progress = (answered / quiz.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PROGRESS BAR */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-gray-900 truncate">{quiz.title}</div>
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <span>{info.fullName || 'Student'}</span>
                <span>•</span>
                <span>Q {currentQ + 1} / {quiz.questions.length}</span>
                <span>•</span>
                <span className="font-medium text-green-600">{answered}/{quiz.questions.length} answered</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{Math.round(progress)}%</div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">progress saved</div>
            </div>
          </div>
        </div>
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* QUESTION */}
      <div className="max-w-2xl mx-auto px-6 py-12 pb-24">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            Question {q.number} of {quiz.questions.length} • Autosave: <span className="text-green-600 font-medium">ON</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-8 leading-relaxed">{q.question}</h2>

          <div className="space-y-3">
            {q.options.map(opt => {
              const selected = answers[q.number] === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.number]: opt.label }))}
                  className={`
                    w-full flex items-start gap-4 p-5 border-2 rounded-lg transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    ${selected 
                      ? 'border-blue-500 bg-blue-50 text-gray-900 shadow-sm ring-2 ring-blue-200' 
                      : 'border-gray-200 hover:border-gray-300 text-gray-900'
                    }
                  `}
                >
                  <div className={`w-10 h-10 rounded-lg font-semibold text-sm flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                    {opt.label}
                  </div>
                  <span className="text-left font-medium leading-relaxed">{opt.text}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* NAVIGATION */}
        <div className="mt-8 flex items-center justify-between">
          <button 
            className="px-6 py-3 text-gray-700 font-medium rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setCurrentQ(p => Math.max(0, p - 1))} 
            disabled={currentQ === 0}
          >
            Previous
          </button>

          {/* QUESTION NAV */}
          <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg">
            {quiz.questions.map((_, i) => {
              const isCurrent = i === currentQ;
              const isAnswered = !!answers[quiz.questions[i].number];
              return (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  className={`
                    w-10 h-10 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${isCurrent 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : isAnswered 
                        ? 'bg-green-100 text-green-800 border-2 border-green-300 hover:bg-green-200' 
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }
                  `}
                  title={`Question ${i + 1}${isAnswered ? ' (answered)' : ''}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {currentQ < quiz.questions.length - 1 ? (
            <button 
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              onClick={() => setCurrentQ(p => Math.min(quiz.questions.length - 1, p + 1))}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              disabled={answered === 0}
            >
              {answered === quiz.questions.length 
                ? 'Submit Quiz (Final)' 
                : `${answered}/${quiz.questions.length} answered - Submit`
              }
            </button>
          )}
        </div>

        {submitError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{submitError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

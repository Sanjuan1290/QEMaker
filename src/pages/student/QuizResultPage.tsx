import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Submission } from '../../types';

interface LocationState {
  submission: Submission;
  quizTitle: string;
  className?: string;
  maxAttempts?: number;      // total allowed attempts
  attemptNumber?: number;    // which attempt this was (1-based)
  quizId?: string;
}

export default function QuizResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  if (!state?.submission) return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-10 text-center shadow-lg">
        <div className="mb-4 text-5xl opacity-40">📋</div>
        <h2 className="mb-2 font-serif text-2xl text-[#fdf8f0]">No result found</h2>
        <p className="text-sm text-[#b3b3b3]">Please complete a quiz first.</p>
      </div>
    </div>
  );

  const { submission: s, quizTitle, className, maxAttempts = 1, attemptNumber = 1, quizId } = state;
  const passed = s.percentage >= 75;
  const attemptsLeft = maxAttempts - attemptNumber;
  const canRetake = attemptsLeft > 0 && quizId;

  const handleRetake = () => {
    if (!quizId) return;
    // Clear saved progress so the form shows again fresh (but keep info)
    localStorage.removeItem(`quiz-answers-${quizId}`);
    localStorage.removeItem(`quiz-current-q-${quizId}`);
    localStorage.removeItem(`quiz-submitted-${quizId}`);
    // Note: We keep studentInfo so they don't retype their name etc.
    navigate(`/quiz/${quizId}`);
  };

  return (
    <div className="min-h-screen pb-20 bg-[#0a0908] text-[#fdf8f0]">
      {/* Hero */}
      <div className={`relative overflow-hidden border-b border-white/[0.06] px-6 pb-20 pt-14 text-center
                       ${passed ? 'bg-[#10b981]/10' : 'bg-[#f43f5e]/10'}`}>
        <div className={`pointer-events-none absolute left-1/2 top-[-30%] h-[80%] w-[60%] -translate-x-1/2 rounded-full
                         ${passed ? 'bg-[radial-gradient(circle,rgba(16,185,129,0.12)_0%,transparent_70%)]'
                                  : 'bg-[radial-gradient(circle,rgba(244,63,94,0.1)_0%,transparent_70%)]'}`} />

        <div className="relative animate-fade-up">
          {className && (
            <div className={`mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.15em] ${passed ? 'text-[#10b981]/60' : 'text-[#f43f5e]/60'}`}>
              {className}
            </div>
          )}
          <h1 className="mb-1 font-serif text-2xl">{quizTitle}</h1>
          <p className="mb-10 text-sm text-[#b3b3b3]">Submitted {new Date(s.submitted_at).toLocaleString()}</p>

          <div className={`mx-auto flex h-36 w-36 flex-col items-center justify-center rounded-full border-[5px] backdrop-blur-md
                           ${passed ? 'border-[#10b981]/40 bg-[#10b981]/8 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                                    : 'border-[#f43f5e]/40 bg-[#f43f5e]/8 shadow-[0_0_20px_rgba(244,63,94,0.4)]'}`}>
            <span className="font-serif text-[2.5rem] leading-none">{s.percentage}%</span>
            <span className="mt-1 text-sm text-[#b3b3b3]">{s.score}/{s.total}</span>
          </div>

          <div className={`mt-6 font-serif text-xl ${passed ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
            {passed ? '🎉 Congratulations — Passed!' : '📚 Keep studying — Almost there!'}
          </div>

          {/* Attempt info */}
          {maxAttempts > 1 && (
            <div className="mt-3 text-sm text-[#b3b3b3]">
              Attempt {attemptNumber} of {maxAttempts}
              {canRetake && (
                <span className="ml-2 text-[#f59e0b]">· {attemptsLeft} retake{attemptsLeft > 1 ? 's' : ''} remaining</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="relative mx-auto -mt-8 max-w-[700px] px-6">
        {/* Student info card */}
        <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6 shadow-lg animate-fade-up mb-4">
          <div className="flex flex-wrap justify-between gap-5">
            <div>
              <h3 className="mb-1 font-serif text-xl">{s.full_name}</h3>
              <div className="flex flex-col gap-0.5 text-sm text-[#b3b3b3]">
                <span className="font-mono text-xs">{s.email}</span>
                <span>{s.section} · {s.year_course}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: s.score, label: 'Correct', color: 'text-[#10b981]' },
                { v: s.total - s.score, label: 'Wrong', color: 'text-[#f43f5e]' },
                { v: s.total, label: 'Total', color: 'text-[#fdf8f0]' },
              ].map(st => (
                <div key={st.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-center">
                  <div className={`font-serif text-3xl leading-none ${st.color}`}>{st.v}</div>
                  <div className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wider text-[#b3b3b3]">{st.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: retake or completed */}
        <div className="mt-6 p-6 bg-[#1a1a1a]/50 border border-white/10 rounded-xl text-center">
          {canRetake ? (
            <>
              <div className="text-lg font-serif font-bold text-[#f59e0b] mb-2">🔄 Retake Available</div>
              <p className="text-xs text-[#7c7c7c] leading-relaxed max-w-md mx-auto mb-5">
                You have <strong className="text-[#fdf8f0]">{attemptsLeft} retake{attemptsLeft > 1 ? 's' : ''} remaining</strong> for this quiz.
                Your best score will be recorded.
              </p>
              <button
                onClick={handleRetake}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-[#0a0908] font-bold rounded-xl shadow-lg hover:shadow-[0_4px_20px_rgba(245,158,11,0.35)] transition-all duration-200 hover:-translate-y-0.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Retake Quiz ({attemptsLeft} left)
              </button>
            </>
          ) : (
            <>
              <div className="text-lg font-serif font-bold text-[#10b981] mb-2">✅ Quiz Completed Successfully</div>
              <p className="text-xs text-[#7c7c7c] leading-relaxed max-w-md mx-auto">
                Your results have been permanently recorded in the system.
                {maxAttempts > 1
                  ? <strong className="block text-[#fdf8f0] font-semibold mt-1">You have used all {maxAttempts} attempts.</strong>
                  : <strong className="block text-[#fdf8f0] font-semibold mt-1">No retakes are allowed.</strong>
                }
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
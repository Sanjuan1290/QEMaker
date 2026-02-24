import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminNav from '../../components/AdminNav';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import {
  fetchQuizById, toggleQuiz, deleteQuiz, fetchSubmissions,
  updateQuizCorrectAnswer, updateQuizTitle, updateQuizMaxAttempts, updateQuizTimeLimit
} from '../../lib/db';
import { Quiz, Submission } from '../../types';

type Tab = 'questions' | 'submissions' | 'settings';

function exportToExcel(subs: Submission[], quizTitle: string) {
  const passed = subs.filter(s => s.percentage >= 75).length;
  const avg = subs.length ? Math.round(subs.reduce((a, s) => a + s.percentage, 0) / subs.length) : 0;

  const summary = [
    `"Quiz: ${quizTitle}"`,
    `"Exported: ${new Date().toLocaleString()}"`,
    `"Submissions: ${subs.length}  |  Passed: ${passed}  |  Failed: ${subs.length - passed}  |  Average: ${avg}%"`,
    '',
  ];

  const headers = ['No.', 'Full Name', 'Email', 'Section', 'Year/Course', 'Score', 'Total', 'Percentage (%)', 'Result', 'Date Submitted'];
  const rows = subs.map((s, i) => [
    i + 1,
    s.full_name,
    s.email,
    s.section,
    s.year_course,
    s.score,
    s.total,
    s.percentage,
    s.percentage >= 75 ? 'PASSED' : 'FAILED',
    new Date(s.submitted_at).toLocaleString(),
  ]);

  const csv = [...summary, headers, ...rows]
    .map(row => Array.isArray(row)
      ? row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
      : row
    ).join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quizTitle.replace(/[^a-z0-9]/gi, '_')}_grades_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function QuizDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [tab, setTab] = useState<Tab>('questions');
  const [search, setSearch] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editingQ, setEditingQ] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ msg: string; detail?: string; onConfirm: () => void } | null>(null);

  // Settings states
  const [maxAttemptsDraft, setMaxAttemptsDraft] = useState(1);
  const [timeLimitDraft, setTimeLimitDraft] = useState(0); // minutes
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const [q, subs] = await Promise.all([fetchQuizById(id!), fetchSubmissions(id!)]);
      setQuiz(q);
      setSubmissions(subs);
      setMaxAttemptsDraft((q as any).max_attempts ?? 1);
      setTimeLimitDraft((q as any).time_limit_minutes ?? 0);
    } catch { navigate('/admin'); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/quiz/${id}`);
    showToast('Link copied!');
  };

  const handleToggle = async () => {
    if (!quiz) return;
    try {
      const u = await toggleQuiz(quiz.id, quiz.is_active);
      setQuiz(u);
      showToast(u.is_active ? 'Quiz enabled' : 'Quiz disabled');
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  };

  const handleDelete = () => setConfirm({
    msg: `Delete "${quiz?.title}"?`,
    detail: 'This permanently deletes the quiz and all submissions.',
    onConfirm: async () => {
      setConfirm(null);
      try {
        await deleteQuiz(quiz!.id);
        showToast('Deleted');
        navigate(`/admin/class/${quiz!.class_id}`);
      } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    },
  });

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || !quiz) return;
    try {
      const u = await updateQuizTitle(quiz.id, titleDraft);
      setQuiz(u);
      setEditingTitle(false);
      showToast('Title updated!');
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  };

  const handleSetCorrect = async (qNum: number, answer: string) => {
    if (!quiz) return;
    try {
      const u = await updateQuizCorrectAnswer(quiz.id, qNum, answer);
      setQuiz(u);
      setEditingQ(null);
      showToast('Correct answer updated!');
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  };

  const handleSaveSettings = async () => {
    if (!quiz) return;
    setSavingSettings(true);
    try {
      let u = await updateQuizMaxAttempts(quiz.id, maxAttemptsDraft);
      u = await updateQuizTimeLimit(quiz.id, timeLimitDraft);
      setQuiz(u);
      showToast('Settings saved!');
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setSavingSettings(false); }
  };

  const filteredSubs = submissions.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
  );

  if (!quiz) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full border-4 border-[#fdf8f0]/15 border-t-[#f59e0b] h-10 w-10" />
    </div>
  );

  const passed = submissions.filter(s => s.percentage >= 75).length;
  const failed = submissions.filter(s => s.percentage < 75).length;
  const avgScore = submissions.length ? Math.round(submissions.reduce((a, s) => a + s.percentage, 0) / submissions.length) : 0;
  const maxAttempts = (quiz as any).max_attempts ?? 1;
  const timeLimitMinutes = (quiz as any).time_limit_minutes ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0908] text-[#fdf8f0]">
      <AdminNav />
      {confirm && <ConfirmDialog message={confirm.msg} detail={confirm.detail} confirmLabel="Delete" danger onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <div className="mx-auto max-w-[1100px] px-6 pb-24 pt-8">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-[#b3b3b3]">
          <button onClick={() => navigate('/admin')} className="hover:text-[#fdf8f0] transition">Dashboard</button>
          <span>/</span>
          <button onClick={() => navigate(`/admin/class/${quiz.class_id}`)} className="hover:text-[#fdf8f0] transition">Class</button>
          <span>/</span>
          <span className="truncate max-w-[200px]">{quiz.title}</span>
        </nav>

        {/* Header Card */}
        <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6 shadow-lg animate-fade-up mb-6">
          <div className="flex flex-wrap justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#fdf8f0]/10 text-[#fdf8f0] text-xs font-mono">{quiz.class_code}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${quiz.is_active ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#f43f5e]/10 text-[#f43f5e]'}`}>
                  {quiz.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b] text-xs font-semibold">
                  {maxAttempts === 1 ? 'No retakes' : `${maxAttempts} attempts`}
                </span>
                {timeLimitMinutes > 0 && (
                  <span className="px-2 py-0.5 rounded bg-purple-400/10 text-purple-300 text-xs font-semibold flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {timeLimitMinutes} min
                  </span>
                )}
              </div>

              {/* Editable title */}
              {editingTitle ? (
                <div className="flex items-center gap-2 mb-2">
                  <input className="px-2 py-1 rounded border border-white/10 bg-[#1a1a1a]/50 text-[#fdf8f0] max-w-md text-lg"
                    value={titleDraft} onChange={e => setTitleDraft(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setEditingTitle(false); }} />
                  <button className="px-3 py-1.5 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 rounded text-sm" onClick={handleSaveTitle}>Save</button>
                  <button className="px-3 py-1.5 border rounded border-white/10 text-sm" onClick={() => setEditingTitle(false)}>Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h1 className="font-serif text-3xl">{quiz.title}</h1>
                  <button className="px-2 py-1 text-xs border rounded border-white/10 hover:border-[#f59e0b]/30 hover:text-[#f59e0b]"
                    onClick={() => { setTitleDraft(quiz.title); setEditingTitle(true); }}>✎ Edit</button>
                </div>
              )}
              <p className="text-sm text-[#b3b3b3]">{quiz.questions.length} questions · Created {new Date(quiz.created_at).toLocaleDateString()}</p>
            </div>

            <div className="flex gap-2 flex-wrap shrink-0">
              <button className="px-3 py-1.5 border border-white/10 rounded hover:bg-white/5 text-sm" onClick={copyLink}>📋 Copy Link</button>
              <button className={`px-3 py-1.5 rounded font-semibold text-sm ${quiz.is_active ? 'bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20' : 'bg-[#10b981]/10 hover:bg-[#10b981]/20'}`} onClick={handleToggle}>
                {quiz.is_active ? 'Disable' : 'Enable'}
              </button>
              <button className="px-3 py-1.5 bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20 rounded font-semibold text-sm" onClick={handleDelete}>Delete</button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-4 border-t border-white/10 pt-5 text-center">
            {[
              { v: submissions.length, label: 'Submissions', color: 'text-[#fdf8f0]' },
              { v: `${avgScore}%`, label: 'Avg Score', color: avgScore >= 75 ? 'text-[#10b981]' : 'text-[#f43f5e]' },
              { v: passed, label: 'Passed ≥75%', color: 'text-[#10b981]' },
              { v: failed, label: 'Failed <75%', color: 'text-[#f43f5e]' },
            ].map(s => (
              <div key={s.label}>
                <div className={`font-serif text-3xl ${s.color}`}>{s.v}</div>
                <div className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wider text-[#b3b3b3]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
          {(['questions', 'submissions', 'settings'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition capitalize ${tab === t ? 'bg-[#f59e0b]/20 text-[#fdf8f0]' : 'text-[#b3b3b3] hover:bg-white/5'}`}
            >
              {t === 'questions' ? `Questions (${quiz.questions.length})` : t === 'submissions' ? `Submissions (${submissions.length})` : '⚙ Settings'}
            </button>
          ))}
        </div>

        {/* ── QUESTIONS TAB ── */}
        {tab === 'questions' && (
          <div className="flex flex-col gap-3 animate-fade-up">
            {quiz.questions.map(q => (
              <div key={q.number} className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between mb-3 items-start gap-3">
                  <div className="flex gap-2 text-sm font-medium text-[#b3b3b3] flex-1">
                    <span className="font-mono text-xs text-[#f59e0b] mt-0.5 shrink-0">{q.number}.</span>
                    <span>{q.question}</span>
                  </div>
                  {editingQ !== q.number && (
                    <button className="px-2 py-1 text-xs border rounded border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10 shrink-0" onClick={() => setEditingQ(q.number)}>
                      ✎ Change Answer
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {q.options.map(opt => {
                    const isCorrect = opt.label === q.correctAnswer;
                    const isEditing = editingQ === q.number;
                    return (
                      <div
                        key={opt.label}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${isCorrect ? 'border-[#10b981]/25 bg-[#10b981]/7' : 'border-white/[0.07] bg-white/[0.03]'} ${isEditing && !isCorrect ? 'cursor-pointer hover:border-[#f59e0b]/30 hover:bg-[#f59e0b]/5' : ''}`}
                        onClick={() => isEditing && handleSetCorrect(q.number, opt.label)}
                      >
                        <span className={`w-4 font-mono text-[0.6875rem] font-bold ${isCorrect ? 'text-[#10b981]' : 'text-[#b3b3b3]'}`}>{opt.label}.</span>
                        <span className={`flex-1 text-sm ${isCorrect ? 'text-[#10b981]' : 'text-[#b3b3b3]'}`}>{opt.text}</span>
                        {isCorrect && <span className="px-2 py-0.5 text-[0.625rem] font-bold uppercase bg-[#10b981]/12 rounded-full text-[#10b981]">✓ Correct</span>}
                        {isEditing && !isCorrect && <span className="text-[0.6875rem] text-[#f59e0b] opacity-60">Click to mark</span>}
                      </div>
                    );
                  })}
                </div>
                {editingQ === q.number && (
                  <div className="flex justify-end mt-3">
                    <button className="px-3 py-1.5 border rounded border-white/10 text-sm" onClick={() => setEditingQ(null)}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── SUBMISSIONS TAB ── */}
        {tab === 'submissions' && (
          <div className="animate-fade-up">
            {selectedSub ? (
              <div>
                <button onClick={() => setSelectedSub(null)} className="mb-5 text-sm text-[#b3b3b3] hover:text-[#fdf8f0] flex items-center gap-1">
                  ← Back to submissions
                </button>
                <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6 shadow-lg mb-5 flex flex-wrap items-center gap-6">
                  <div className={`flex flex-col items-center justify-center w-28 h-28 border-4 rounded-full ${selectedSub.percentage >= 75 ? 'border-[#10b981]' : 'border-[#f43f5e]'}`}>
                    <span className="text-3xl font-serif">{selectedSub.percentage}%</span>
                    <span className="text-xs text-[#b3b3b3] mt-1">{selectedSub.score}/{selectedSub.total}</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-serif mb-1">{selectedSub.full_name}</h2>
                    <div className="text-sm text-[#b3b3b3] space-y-0.5">
                      <div className="font-mono text-xs">{selectedSub.email}</div>
                      <div>{selectedSub.section} · {selectedSub.year_course}</div>
                      <div className="text-xs">Submitted {new Date(selectedSub.submitted_at).toLocaleString()}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6">
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#b3b3b3]">
                    Answer Review · {selectedSub.score} correct, {selectedSub.total - selectedSub.score} wrong
                  </h4>
                  {selectedSub.answers.map(ans => (
                    <div key={ans.questionNumber} className={`flex flex-col gap-1 mb-3 p-3 rounded-xl border ${ans.isCorrect ? 'border-[#10b981]/25 bg-[#10b981]/7' : 'border-[#f43f5e]/25 bg-[#f43f5e]/7'}`}>
                      <div className="flex justify-between items-start gap-3 mb-1">
                        <div className="flex flex-1 gap-2 text-sm font-medium text-[#fdf8f0]">
                          <span className="font-mono text-xs text-[#f59e0b] mt-0.5">{ans.questionNumber}.</span>
                          {ans.question}
                        </div>
                        <span className="shrink-0 font-bold">{ans.isCorrect ? '✓' : '✕'}</span>
                      </div>
                      <div className="pl-4 text-xs space-y-0.5">
                        <div>
                          <span className="text-[#b3b3b3]">Answer: </span>
                          <strong className={ans.isCorrect ? 'text-[#10b981]' : 'text-[#f43f5e]'}>
                            {ans.chosen?.toUpperCase() || '—'}. {ans.chosenText || 'No answer'}
                          </strong>
                        </div>
                        {!ans.isCorrect && (
                          <div>
                            <span className="text-[#b3b3b3]">Correct: </span>
                            <strong className="text-[#10b981]">{ans.correct?.toUpperCase()}. {ans.correctText}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : submissions.length === 0
              ? <EmptyState icon="📬" title="No submissions yet" description="Share the quiz link with students." action={<button className="px-3 py-1.5 border rounded border-white/10 hover:bg-white/5" onClick={copyLink}>Copy Quiz Link</button>} />
              : (
                <div>
                  <div className="mb-4 flex flex-wrap gap-3 items-center">
                    <input type="text"
                      className="px-3 py-2 rounded-lg border border-white/10 max-w-xs bg-[#1a1a1a]/50 text-[#fdf8f0] text-sm flex-1"
                      placeholder="Search name or email…"
                      value={search} onChange={e => setSearch(e.target.value)}
                    />
                    <button
                      onClick={() => exportToExcel(filteredSubs, quiz.title)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#10b981]/10 hover:bg-[#10b981]/20 border border-[#10b981]/30 text-[#10b981] rounded-lg text-sm font-semibold transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export Grades (.csv)
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1a1a1a]/50">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-left text-xs text-[#b3b3b3] uppercase">
                          {['Name', 'Email', 'Section', 'Year/Course', 'Score', '%', 'Result', 'Submitted', ''].map(h => (
                            <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubs.map(s => (
                          <tr key={s.id} className="border-b border-white/[0.06] hover:bg-white/5 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-[#fdf8f0]">{s.full_name}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-[#b3b3b3]">{s.email}</td>
                            <td className="px-3 py-2.5 text-xs text-[#b3b3b3]">{s.section}</td>
                            <td className="px-3 py-2.5 text-xs text-[#b3b3b3]">{s.year_course}</td>
                            <td className="px-3 py-2.5 font-mono text-sm">{s.score}/{s.total}</td>
                            <td className="px-3 py-2.5">
                              <span className={`font-bold text-lg ${s.percentage >= 75 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>{s.percentage}%</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.percentage >= 75 ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#f43f5e]/10 text-[#f43f5e]'}`}>
                                {s.percentage >= 75 ? 'Passed' : 'Failed'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-[#b3b3b3]">{new Date(s.submitted_at).toLocaleDateString()}</td>
                            <td className="px-3 py-2.5">
                              <button className="px-3 py-1 border border-white/10 rounded-lg hover:bg-white/5 text-xs transition" onClick={() => setSelectedSub(s)}>Review</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {tab === 'settings' && (
          <div className="animate-fade-up max-w-xl">
            <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6 shadow-lg space-y-6">
              <h3 className="font-serif text-lg text-[#fdf8f0]">Quiz Settings</h3>

              {/* Max Attempts */}
              <div>
                <label className="block text-sm font-semibold text-[#d1d1d1] mb-1">
                  Maximum Attempts per Student
                </label>
                <p className="text-xs text-[#b3b3b3] mb-3">
                  How many times a student can take this quiz. Set to 1 for no retakes.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxAttemptsDraft}
                    onChange={e => setMaxAttemptsDraft(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-2 rounded-lg border border-white/10 bg-[#0f0f0f]/50 text-[#fdf8f0] text-center text-lg font-bold"
                  />
                  <div className="text-sm text-[#b3b3b3]">
                    {maxAttemptsDraft === 1 ? 'No retakes allowed' : `Students can retake ${maxAttemptsDraft - 1} time${maxAttemptsDraft > 2 ? 's' : ''} after their first attempt`}
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10" />

              {/* Time Limit */}
              <div>
                <label className="block text-sm font-semibold text-[#d1d1d1] mb-1">
                  Time Limit (minutes)
                </label>
                <p className="text-xs text-[#b3b3b3] mb-3">
                  Set 0 for no time limit. Timer starts when student clicks "Begin Exam".
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={300}
                    step={5}
                    value={timeLimitDraft}
                    onChange={e => setTimeLimitDraft(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 px-3 py-2 rounded-lg border border-white/10 bg-[#0f0f0f]/50 text-[#fdf8f0] text-center text-lg font-bold"
                  />
                  <div className="text-sm text-[#b3b3b3]">
                    {timeLimitDraft === 0
                      ? 'No time limit'
                      : timeLimitDraft >= 60
                        ? `${Math.floor(timeLimitDraft / 60)}h ${timeLimitDraft % 60 > 0 ? `${timeLimitDraft % 60}m` : ''}`
                        : `${timeLimitDraft} minutes`
                    }
                  </div>
                </div>
                {/* Quick presets */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {[0, 15, 30, 45, 60, 90, 120].map(min => (
                    <button
                      key={min}
                      onClick={() => setTimeLimitDraft(min)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition ${timeLimitDraft === min ? 'bg-[#f59e0b]/20 text-[#f59e0b] border border-[#f59e0b]/30' : 'border border-white/10 text-[#b3b3b3] hover:bg-white/5'}`}
                    >
                      {min === 0 ? 'No limit' : min >= 60 ? `${min / 60}h` : `${min}m`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10" />

              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="w-full py-3 bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-[#0a0908] font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSettings ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#0a0908]/30 border-t-[#0a0908] rounded-full animate-spin" />
                    Saving...
                  </>
                ) : '✓ Save Settings'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
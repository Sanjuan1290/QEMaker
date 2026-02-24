import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminNav from '../../components/AdminNav';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { fetchClasses, fetchQuizzesByClass, toggleQuiz, deleteQuiz, fetchStudentsByClass, fetchClassSubmissions } from '../../lib/db';
import { Class, Quiz, ClassStudent } from '../../types';

type Tab = 'quizzes' | 'students' | 'scores';

function exportToExcel(subs: any[], quizzes: any[], className: string) {
  const headers = ['Name', 'Email', 'Section', 'Year/Course', 'Quiz', 'Score', 'Total', 'Percentage (%)', 'Result', 'Date Submitted'];
  const rows = subs.map(s => [
    s.full_name,
    s.email,
    s.section,
    s.year_course,
    quizzes.find((q: any) => q.id === s.quiz_id)?.title || 'Deleted',
    s.score,
    s.total,
    s.percentage,
    s.percentage >= 75 ? 'Passed' : 'Failed',
    new Date(s.submitted_at).toLocaleString(),
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${className.replace(/[^a-z0-9]/gi, '_')}_scores.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // States
  const [cls, setCls] = useState<Class | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [allSubs, setAllSubs] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('quizzes');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [quizFilter, setQuizFilter] = useState('all');
  const [confirm, setConfirm] = useState<{ msg: string; detail?: string; onConfirm: () => void } | null>(null);

  // Load class, quizzes, students, and submissions
  const load = useCallback(async () => {
    try {
      const classes = await fetchClasses();
      const found = classes.find(c => c.id === classId);
      if (!found) { navigate('/admin'); return; }
      setCls(found);

      const [qzs, sts, subs] = await Promise.all([
        fetchQuizzesByClass(classId!),
        fetchStudentsByClass(classId!),
        fetchClassSubmissions(classId!),
      ]);

      setQuizzes(qzs);
      setStudents(sts);
      setAllSubs(subs);
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally {
      setLoading(false);
    }
  }, [classId, navigate, showToast]);

  useEffect(() => { load(); }, [load]);

  // Toggle quiz active/inactive
  const handleToggle = async (id: string, cur: boolean) => {
    try {
      await toggleQuiz(id, cur);
      await load();
      showToast(cur ? 'Quiz disabled' : 'Quiz enabled');
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    }
  };

  // Delete quiz
  const handleDelete = (id: string, title: string) => setConfirm({
    msg: `Delete "${title}"?`,
    detail: 'This permanently deletes the quiz and all submissions.',
    onConfirm: async () => {
      setConfirm(null);
      try {
        await deleteQuiz(id);
        await load();
        showToast('Quiz deleted');
      } catch {
        showToast('Failed', 'error');
      }
    },
  });

  // Copy quiz link
  const copyLink = (quizId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/quiz/${quizId}`);
    showToast('Link copied!');
  };

  // Filter students & submissions by search & quiz filter
  const filteredStudents = students.filter(s =>
    !search ||
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.section.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSubs = allSubs.filter(s => {
    const matchSearch = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase());
    const matchQuiz = quizFilter === 'all' || s.quiz_id === quizFilter;
    return matchSearch && matchQuiz;
  });

  // Stats
  const avgScore = allSubs.length ? Math.round(allSubs.reduce((a, s) => a + s.percentage, 0) / allSubs.length) : 0;
  const passRate = allSubs.length ? Math.round((allSubs.filter(s => s.percentage >= 75).length / allSubs.length) * 100) : 0;

  // Loading screen
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full border-4 border-[#fdf8f0]/15 border-t-[#f59e0b] h-10 w-10" />
    </div>
  );
  if (!cls) return null;

  // Tabs data
  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'quizzes',  label: 'Quizzes',  count: quizzes.length  },
    { key: 'students', label: 'Students', count: students.length },
    { key: 'scores',   label: 'Scores',   count: allSubs.length  },
  ];

  return (
    <div className="min-h-screen bg-[#0a0908] text-[#fdf8f0]">
      <AdminNav />

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.msg}
          detail={confirm.detail}
          confirmLabel="Delete"
          danger
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="mx-auto max-w-[1100px] px-6 pb-24 pt-8">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-[#b3b3b3]">
          <button onClick={() => navigate('/admin')} className="transition-colors hover:text-[#fdf8f0]">Dashboard</button>
          <span>/</span>
          <span className="text-[#fdf8f0]">{cls.name}</span>
        </nav>

        {/* Class header */}
        <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6 shadow-lg mb-6 animate-fade-up">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/10 text-xl">🏫</div>
                <span className="font-mono text-sm px-2 py-0.5 rounded bg-[#fdf8f0]/10 text-[#fdf8f0]">{cls.code}</span>
              </div>
              <h1 className="font-serif text-3xl text-[#fdf8f0]">{cls.name}</h1>
              <p className="mt-1 text-sm text-[#b3b3b3]">
                Created {new Date(cls.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <button className="px-5 py-2.5 bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-[#0a0908] font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200" onClick={() => navigate(`/admin/class/${classId}/quiz/create`)}>
              + Create Quiz
            </button>
          </div>

          {/* Mini stats */}
          <div className="mt-5 grid grid-cols-4 border-t border-white/10 pt-5 text-center">
            {[
              { v: quizzes.length, label: 'Quizzes', color: 'text-[#fdf8f0]' },
              { v: students.length, label: 'Students', color: 'text-[#fdf8f0]' },
              { v: `${avgScore}%`, label: 'Avg Score', color: avgScore >= 75 ? 'text-[#10b981]' : 'text-[#f43f5e]' },
              { v: `${passRate}%`, label: 'Pass Rate', color: passRate >= 75 ? 'text-[#10b981]' : 'text-[#f43f5e]' },
            ].map(s => (
              <div key={s.label}>
                <div className={`font-serif text-3xl leading-none ${s.color}`}>{s.v}</div>
                <div className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wider text-[#b3b3b3]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1 animate-fade-up">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); setQuizFilter('all'); }}
              className={`flex shrink-0 items-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${tab === t.key ? 'bg-gradient-to-br from-[#f59e0b]/20 to-[#fbbf24]/12 border border-[#f59e0b]/25 text-[#fdf8f0] shadow-md' : 'text-[#b3b3b3] hover:bg-white/5'}`}
            >
              {t.label}
              <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[0.6875rem]">{t.count}</span>
            </button>
          ))}
        </div>

        {/* ── QUIZZES ── */}
        {tab === 'quizzes' && (
          <div className="flex flex-col gap-3 animate-fade-up">
            {quizzes.length === 0
              ? <EmptyState icon="📋" title="No quizzes yet" description="Create the first quiz for this class." action={<button className="px-5 py-2.5 bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-[#0a0908] font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200" onClick={() => navigate(`/admin/class/${classId}/quiz/create`)}>+ Create Quiz</button>} />
              : quizzes.map((q, i) => {
                  const subCount = allSubs.filter(s => s.quiz_id === q.id).length;
                  const qAvg = subCount ? Math.round(allSubs.filter(s => s.quiz_id === q.id).reduce((a, s) => a + s.percentage, 0) / subCount) : null;
                  return (
                    <div key={q.id} className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-4 shadow-lg" style={{ animationDelay: `${i*40}ms`, animation: 'fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both' }}>
                      <div className="flex flex-wrap justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold ${q.is_active ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#f43f5e]/10 text-[#f43f5e]'}`}>{q.is_active ? 'Active' : 'Inactive'}</span>
                            <span className="text-xs text-[#b3b3b3]">{q.questions.length} questions</span>
                            {qAvg !== null && <span className={`text-xs font-semibold ${qAvg >= 75 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>Avg {qAvg}%</span>}
                            <span className="text-xs text-[#b3b3b3]">{subCount} submission{subCount !== 1 ? 's' : ''}</span>
                          </div>
                          <button onClick={() => navigate(`/admin/quiz/${q.id}`)} className="font-serif text-xl text-[#fdf8f0] hover:text-[#f59e0b] transition-colors">{q.title}</button>
                          <p className="mt-1 text-xs text-[#b3b3b3]">Created {new Date(q.created_at).toLocaleDateString()}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            className="px-3 py-1.5 border border-white/10 text-[#fdf8f0] rounded-lg hover:bg-white/5 transition"
                            onClick={() => navigate(`/admin/quiz/${q.id}`)}
                          >
                            View
                          </button>
                          <button className="px-3 py-1.5 border border-white/10 text-[#fdf8f0] rounded-lg hover:bg-white/5 transition" onClick={() => copyLink(q.id)}>📋 Copy</button>
                          <button className={`px-3 py-1.5 rounded-lg text-[#fdf8f0] font-semibold ${q.is_active ? 'bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20' : 'bg-[#10b981]/10 hover:bg-[#10b981]/20'}`} onClick={() => handleToggle(q.id, q.is_active)}>
                            {q.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button className="px-3 py-1.5 bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20 rounded-lg font-semibold" onClick={() => handleDelete(q.id, q.title)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  );
              })}
          </div>
        )}

        {/* ── STUDENTS ── */}
        {tab === 'students' && (
          <div className="animate-fade-up">
            <div className="mb-4">
              <input type="text" className="w-full max-w-sm px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a1a]/50 text-[#fdf8f0]" placeholder="Search by name, email, or section…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {filteredStudents.length === 0
              ? <EmptyState icon="👥" title={search ? 'No matching students' : 'No students yet'} description={search ? 'Try a different search.' : 'Students appear once they submit a quiz.'} />
              : (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1a1a1a]/50">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs text-[#b3b3b3] uppercase">
                        {['Student','Email','Section','Year / Course','Quizzes','Avg Score','Last Submitted'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(s => (
                        <tr key={s.email} className="border-b border-white/10">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-xs font-bold text-[#0a0908]">{s.full_name[0]?.toUpperCase()}</div>
                              <span className="font-medium text-[#fdf8f0]">{s.full_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2"><span className="font-mono text-xs">{s.email}</span></td>
                          <td className="px-3 py-2">{s.section}</td>
                          <td className="px-3 py-2">{s.year_course}</td>
                          <td className="px-3 py-2"><span className="px-2 py-1 bg-[#f59e0b]/10 rounded-full text-xs">{s.submissionsCount}</span></td>
                          <td className="px-3 py-2">
                            <span className={`font-serif font-bold ${s.avgPercentage >= 75 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>{s.avgPercentage}%</span>
                          </td>
                          <td className="px-3 py-2 text-xs">{new Date(s.lastSubmittedAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}

        {/* ── SCORES ── */}
        {tab === 'scores' && (
          <div className="animate-fade-up">
            <div className="mb-4 flex flex-wrap gap-3 items-center">
              <input type="text" className="flex-1 basis-48 max-w-xs px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a1a]/50 text-[#fdf8f0]" placeholder="Search student…" value={search} onChange={e => setSearch(e.target.value)} />
              <select className="flex-1 basis-48 max-w-[260px] px-3 py-2 rounded-lg border border-white/10 bg-[#1a1a1a]/50 text-[#fdf8f0]" value={quizFilter} onChange={e => setQuizFilter(e.target.value)}>
                <option value="all">All quizzes</option>
                {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
              <button
                onClick={() => exportToExcel(filteredSubs, quizzes, cls.name)}
                className="flex items-center gap-2 px-4 py-2 bg-[#10b981]/10 hover:bg-[#10b981]/20 border border-[#10b981]/30 text-[#10b981] rounded-lg text-sm font-semibold transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel (CSV)
              </button>
            </div>
            {filteredSubs.length === 0
              ? <EmptyState icon="📊" title="No scores yet" description="Scores appear once students submit quizzes." />
              : (
                <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1a1a1a]/50">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs text-[#b3b3b3] uppercase">
                        {['Student','Email','Quiz','Score (%)','Date Submitted'].map(h => <th key={h} className="px-3 py-2">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubs.map((s,i) => (
                        <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                          <td className="px-3 py-2 font-medium text-[#fdf8f0]">{s.full_name}</td>
                          <td className="px-3 py-2 font-mono text-xs">{s.email}</td>
                          <td className="px-3 py-2">{quizzes.find(q => q.id === s.quiz_id)?.title || 'Deleted'}</td>
                          <td className="px-3 py-2 font-semibold">
                            <span className={`${s.percentage >= 75 ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
                              {s.score} / {s.total} ({s.percentage}%)
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">{new Date(s.submitted_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        )}

      </div>
    </div>
  );
}

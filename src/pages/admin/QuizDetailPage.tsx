import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminNav from '../../components/AdminNav';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { fetchQuizById, toggleQuiz, deleteQuiz, fetchSubmissions, updateQuizCorrectAnswer, updateQuizTitle } from '../../lib/db';
import { Quiz, Submission } from '../../types';

type Tab = 'questions' | 'submissions';

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

  const load = useCallback(async () => {
    try {
      const [q, subs] = await Promise.all([fetchQuizById(id!), fetchSubmissions(id!)]);
      setQuiz(q); setSubmissions(subs);
    } catch { navigate('/admin'); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const copyLink = () => { navigator.clipboard.writeText(`${window.location.origin}/quiz/${id}`); showToast('Link copied!'); };

  const handleToggle = async () => {
    if (!quiz) return;
    try { const u = await toggleQuiz(quiz.id, quiz.is_active); setQuiz(u); showToast(u.is_active ? 'Quiz enabled' : 'Quiz disabled'); }
    catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  };

  const handleDelete = () => setConfirm({
    msg: `Delete "${quiz?.title}"?`,
    detail: 'This permanently deletes the quiz and all submissions.',
    onConfirm: async () => {
      setConfirm(null);
      try { await deleteQuiz(quiz!.id); showToast('Deleted'); navigate(`/admin/class/${quiz!.class_id}`); }
      catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    },
  });

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || !quiz) return;
    try { const u = await updateQuizTitle(quiz.id, titleDraft); setQuiz(u); setEditingTitle(false); showToast('Title updated!'); }
    catch (e: any) { showToast(e.message || 'Failed', 'error'); }
  };

  const handleSetCorrect = async (qNum: number, answer: string) => {
    if (!quiz) return;
    try { const u = await updateQuizCorrectAnswer(quiz.id, qNum, answer); setQuiz(u); setEditingQ(null); showToast('Correct answer updated!'); }
    catch (e: any) { showToast(e.message || 'Failed', 'error'); }
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
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#fdf8f0]/10 text-[#fdf8f0] text-xs font-mono">{quiz.class_code}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${quiz.is_active ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#f43f5e]/10 text-[#f43f5e]'}`}>{quiz.is_active ? 'Active' : 'Inactive'}</span>
              </div>

              {/* Editable title */}
              {editingTitle ? (
                <div className="flex items-center gap-2 mb-2">
                  <input className="px-2 py-1 rounded border border-white/10 bg-[#1a1a1a]/50 text-[#fdf8f0] max-w-md" value={titleDraft} onChange={e => setTitleDraft(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key==='Enter') handleSaveTitle(); if(e.key==='Escape') setEditingTitle(false); }} />
                  <button className="px-3 py-1.5 bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 rounded" onClick={handleSaveTitle}>Save</button>
                  <button className="px-3 py-1.5 border rounded border-white/10" onClick={() => setEditingTitle(false)}>Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1.5">
                  <h1 className="font-serif text-3xl">{quiz.title}</h1>
                  <button className="px-2 py-1 text-xs border rounded border-white/10 hover:border-[#f59e0b]/30 hover:text-[#f59e0b]" onClick={() => { setTitleDraft(quiz.title); setEditingTitle(true); }}>✎ Edit</button>
                </div>
              )}
              <p className="text-sm text-[#b3b3b3]">{quiz.questions.length} questions · Created {new Date(quiz.created_at).toLocaleDateString()}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="px-3 py-1.5 border border-white/10 rounded hover:bg-white/5" onClick={copyLink}>📋 Copy</button>
              <button className={`px-3 py-1.5 rounded font-semibold ${quiz.is_active ? 'bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20' : 'bg-[#10b981]/10 hover:bg-[#10b981]/20'}`} onClick={handleToggle}>{quiz.is_active ? 'Disable' : 'Enable'}</button>
              <button className="px-3 py-1.5 bg-[#f43f5e]/10 hover:bg-[#f43f5e]/20 rounded font-semibold" onClick={handleDelete}>Delete</button>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-4 border-t border-white/10 pt-5 text-center">
            {[
              { v: submissions.length, label: 'Submissions', color: 'text-[#fdf8f0]' },
              { v: `${avgScore}%`, label: 'Avg Score', color: avgScore>=75?'text-[#10b981]':'text-[#f43f5e]' },
              { v: passed, label: 'Passed ≥75%', color:'text-[#10b981]' },
              { v: failed, label: 'Failed <75%', color:'text-[#f43f5e]' },
            ].map(s=>(
              <div key={s.label}>
                <div className={`font-serif text-3xl ${s.color}`}>{s.v}</div>
                <div className="mt-1 text-[0.625rem] font-semibold uppercase tracking-wider text-[#b3b3b3]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1">
          <button className={`flex-1 py-2 text-sm font-medium ${tab==='questions'?'bg-[#f59e0b]/20 text-[#fdf8f0]':'text-[#b3b3b3] hover:bg-white/5'}`} onClick={()=>setTab('questions')}>Questions ({quiz.questions.length})</button>
          <button className={`flex-1 py-2 text-sm font-medium ${tab==='submissions'?'bg-[#f59e0b]/20 text-[#fdf8f0]':'text-[#b3b3b3] hover:bg-white/5'}`} onClick={()=>setTab('submissions')}>Submissions ({submissions.length})</button>
        </div>

        {/* Questions tab */}
        {tab==='questions' && (
          <div className="flex flex-col gap-3 animate-fade-up">
            {quiz.questions.map((q,i)=>(
              <div key={q.number} className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between mb-3 items-start">
                  <div className="flex gap-2 text-sm font-medium text-[#b3b3b3]">
                    <span className="font-mono text-xs text-[#f59e0b] mt-0.5">{q.number}.</span>
                    <span>{q.question}</span>
                  </div>
                  {editingQ!==q.number && <button className="px-2 py-1 text-xs border rounded border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/10" onClick={()=>setEditingQ(q.number)}>✎ Change Answer</button>}
                </div>
                <div className="flex flex-col gap-2">
                  {q.options.map(opt=>{
                    const isCorrect = opt.label===q.correctAnswer;
                    const isEditing = editingQ===q.number;
                    return (
                      <div key={opt.label} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition ${isCorrect?'border-[#10b981]/25 bg-[#10b981]/7':'border-white/[0.07] bg-white/[0.03]'} ${isEditing&&!isCorrect?'cursor-pointer hover:border-[#f59e0b]/30 hover:bg-[#f59e0b]/5':''}`} onClick={()=>isEditing&&handleSetCorrect(q.number,opt.label)}>
                        <span className={`w-4 font-mono text-[0.6875rem] font-bold ${isCorrect?'text-[#10b981]':'text-[#b3b3b3]'}`}>{opt.label}.</span>
                        <span className={`flex-1 text-sm ${isCorrect?'text-[#10b981]':'text-[#b3b3b3]'}`}>{opt.text}</span>
                        {isCorrect && <span className="px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide bg-[#10b981]/12 rounded-full text-[#10b981]">✓ Correct</span>}
                        {isEditing&&!isCorrect && <span className="text-[0.6875rem] text-[#f59e0b] opacity-60">Click to mark correct</span>}
                      </div>
                    )
                  })}
                </div>
                {editingQ===q.number && <div className="flex justify-end mt-3"><button className="px-3 py-1.5 border rounded border-white/10" onClick={()=>setEditingQ(null)}>Cancel</button></div>}
              </div>
            ))}
          </div>
        )}

        {/* Submissions tab */}
        {tab==='submissions' && (
          <div className="animate-fade-up">
            {selectedSub ? (
              <div>
                <button onClick={()=>setSelectedSub(null)} className="mb-5 text-sm text-[#b3b3b3] hover:text-[#fdf8f0]">← Back to submissions</button>
                <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6 shadow-lg mb-5 flex flex-wrap items-center gap-6">
                  <div className={`flex flex-col items-center justify-center w-28 h-28 border-4 rounded-full ${selectedSub.percentage>=75?'border-[#10b981]':'border-[#f43f5e]'}`}>
                    <span className="text-3xl font-serif text-[#fdf8f0]">{selectedSub.percentage}%</span>
                    <span className="text-xs text-[#b3b3b3] mt-1">{selectedSub.score}/{selectedSub.total}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-serif mb-1">{selectedSub.full_name}</h2>
                    <div className="flex flex-col gap-0.5 text-sm text-[#b3b3b3]">
                      <span className="font-mono text-xs">{selectedSub.email}</span>
                      <span>{selectedSub.section} · {selectedSub.year_course}</span>
                      <span className="text-xs">Submitted {new Date(selectedSub.submitted_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {/* Answer breakdown similar to above style */}
              </div>
            ) : (
              submissions.length===0
                ? <EmptyState icon="📬" title="No submissions yet" description="Share the quiz link with students." action={<button className="px-3 py-1.5 border rounded border-white/10 hover:bg-white/5" onClick={copyLink}>Copy Quiz Link</button>} />
                : (
                  <div>
                    <input type="text" className="px-3 py-2 rounded-lg border border-white/10 mb-4 max-w-xs bg-[#1a1a1a]/50 text-[#fdf8f0]" placeholder="Search by name or email…" value={search} onChange={e=>setSearch(e.target.value)} />
                    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1a1a1a]/50">
                      <table className="min-w-full border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-left text-xs text-[#b3b3b3] uppercase">
                            {['Name','Email','Section','Year/Course','Score','%','Result','Submitted',''].map(h=><th key={h} className="px-3 py-2">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSubs.map(s=>(
                            <tr key={s.id} className="border-b border-white/10">
                              <td className="px-3 py-2 font-medium text-[#fdf8f0]">{s.full_name}</td>
                              <td className="px-3 py-2 font-mono text-xs">{s.email}</td>
                              <td className="px-3 py-2 text-xs">{s.section}</td>
                              <td className="px-3 py-2 text-xs">{s.year_course}</td>
                              <td className="px-3 py-2 font-mono text-sm">{s.score}/{s.total}</td>
                              <td className="px-3 py-2 font-bold text-xl text-[#10b981]">{s.percentage}%</td>
                              <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${s.percentage>=75?'bg-[#10b981]/10 text-[#10b981]':'bg-[#f43f5e]/10 text-[#f43f5e]'}`}>{s.percentage>=75?'Passed':'Failed'}</span></td>
                              <td className="px-3 py-2 text-xs">{new Date(s.submitted_at).toLocaleDateString()}</td>
                              <td className="px-3 py-2"><button className="px-3 py-1.5 border border-white/10 rounded hover:bg-white/5" onClick={()=>setSelectedSub(s)}>Review</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
            )}
          </div>
        )}

      </div>
    </div>
  )
}

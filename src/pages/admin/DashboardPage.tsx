import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminNav from '../../components/AdminNav';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { fetchClasses, createClass, deleteClass, fetchQuizzes } from '../../lib/db';
import { Class, Quiz } from '../../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  // State management
  const [classes, setClasses] = useState<Class[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<{ msg: string; detail?: string; onConfirm: () => void } | null>(null);

  // Load classes and quizzes
  const load = useCallback(async () => {
    try {
      const [cls, qzs] = await Promise.all([fetchClasses(), fetchQuizzes()]);
      setClasses(cls);
      setQuizzes(qzs);
    } catch (e: any) {
      showToast(e.message || 'Failed to load', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // Create a new class
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createClass(newName.trim());
      setNewName('');
      await load();
      showToast('Class created!');
    } catch (e: any) {
      showToast(e.message || 'Failed', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Delete a class
  const handleDelete = (id: string, name: string) => setConfirm({
    msg: `Delete "${name}"?`,
    detail: 'All quizzes and submissions in this class will also be removed.',
    onConfirm: async () => {
      setConfirm(null);
      try {
        await deleteClass(id);
        await load();
        showToast('Class deleted');
      } catch {
        showToast('Failed', 'error');
      }
    },
  });

  // Stats cards
  const STATS = [
    { icon: '🏫', value: classes.length, label: 'Classes', accent: 'bg-[#f59e0b]/10 border-[#f59e0b]/20' },
    { icon: '📋', value: quizzes.length, label: 'Quizzes', accent: 'bg-[#14b8a6]/10 border-[#14b8a6]/20' },
    { icon: '✅', value: quizzes.filter(q => q.is_active).length, label: 'Active', accent: 'bg-[#10b981]/10 border-[#10b981]/20' },
    { icon: '📊', value: quizzes.reduce((a, q) => a + q.questions.length, 0), label: 'Questions', accent: 'bg-[#f59e0b]/10 border-[#f59e0b]/20' },
  ];

  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full border-4 border-[#fdf8f0]/15 border-t-[#f59e0b] h-10 w-10" />
      <span className="text-sm text-[#b3b3b3]">Loading…</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0908] text-[#fdf8f0]">
      <AdminNav />

      {/* Confirm dialog for deletion */}
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

        {/* Header */}
        <div className="animate-fade-up mb-8">
          <h1 className="font-serif text-3xl text-[#fdf8f0]">Dashboard</h1>
          <p className="mt-1 text-sm text-[#b3b3b3]">Manage your classes, quizzes, and students.</p>
        </div>

        {/* Stats */}
        <div className="animate-fade-up grid grid-cols-2 gap-3 lg:grid-cols-4 mb-8">
          {STATS.map((s, i) => (
            <div key={s.label} className="bg-[#1a1a1a]/50 border rounded-xl p-4 flex flex-col items-center text-center shadow-lg" style={{ animationDelay: `${i*50}ms`, animation: 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both' }}>
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${s.accent}`}>{s.icon}</div>
              <div className="font-serif text-[2.4rem] leading-none">{s.value}</div>
              <div className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-widest text-[#b3b3b3]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Create Class */}
        <div className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-6 shadow-lg animate-fade-up mb-8">
          <h3 className="mb-3 font-serif text-lg text-[#b3b3b3]">Create a New Class</h3>
          <div className="flex gap-3">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-[#0f0f0f]/50 text-[#fdf8f0]"
              placeholder="e.g. Computer Science 101"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              className="px-5 py-2.5 bg-gradient-to-br from-[#f59e0b] to-[#d97706] rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? <div className="animate-spin rounded-full border-2 border-[#fdf8f0]/15 border-t-[#f59e0b] h-4 w-4 mx-auto" /> : '+ Create Class'}
            </button>
          </div>
        </div>

        {/* Classes */}
        <div className="animate-fade-up mb-3">
          <h2 className="font-serif text-xl text-[#fdf8f0]">Your Classes</h2>
          <p className="mt-0.5 text-sm text-[#b3b3b3]">Click a class to view its quizzes, students, and scores.</p>
        </div>

        {classes.length === 0 ? (
          <EmptyState icon="🏫" title="No classes yet" description="Create your first class above to get started." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((cls, i) => {
              const clsQuizzes = quizzes.filter(q => q.class_code === cls.code);
              const activeCount = clsQuizzes.filter(q => q.is_active).length;
              return (
                <div
                  key={cls.id}
                  onClick={() => navigate(`/admin/class/${cls.id}`)}
                  className="bg-[#1a1a1a]/50 border border-white/10 rounded-xl p-4 shadow-lg relative cursor-pointer group"
                  style={{ animationDelay: `${i*60}ms`, animation: 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both' }}
                >
                  {/* Delete button */}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(cls.id, cls.name); }}
                    className="absolute top-4 right-4 h-7 w-7 flex items-center justify-center rounded-lg border border-transparent text-[#b3b3b3] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:border-[#f43f5e]/30 hover:bg-[#f43f5e]/10 hover:text-[#f43f5e]"
                  >×</button>

                  {/* Icon */}
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/10 text-2xl">🏫</div>

                  {/* Class name/code */}
                  <h3 className="mb-2 pr-8 font-serif text-xl text-[#fdf8f0]">{cls.name}</h3>
                  <span className="inline-block px-2 py-0.5 rounded bg-[#fdf8f0]/10 text-[#fdf8f0] font-mono text-xs">{cls.code}</span>

                  <div className="my-3 border-t border-white/10" />

                  {/* Stats */}
                  <div className="flex items-end justify-between">
                    <div className="flex gap-5">
                      <div>
                        <div className="font-serif text-2xl leading-none text-[#fdf8f0]">{clsQuizzes.length}</div>
                        <div className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-[#b3b3b3]">Quizzes</div>
                      </div>
                      <div>
                        <div className="font-serif text-2xl leading-none text-[#10b981]">{activeCount}</div>
                        <div className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-[#b3b3b3]">Active</div>
                      </div>
                    </div>
                    <span className="text-[#fdf8f0] font-bold text-xl">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
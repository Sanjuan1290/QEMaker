import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminNav from '../../components/AdminNav';
import { useToast } from '../../components/Toast';
import { fetchClasses, createQuiz } from '../../lib/db';
import { parseQuiz } from '../../utils/parseQuiz';
import { Class, Question } from '../../types';

const EXAMPLE = `1. What is the main character's name?
a. Adan
b. Maru
c. George
d. Bert - correct
=====
2. Where does the story take place?
a. Lake Mar
b. Under the tree - correct
c. In the city
d. Beside the river
=====
3. What genre is this story?
a. Horror
b. Fantasy - correct
c. Mystery
d. Romance`;

export default function CreateQuizPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [cls, setCls] = useState<Class | null>(null);
  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [preview, setPreview] = useState<Question[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    fetchClasses().then(classes => {
      const found = classes.find(c => c.id === classId);
      if (!found) { navigate('/admin'); return; }
      setCls(found);
    }).catch(() => navigate('/admin'));
  }, [classId, navigate]);

  const handlePreview = useCallback(() => {
    if (!rawInput.trim()) return;
    setParseError('');
    const questions = parseQuiz(rawInput);
    setPreview(questions);
    if (questions.length === 0) setParseError('No valid questions found. Check your formatting.');
  }, [rawInput]);

  const handleCreate = async () => {
    if (!title.trim() || !rawInput.trim()) { showToast('Fill in all fields.', 'error'); return; }
    if (!cls) return;
    setSubmitting(true);
    try {
      const quiz = await createQuiz(title, cls.id, cls.code, rawInput);
      showToast('Quiz created!');
      setTimeout(() => navigate(`/admin/quiz/${quiz.id}`), 600);
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const noCorrect = preview.filter(q => !q.correctAnswer).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 text-white">
      <AdminNav />

      <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-slate-400 group">
          <button 
            onClick={() => navigate('/admin')} 
            className="hover:text-white transition-colors duration-200 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </button>
          <span className="text-slate-500">/</span>
          {cls && (
            <button 
              onClick={() => navigate(`/admin/class/${classId}`)} 
              className="hover:text-white transition-colors duration-200 truncate max-w-[200px]"
            >
              {cls.name}
            </button>
          )}
          <span className="text-slate-500">/</span>
          <span className="text-slate-300 font-medium">New Quiz</span>
        </nav>

        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10 mb-6">
            <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-blue-400 rounded-full" />
            <h1 className="text-3xl lg:text-4xl font-light tracking-tight">Create Quiz</h1>
          </div>
          {cls && (
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center text-sm text-slate-400">
              <span>For class:</span>
              <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 px-4 py-2 rounded-xl backdrop-blur-sm">
                <span className="font-medium text-white">{cls.name}</span>
                <span className="px-3 py-1 bg-slate-700/50 text-xs font-mono rounded-full text-slate-300">{cls.code}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left Panel - Form */}
          <div className="space-y-6">
            {/* Title Input */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/20 hover:shadow-black/30 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-white/20">
                  <span className="text-lg font-medium text-blue-300">1</span>
                </div>
                <div>
                  <h3 className="text-xl font-light text-white">Quiz Title</h3>
                  <p className="text-sm text-slate-400">Make it clear and descriptive</p>
                </div>
              </div>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-6 py-4 text-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-white"
                placeholder="Midterm Exam — Chapters 3-5"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Questions Input */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/20 hover:shadow-black/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl flex items-center justify-center border border-white/20">
                    <span className="text-lg font-medium text-emerald-300">2</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-light text-white">Questions</h3>
                    <p className="text-sm text-slate-400">Paste formatted text below</p>
                  </div>
                </div>
                <button 
                  className="group flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-5 py-2.5 rounded-xl backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white hover:text-white/90"
                  onClick={() => { setRawInput(EXAMPLE); setPreview([]); setParseError(''); }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Example
                </button>
              </div>

              {/* Format Guide */}
              <div className="bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50 rounded-xl p-5 mb-6 backdrop-blur-sm">
                <h4 className="flex items-center gap-2 mb-4 text-sm font-medium text-emerald-300">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                  Format Guide
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                    <code className="font-mono text-emerald-300">1. Question text?</code>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                    <code className="font-mono text-emerald-300">a. Option - correct</code>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 bg-white/5 rounded-lg">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                    <code className="font-mono text-emerald-300">===== (separator)</code>
                  </div>
                </div>
              </div>

              <textarea
                className="w-full min-h-[300px] bg-white/5 border border-white/20 rounded-2xl px-6 py-5 text-white placeholder-slate-400 resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-sm leading-relaxed"
                placeholder={EXAMPLE}
                value={rawInput}
                onChange={e => { setRawInput(e.target.value); setPreview([]); setParseError(''); }}
              />

              {parseError && (
                <div className="bg-gradient-to-r from-rose-500/10 to-rose-600/10 border border-rose-400/30 rounded-xl p-5 backdrop-blur-sm flex items-start gap-3">
                  <div className="w-5 h-5 bg-rose-400/80 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-rose-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-rose-200">{parseError}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button 
                  className="flex-1 group flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-4 rounded-xl backdrop-blur-sm transition-all duration-200 text-sm font-medium text-white hover:shadow-lg hover:shadow-white/10 hover:border-white/30"
                  onClick={handlePreview} 
                  disabled={!rawInput.trim()}
                >
                  <svg className="w-4 h-4 group-disabled:opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview Questions
                </button>
                <button 
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 px-6 py-4 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCreate} 
                  disabled={submitting || !title.trim() || !rawInput.trim()}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Create Quiz
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:sticky lg:top-24 lg:max-h-[80vh] lg:overflow-y-auto">
            <div className="bg-white/3 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/30 hover:shadow-black/40 transition-all duration-300">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center border border-white/20">
                    <span className="text-lg font-medium text-purple-300">3</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-light text-white">Preview</h3>
                    <p className="text-sm text-slate-400">Review your questions</p>
                  </div>
                </div>
                {preview.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm font-medium text-emerald-300 backdrop-blur-sm">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                      {preview.length} questions
                    </div>
                    {noCorrect > 0 && (
                      <div className="flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 px-4 py-2 rounded-xl text-sm font-medium text-rose-300 backdrop-blur-sm">
                        ⚠ {noCorrect} missing answers
                      </div>
                    )}
                  </div>
                )}
              </div>

              {preview.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-white/20 rounded-2xl backdrop-blur-sm">
                  <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                    <svg className="w-12 h-12 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-light text-white mb-2">No questions to preview</h4>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto mb-6">
                    Paste your quiz content above and click "Preview Questions" to see it formatted perfectly.
                  </p>
                  <div className="w-24 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {preview.map((q, i) => (
                    <div key={q.number} className="group border-b border-white/10 pb-6 last:border-b-0 last:pb-0 hover:bg-white/5 rounded-xl p-4 transition-all duration-200">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="w-7 h-7 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center text-xs font-mono font-medium text-slate-300 flex-shrink-0 mt-0.5">
                          {q.number}.
                        </span>
                        <h4 className="text-lg leading-tight flex-1 font-light text-white">{q.question}</h4>
                      </div>
                      
                      <div className="space-y-2 ml-7">
                        {q.options.map(opt => {
                          const correct = opt.label === q.correctAnswer;
                          return (
                            <div key={opt.label} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-default group-hover:backdrop-blur-sm ${
                              correct 
                                ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-400/40 backdrop-blur-sm shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20' 
                                : 'bg-white/5 border border-white/10 hover:bg-white/10'
                            }`}>
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-mono font-bold flex-shrink-0 ${
                                correct 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400/50 shadow-md' 
                                  : 'bg-slate-800/50 text-slate-400'
                              }`}>
                                {opt.label}
                              </span>
                              <span className="flex-1 text-sm text-slate-200 leading-relaxed">{opt.text}</span>
                              {correct && (
                                <div className="flex items-center gap-1 bg-emerald-500/20 px-3 py-1.5 rounded-full text-xs font-bold text-emerald-400 border border-emerald-400/50 backdrop-blur-sm shadow-md">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Correct
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!q.correctAnswer && (
                          <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-400/30 rounded-xl backdrop-blur-sm">
                            <div className="w-5 h-5 bg-amber-400/80 rounded-lg flex items-center justify-center flex-shrink-0">
                              <svg className="w-2.5 h-2.5 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="text-sm text-amber-200 font-medium">No correct answer marked</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

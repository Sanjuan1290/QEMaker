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
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiItemCount, setAiItemCount] = useState('50');
  const [showPreview, setShowPreview] = useState(false);

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
    if (questions.length === 0) {
      setParseError('No valid questions found. Check your formatting.');
    } else {
      setShowPreview(true);
    }
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

  const aiPromptText = `Create ${aiItemCount || '50'} items multiple choice about ${aiTopic || '[your topic/lesson]'}. Each question ends with =====. Correct answer has - correct at the end of that option.

Format:
1. Question here?
a. Option A
b. Option B - correct
c. Option C
d. Option D
=====`;

  const noCorrect = preview.filter(q => !q.correctAnswer).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="mx-auto max-w-3xl px-5 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <button onClick={() => navigate('/admin')} className="hover:text-gray-700 transition-colors">Dashboard</button>
          <span>/</span>
          {cls && (
            <button onClick={() => navigate(`/admin/class/${classId}`)} className="hover:text-gray-700 transition-colors truncate max-w-[160px]">
              {cls.name}
            </button>
          )}
          <span>/</span>
          <span className="text-gray-600 font-medium">New Quiz</span>
        </nav>

        {/* Page header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900">Create a Quiz</h1>
          {cls && (
            <p className="text-sm text-gray-500 mt-1">
              For <span className="font-semibold text-gray-700">{cls.name}</span>
              <span className="ml-2 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{cls.code}</span>
            </p>
          )}
        </div>

        {/* Main form card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Step 1 — Title */}
          <div className="p-6 border-b border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Quiz Title
            </label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm"
              placeholder="e.g. Midterm Exam — Chapter 3-5"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {/* Step 2 — Questions */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700">Questions</label>
                <p className="text-xs text-gray-400 mt-0.5">Paste your formatted quiz text below</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setRawInput(EXAMPLE); setPreview([]); setParseError(''); setShowPreview(false); }}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  Load Example
                </button>
                <button
                  onClick={() => setShowAiPrompt(v => !v)}
                  className="text-xs px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-1.5 font-medium"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Prompt
                </button>
              </div>
            </div>

            {/* AI Prompt Generator */}
            {showAiPrompt && (
              <div className="mb-4 p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <p className="text-xs font-semibold text-purple-700 mb-3 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Prompt Generator — copy this into ChatGPT or any AI
                </p>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder="Topic / lesson (e.g. Philippine History)"
                    className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  />
                  <input
                    type="number"
                    value={aiItemCount}
                    onChange={e => setAiItemCount(e.target.value)}
                    placeholder="# items"
                    min="1"
                    max="100"
                    className="w-20 px-3 py-2 text-sm border border-purple-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent text-center"
                  />
                </div>
                {/* Prompt preview */}
                <div className="relative bg-white border border-purple-200 rounded-lg p-3 font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {aiPromptText}
                  <button
                    onClick={() => { navigator.clipboard.writeText(aiPromptText); showToast('Prompt copied!'); }}
                    className="absolute top-2 right-2 px-2 py-1 bg-purple-600 text-white text-[10px] rounded-md hover:bg-purple-700 transition-colors font-sans font-semibold"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-purple-500">
                  After the AI generates the quiz, paste the result in the text area below.
                </p>
              </div>
            )}

            {/* Format guide */}
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono">1. Question text?</span>
              <span className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono">b. Option - correct</span>
              <span className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono">===== (separator)</span>
            </div>

            <textarea
              className="w-full min-h-[280px] px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder-gray-400 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-sm leading-relaxed font-mono"
              placeholder={`Paste your questions here...\n\n${EXAMPLE}`}
              value={rawInput}
              onChange={e => { setRawInput(e.target.value); setPreview([]); setParseError(''); setShowPreview(false); }}
            />

            {parseError && (
              <div className="mt-2 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {parseError}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handlePreview}
                disabled={!rawInput.trim()}
                className="px-5 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Preview
              </button>

              <button
                onClick={handleCreate}
                disabled={submitting || !title.trim() || !rawInput.trim()}
                className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

        {/* Preview panel */}
        {showPreview && preview.length > 0 && (
          <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-700">Preview</h3>
                <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                  {preview.length} questions
                </span>
                {noCorrect > 0 && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
                    ⚠ {noCorrect} missing correct answer
                  </span>
                )}
              </div>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 max-h-[500px] overflow-y-auto space-y-5">
              {preview.map(q => (
                <div key={q.number} className="pb-5 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex gap-3 mb-3">
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5">{q.number}</span>
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">{q.question}</p>
                  </div>
                  <div className="ml-9 space-y-1.5">
                    {q.options.map(opt => {
                      const correct = opt.label === q.correctAnswer;
                      return (
                        <div key={opt.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                          correct ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-100'
                        }`}>
                          <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            correct ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>{opt.label.toUpperCase()}</span>
                          <span className={correct ? 'text-green-800 font-medium' : 'text-gray-600'}>{opt.text}</span>
                          {correct && <span className="ml-auto text-[10px] font-bold text-green-600">✓ correct</span>}
                        </div>
                      );
                    })}
                    {!q.correctAnswer && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                        ⚠ No correct answer marked
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
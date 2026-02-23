import type { Question } from '../types';

/**
 * Parses raw multiple-choice quiz text into structured Question objects.
 *
 * Format:
 *   1. Question text?
 *   a. Option A
 *   b. Option B - correct
 *   c. Option C
 *   d. Option D
 *   =====
 *   2. Next question…
 */
export function parseQuiz(rawText: string): Question[] {
  if (!rawText || !rawText.trim()) return [];

  const blocks = rawText
    .split(/={3,}/g)
    .map(b => b.trim())
    .filter(Boolean);

  const questions: Question[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length < 2) continue;

    // Find the question line: starts with digit(s) + "." or ")"
    const qIdx = lines.findIndex(l => /^\d+[.)]\s*.+/.test(l));
    if (qIdx === -1) continue;

    const questionText = lines[qIdx].replace(/^\d+[.)]\s*/, '').trim();
    if (!questionText) continue;

    const options: Question['options'] = [];
    let correctAnswer: string | undefined;

    for (let i = qIdx + 1; i < lines.length; i++) {
      const m = lines[i].match(/^([a-dA-D])[.)]\s*(.+)/);
      if (!m) continue;

      const label = m[1].toLowerCase();
      let text    = m[2].trim();

      if (/\s*-?\s*correct\s*$/i.test(text)) {
        correctAnswer = label;
        text = text.replace(/\s*-?\s*correct\s*$/i, '').trim();
      }

      options.push({ label, text });
    }

    if (options.length === 0) continue;

    questions.push({
      number: questions.length + 1,
      question: questionText,
      options,
      correctAnswer,
    });
  }

  return questions;
}
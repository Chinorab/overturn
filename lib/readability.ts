/**
 * Flesch-Kincaid grade level, implemented locally so the readability gate (SC-005) has no
 * dependency and runs on the server and in tests.
 */

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function fleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => /[a-zA-Z0-9]/.test(w));
  if (sentences.length === 0 || words.length === 0) return 0;
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  const grade = 0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export interface QuizItem {
  type: string;
  question: string;
}

export interface Attempt {
  type: "explain-back" | "question";
  q?: string;
  answer: string;
  at: string;
  result?: any;
}

export interface Question {
  q: string;
  at: string;
}

export interface Lesson {
  id: string;
  title: string;
  mainConcept: string;
  sourceText: string;
  simpleExplanation: string;
  detailedExplanation: string;
  analogy: string;
  example: string;
  keyTerms: string[];
  commonMisconceptions: string[];
  feynmanPrompt: string;
  miniQuiz: QuizItem[];
  locked: boolean;
  completed: boolean;
  completedAt?: string;
  score: number;
  attempts: Attempt[];
  questions: Question[];
  weakConcepts: string[];
}

export interface ExamResult {
  score: number;
  passed: boolean;
  whatStudentUnderstood?: string[];
  missingIdeas?: string[];
  misconceptions?: string[];
  feedback?: string;
  simplerExplanation?: string;
  followUpQuestion?: string;
  weakConcepts?: string[];
  answers: string[];
  at: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  learningGoals: string[];
  lessons: Lesson[];
  exam: QuizItem[];
  examUnlocked?: boolean;
  examResult: ExamResult | null;
  locked: boolean;
}

export interface Flashcard {
  id: string;
  lessonId: string;
  chapterId: string;
  seed: string;
  front: string;
  back: string;
  status: "new" | "weak" | "review" | "learned";
  interval: number;
  reviews: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

export interface Course {
  id: string;
  title: string;
  summary: string;
  level: string;
  goal: string;
  sourceType: string;
  createdAt: string;
  chapters: Chapter[];
  finalExam: QuizItem[];
  finalExamResult: ExamResult | null;
  flashcards?: Flashcard[];
}

export interface AISettings {
  provider: "demo" | "gemini" | "ollama" | "openai-compatible" | "openrouter";
  ollamaUrl: string;
  model: string;
  apiBase: string;
  apiKey: string;
  paidModel: string;
}

export interface SourceDraft {
  title: string;
  level: string;
  goal: string;
  text: string;
  url: string;
}

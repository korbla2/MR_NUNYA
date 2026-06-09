import { Course, Chapter, Lesson, QuizItem, Flashcard } from "./types";

export function uid(prefix: string = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function esc(s: string = ""): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}

export function cap(s: string = ""): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function words(s: string = ""): string[] {
  return [
    ...new Set(
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 3)
    )
  ];
}

export function toArray(value: any): string[] {
  if (Array.isArray(value)) return value.map(v => String(v)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value.split(/\n|;|,/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

export function cleanText(value: string = "") {
  return String(value)
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function splitIntoN(text: string, n: number): string[] {
  const s = text.match(/[^.!?]+[.!?]+/g) || [text];
  return Array.from({ length: n }, (_, i) =>
    s
      .slice(Math.floor((i * s.length) / n), Math.floor(((i + 1) * s.length) / n))
      .join(" ")
      .trim()
  ).filter(Boolean);
}

// Spaced Repetition logic
export function ensureFlashcards(course: Course): Flashcard[] {
  if (!course) return [];
  course.flashcards ||= [];
  const existing = new Set(course.flashcards.map(c => c.seed));

  course.chapters.forEach(ch =>
    ch.lessons.forEach(l => {
      const seeds = [
        {
          seed: `${l.id}:main`,
          front: `Explain ${l.mainConcept} simply.`,
          back: `${l.simpleExplanation}\n\nExample: ${l.example}`
        },
        {
          seed: `${l.id}:analogy`,
          front: `Give an analogy for ${l.mainConcept}.`,
          back: l.analogy || `Use a simple everyday comparison for ${l.mainConcept}.`
        },
        {
          seed: `${l.id}:mistake`,
          front: `What is a common mistake about ${l.mainConcept}?`,
          back:
            (l.commonMisconceptions || []).join("\n") ||
            `Memorizing words is not the same as understanding ${l.mainConcept}.`
        },
        ...(l.keyTerms || [])
          .slice(0, 4)
          .map(term => ({
            seed: `${l.id}:term:${term}`,
            front: `What does “${term}” mean in this lesson?`,
            back: `Explain “${term}” in relation to ${l.mainConcept}, then give one example.`
          }))
      ];

      seeds.forEach(card => {
        if (!existing.has(card.seed)) {
          existing.add(card.seed);
          course.flashcards!.push({
            id: uid("card"),
            lessonId: l.id,
            chapterId: ch.id,
            seed: card.seed,
            front: card.front,
            back: card.back,
            status: "new",
            interval: 0,
            reviews: 0,
            dueAt: new Date().toISOString(),
            lastReviewedAt: null
          });
        }
      });
    })
  );
  return course.flashcards;
}

export function dueFlashcards(course: Course): Flashcard[] {
  const now = Date.now();
  return ensureFlashcards(course).filter(c => new Date(c.dueAt).getTime() <= now);
}

// Next interval calculator for SRS
export function nextInterval(current: number, good: boolean): number {
  if (!good) return 1;
  if (!current || current < 1) return 1;
  if (current < 3) return 3;
  if (current < 7) return 7;
  if (current < 14) return 14;
  return Math.min(60, Math.round(current * 1.8));
}

// Offline fallback outline generator
export function makeSimpleExplanation(main: string, text: string) {
  return `${main} is one of the important ideas in this source. In simple words: learn what it means, why it matters, and how it connects to the bigger topic. ${text.slice(0, 220)}${text.length > 220 ? "..." : ""}`;
}

export function makeDetailedExplanation(main: string, text: string) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return `Detailed teaching for ${main}:

1. What it is: ${main} is a key idea in this lesson. First, understand its meaning clearly.

2. Why it matters: this idea helps explain the larger topic and connects to other ideas in the course.

3. How it works: look for the steps, cause-and-effect, or relationship in the source. Then describe that process in your own words.

4. What to remember: keep the main point, one supporting detail, and one example.

Source detail: ${clean.slice(0, 700)}${clean.length > 700 ? "..." : ""}`;
}

export function makeQuiz(main: string): QuizItem[] {
  return [
    { type: "explain", question: `Explain ${main.toLowerCase()} in simple words.` },
    { type: "example", question: `Give a real-life example of ${main.toLowerCase()}.` },
    { type: "mistake", question: `Correct this mistake: “I understand ${main.toLowerCase()} if I can repeat the definition exactly.”` }
  ];
}

export function makeExam(title: string, final: boolean = false): QuizItem[] {
  return [
    { type: "feynman", question: final ? `Teach the whole course, ${title}, to a beginner.` : `Teach this chapter, ${title}, to a beginner.` },
    { type: "application", question: `Give a practical example that shows the main idea.` },
    { type: "connection", question: `Connect this idea to another idea in the course.` }
  ];
}

export function heuristicCourse(draft: { title: string; text: string; level: string; goal: string }): Course {
  const clean = draft.text.replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || clean.split(/\n+/).filter(Boolean);
  const key = words(clean)
    .filter(
      w =>
        ![
          "this", "that", "with", "from", "have", "will", "they", "their", "about",
          "when", "what", "your", "more", "than", "into", "were", "been"
        ].includes(w)
    )
    .slice(0, 30);
  const topic = draft.title || key.slice(0, 4).map(w => w[0].toUpperCase() + w.slice(1)).join(" ") || "New Course";
  const chunkCount = Math.min(4, Math.max(2, Math.ceil(sentences.length / 8)));
  const chunks = Array.from({ length: chunkCount }, (_, i) =>
    sentences
      .slice(Math.floor((i * sentences.length) / chunkCount), Math.floor(((i + 1) * sentences.length) / chunkCount))
      .join(" ")
  );

  const chapters: Chapter[] = chunks.map((chunk, ci) => {
    const kw = words(chunk)
      .filter(w => key.includes(w))
      .slice(0, 9);
    const chapterTitle = kw.slice(0, 2).map(cap).join(" & ") || `Core Idea ${ci + 1}`;
    const lessonChunks = splitIntoN(chunk, Math.min(3, Math.max(2, Math.ceil((chunk.length || 1) / 900))));
    const lessons: Lesson[] = lessonChunks.map((lc, li) => {
      const lw = words(lc)
        .filter(w => key.includes(w))
        .slice(0, 6);
      const main = lw[0] ? cap(lw[0]) : `Concept ${li + 1}`;
      return {
        id: uid("lesson"),
        title: `${main}: explain it simply`,
        mainConcept: main,
        sourceText: lc || chunk,
        simpleExplanation: makeSimpleExplanation(main, lc),
        detailedExplanation: makeDetailedExplanation(main, lc),
        analogy: `Think of ${main.toLowerCase()} like a clear label on a box: it helps your brain know where this idea belongs and how to use it later.`,
        example: `If you were teaching a friend, you would say what ${main.toLowerCase()} means, why it matters, and give one simple real-life example.`,
        keyTerms: lw,
        commonMisconceptions: [
          `Memorizing the words is not the same as understanding ${main.toLowerCase()}.`,
          `A vague explanation usually means one idea is still missing.`
        ],
        feynmanPrompt: `Explain ${main.toLowerCase()} in your own words. Use one example and avoid copying from the source.`,
        miniQuiz: makeQuiz(main),
        locked: ci !== 0 || li !== 0,
        completed: false,
        score: 0,
        attempts: [],
        questions: [],
        weakConcepts: []
      };
    });
    return {
      id: uid("chapter"),
      title: chapterTitle,
      summary: chunk.slice(0, 220) + (chunk.length > 220 ? "..." : ""),
      learningGoals: kw.slice(0, 4).map(w => `Explain ${w} simply`),
      lessons,
      exam: makeExam(chapterTitle),
      examResult: null,
      locked: ci !== 0
    };
  });

  return {
    id: uid("course"),
    title: topic,
    summary: clean.slice(0, 300) + (clean.length > 300 ? "..." : ""),
    level: draft.level,
    goal: draft.goal,
    sourceType: "text",
    createdAt: new Date().toISOString(),
    chapters,
    finalExam: makeExam(topic, true),
    finalExamResult: null,
    flashcards: []
  };
}

export function courseProgress(course: Course): number {
  const lessons = course.chapters.flatMap(ch => ch.lessons);
  if (!lessons.length) return 0;
  return Math.round((lessons.filter(l => l.completed).length / lessons.length) * 100);
}

export function weakTopics(course: Course): string[] {
  const set = new Set<string>();
  course.chapters.forEach(ch =>
    ch.lessons.forEach(l => (l.weakConcepts || []).forEach(w => set.add(w)))
  );
  return [...set].slice(0, 8);
}

export function getLesson(course: Course, lessonId: string | null): { lesson: Lesson | null; chapter: Chapter | null } {
  if (!lessonId) return { lesson: null, chapter: null };
  for (const ch of course.chapters) {
    for (const l of ch.lessons) {
      if (l.id === lessonId) return { lesson: l, chapter: ch };
    }
  }
  return { lesson: null, chapter: null };
}

// Activity heat map data logic
export function activityByDay(course: Course, days: number = 14): { key: string; label: string; count: number }[] {
  const base = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: 0 };
  });

  const map = new Map(base.map(d => [d.key, d]));
  const allLessonsList = course.chapters.flatMap(ch => ch.lessons);

  allLessonsList.forEach(l => {
    (l.attempts || []).forEach(a => {
      const item = map.get(String(a.at || "").slice(0, 10));
      if (item) item.count++;
    });
    (l.questions || []).forEach(q => {
      const item = map.get(String(q.at || "").slice(0, 10));
      if (item) item.count++;
    });
  });

  (course.flashcards || []).forEach(c => {
    const item = map.get(String(c.lastReviewedAt || "").slice(0, 10));
    if (item) item.count++;
  });

  course.chapters.forEach(ch => {
    const item = map.get(String(ch.examResult?.at || "").slice(0, 10));
    if (item) item.count++;
  });

  if (course.finalExamResult) {
    const finalItem = map.get(String(course.finalExamResult.at || "").slice(0, 10));
    if (finalItem) finalItem.count++;
  }

  return base;
}

export function learningAnalytics(course: Course) {
  const lessons = course.chapters.flatMap(ch => ch.lessons);
  const attempts = lessons.flatMap(l =>
    (l.attempts || []).filter(a => a.type === "explain-back").map(a => ({ ...a, lesson: l }))
  );
  const questions = lessons.flatMap(l => (l.questions || []).map(q => ({ ...q, lesson: l })));
  const cards = ensureFlashcards(course);
  const completed = lessons.filter(l => l.completed).length;
  const avgScore = Math.round(lessons.reduce((s, l) => s + (l.score || 0), 0) / (lessons.length || 1));
  const examResults = course.chapters
    .map(ch => ch.examResult)
    .filter(Boolean)
    .concat(course.finalExamResult ? [course.finalExamResult] : []);
  const avgExam = examResults.length
    ? Math.round(examResults.reduce((s, e) => s + (e!.score || 0), 0) / examResults.length)
    : 0;
  const weak = weakTopics(course);
  const due = dueFlashcards(course);
  const learnedCards = cards.filter(c => c.status === "learned").length;
  const retention = cards.length ? Math.round((learnedCards / cards.length) * 100) : 0;
  const activity = activityByDay(course, 14);

  const chapterStats = course.chapters.map(ch => {
    const ls = ch.lessons || [];
    return {
      title: ch.title,
      completed: ls.filter(l => l.completed).length,
      total: ls.length,
      avg: Math.round(ls.reduce((s, l) => s + (l.score || 0), 0) / (ls.length || 1)),
      exam: ch.examResult?.score || 0,
      weak: [...new Set(ls.flatMap(l => l.weakConcepts || []))]
    };
  });

  return { lessons, attempts, questions, cards, completed, avgScore, avgExam, weak, due, retention, activity, chapterStats };
}

export function studyRecommendation(course: Course, a: any): string {
  if (!a.lessons.length) return "Create a course and start the first lesson.";
  if (a.due.length) return `Review ${a.due.length} due flashcard(s) before learning new material.`;
  if (a.weak.length) return `Focus on weak topic: "${a.weak[0]}". Explain it out loud, then retake its lesson check.`;
  const lessons = course.chapters.flatMap(ch => ch.lessons);
  const next = lessons.find(l => !l.locked && !l.completed) || lessons[0];
  if (next && !next.completed) return `Continue with: "${next.title}". Ask at least one question before testing.`;
  if (!course.finalExamResult?.passed) return "Prepare for the final exam by using Teach the AI mode and reviewing chapter exams.";
  return "Course complete! Keep cards in spaced review to maintain memory retention.";
}

export function getLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calculateDailyStreak(courseOrCourses: Course | Course[] | null): number {
  if (!courseOrCourses) return 0;
  const coursesList = Array.isArray(courseOrCourses) ? courseOrCourses : [courseOrCourses];
  const dates = new Set<string>();

  coursesList.forEach(course => {
    course.chapters.forEach(ch => {
      ch.lessons.forEach(l => {
        if (l.completed) {
          if (l.completedAt) {
            const localStr = getLocalDateStrFromISO(l.completedAt);
            if (localStr) dates.add(localStr);
          } else if (l.attempts && l.attempts.length > 0) {
            const passedAttempt = l.attempts.find(a => a.result?.passed);
            if (passedAttempt && passedAttempt.at) {
              const localStr = getLocalDateStrFromISO(passedAttempt.at);
              if (localStr) dates.add(localStr);
            } else {
              const firstAt = l.attempts[0]?.at;
              if (firstAt) {
                const localStr = getLocalDateStrFromISO(firstAt);
                if (localStr) dates.add(localStr);
              }
            }
          } else {
            if (course.createdAt) {
              const localStr = getLocalDateStrFromISO(course.createdAt);
              if (localStr) dates.add(localStr);
            }
          }
        }
      });
    });
  });

  let streak = 0;
  let checkDate = new Date();

  const hasToday = dates.has(getLocalDateString(checkDate));
  const prev = new Date();
  prev.setDate(prev.getDate() - 1);
  const hasYesterday = dates.has(getLocalDateString(prev));

  if (hasToday || hasYesterday) {
    if (!hasToday) {
      checkDate = prev;
    }
    while (true) {
      const checkStr = getLocalDateString(checkDate);
      if (dates.has(checkStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return streak;
}

function getLocalDateStrFromISO(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return getLocalDateString(d);
  } catch {
    return "";
  }
}

import React, { useState } from "react";
import { Course } from "../types";
import { courseProgress } from "../utils";
import { 
  ArrowUpDown, 
  SlidersHorizontal, 
  CheckSquare, 
  Layers, 
  Clock, 
  BookOpen,
  Lock,
  Unlock,
  Award,
  Sparkles,
  TrendingUp,
  ListOrdered
} from "lucide-react";

interface OutlineProps {
  course: Course;
  onOpenLesson: (lessonId: string) => void;
  onOpenExam: (chapterId: string) => void;
  onDeleteCourse?: (courseId: string) => void;
}

export default function Outline({ course, onOpenLesson, onOpenExam, onDeleteCourse }: OutlineProps) {
  const progress = courseProgress(course);

  // Sorting state for Chapters & Lessons
  const [chapterSort, setChapterSort] = useState<"chrono" | "progress-asc" | "progress-desc" | "lessons-count" | "unlocked-first">("chrono");
  const [lessonSort, setLessonSort] = useState<"chrono" | "incomplete-first" | "score-asc">("chrono");

  // Prep chapters with calculated metadata for sorting
  const sortedChapters = course.chapters.map((chapter, originalIndex) => {
    const totalLessons = chapter.lessons.length;
    const completedLessons = chapter.lessons.filter(l => l.completed).length;
    const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    
    return {
      ...chapter,
      originalIndex,
      totalLessons,
      completedLessons,
      progressPct
    };
  });

  // Apply Chapter sorting logic
  if (chapterSort === "progress-asc") {
    sortedChapters.sort((a, b) => a.progressPct - b.progressPct || a.originalIndex - b.originalIndex);
  } else if (chapterSort === "progress-desc") {
    sortedChapters.sort((a, b) => b.progressPct - a.progressPct || a.originalIndex - b.originalIndex);
  } else if (chapterSort === "lessons-count") {
    sortedChapters.sort((a, b) => b.totalLessons - a.totalLessons || a.originalIndex - b.originalIndex);
  } else if (chapterSort === "unlocked-first") {
    sortedChapters.sort((a, b) => {
      if (a.locked === b.locked) return a.originalIndex - b.originalIndex;
      return a.locked ? 1 : -1; // Unlocked chapters first
    });
  }

  // Get active lessons sorted
  const getSortedLessons = (lessons: typeof course.chapters[0]["lessons"]) => {
    const lessonsWithIndex = lessons.map((lesson, originalLessonIndex) => ({
      ...lesson,
      originalLessonIndex
    }));

    if (lessonSort === "incomplete-first") {
      lessonsWithIndex.sort((a, b) => {
        if (a.completed === b.completed) return a.originalLessonIndex - b.originalLessonIndex;
        return a.completed ? 1 : -1; // Incomplete lessons first
      });
    } else if (lessonSort === "score-asc") {
      lessonsWithIndex.sort((a, b) => {
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        return scoreA - scoreB || a.originalLessonIndex - b.originalLessonIndex;
      });
    }

    return lessonsWithIndex;
  };

  return (
    <div id="outline-view" className="space-y-6">
      <div className="topbar">
        <div>
          <h2>{course.title}</h2>
          <p>{course.summary}</p>
        </div>
        {onDeleteCourse && (
          <button
            className="btn ghost text-xs py-1.5 px-3 border-red-200 text-red-500 hover:bg-red-50 flex items-center gap-1.5 shrink-0"
            style={{ minHeight: "fit-content" }}
            type="button"
            onClick={() => onDeleteCourse(course.id)}
            id="delete-course-detail-btn"
          >
            <span>🗑️</span> Delete Course
          </button>
        )}
      </div>

      {/* Course Progress Section */}
      <div className="card" id="outline-progress">
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-sm">Course Completion Progress</span>
          <span className="font-extrabold text-indigo-600 dark:text-cyan-400">{progress}%</span>
        </div>
        <div className="progress">
          <div style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* NEW INTERACTIVE SYLLABUS SORT PANEL */}
      <div className="card p-5 border border-indigo-100/60 dark:border-indigo-950/60 bg-gradient-to-r from-indigo-50/20 to-cyan-50/20 dark:from-indigo-950/5 dark:to-cyan-950/5 rounded-2xl">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
          <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs uppercase tracking-widest font-extrabold text-indigo-950 dark:text-cyan-400">
            Syllabus Navigation & Sort controls
          </h4>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* Chapter sorting selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> Sort Chapters by:
            </label>
            <select
              value={chapterSort}
              onChange={(e) => setChapterSort(e.target.value as any)}
              className="w-full bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 dark:text-stone-300 focus:border-cyan-500 outline-none cursor-pointer"
            >
              <option value="chrono">📖 Chronological Order (Default)</option>
              <option value="progress-asc">📈 Completion Progress (Incomplete First)</option>
              <option value="progress-desc">📉 Completion Progress (Most Done First)</option>
              <option value="lessons-count">🏋️ Chapter Depth (Most Lessons First)</option>
              <option value="unlocked-first">🔓 Unlocked / Available Chapters First</option>
            </select>
          </div>

          {/* Lesson sorting selection */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-cyan-500" /> Sort Lessons inside Chapters by:
            </label>
            <select
              value={lessonSort}
              onChange={(e) => setLessonSort(e.target.value as any)}
              className="w-full bg-white dark:bg-gray-850 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-xs font-medium text-gray-700 dark:text-stone-300 focus:border-cyan-500 outline-none cursor-pointer"
            >
              <option value="chrono">🔢 Chronological Sequence (Default)</option>
              <option value="incomplete-first">⏳ Study Needed (Uncompleted Lessons First)</option>
              <option value="score-asc">🧠 Performance Review (Lowest Practice Score First)</option>
            </select>
          </div>
        </div>
        
        {/* Active Order Badge Indicator */}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold font-mono">
          <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
          <span>Active View:</span>
          <span className="bg-white dark:bg-gray-850 px-2.5 py-0.5 rounded border border-gray-100 dark:border-gray-800">
            Chapters: {chapterSort === "chrono" ? "Chronological" : chapterSort === "progress-asc" ? "Progress Low-to-High" : chapterSort === "progress-desc" ? "Progress High-to-Low" : chapterSort === "lessons-count" ? "Lesson Depth" : "Unlocked First"}
          </span>
          <span>•</span>
          <span className="bg-white dark:bg-gray-850 px-2.5 py-0.5 rounded border border-gray-100 dark:border-gray-800">
            Lessons: {lessonSort === "chrono" ? "Sequence order" : lessonSort === "incomplete-first" ? "Incomplete first" : "Low Score first"}
          </span>
        </div>
      </div>

      <div className="grid gap-6">
        {sortedChapters.map((ch) => {
          // Check if all lessons are completed in this chapter to allow unlocking exam
          const allCompleted = ch.lessons.length > 0 && ch.lessons.every(l => l.completed);
          const isExamUnlocked = allCompleted || ch.examUnlocked;

          const sortedLessonsForCh = getSortedLessons(ch.lessons);

          return (
            <section className="card flex flex-col gap-4 relative overflow-hidden" key={ch.id} id={`chapter-${ch.id}`}>
              {/* Highlight badge for chapter metadata */}
              <div className="absolute right-0 top-0 opacity-5 dark:opacity-[0.03] translate-x-4 -translate-y-4 select-none pointer-events-none text-7xl font-mono font-black">
                {ch.originalIndex + 1}
              </div>

              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h3 className="text-xl flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-cyan-300 px-2 py-0.5 rounded-md border border-indigo-100/10 shrink-0">
                      Ch. {ch.originalIndex + 1}
                    </span>
                    <span className="font-bold text-gray-950 dark:text-stone-100 text-lg">{ch.title}</span>
                  </h3>
                  <p className="text-sm! text-gray-500 max-w-2xl mt-1 leading-relaxed">{ch.summary}</p>
                  
                  {/* Progress Indicator within chapter */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-gray-400 font-mono">
                      Progress: {ch.completedLessons}/{ch.totalLessons} Lessons ({ch.progressPct}%)
                    </span>
                    <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${ch.progressPct}%` }}></div>
                    </div>
                  </div>
                </div>

                <span className={`badge ${ch.locked ? "gray" : "blue"}`}>
                  {ch.locked ? "Locked" : "Available"}
                </span>
              </div>

              <div className="lesson-list mt-2">
                {sortedLessonsForCh.map((l) => {
                  return (
                    <div
                      className={`lesson-item ${l.locked ? "locked" : ""}`}
                      key={l.id}
                      id={`lesson-${l.id}`}
                    >
                      <div>
                        <h4 className="flex items-center gap-2">
                          <span className="text-indigo-600 dark:text-cyan-400 select-none shrink-0">
                            {l.completed ? "✅" : l.locked ? "🔒" : "▶"}
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-400 shrink-0">
                            [{ch.originalIndex + 1}.{l.originalLessonIndex + 1}]
                          </span>
                          <span className="font-semibold text-gray-950 dark:text-stone-100">{l.title}</span>
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Focus: <b className="text-gray-700 dark:text-stone-300 font-bold">{l.mainConcept}</b> {l.score > 0 && `• Best practice score: ${l.score}%`}
                        </p>
                      </div>

                      <button
                        className={`btn ${l.locked ? "ghost" : ""}`}
                        disabled={l.locked}
                        type="button"
                        onClick={() => onOpenLesson(l.id)}
                      >
                        {l.completed ? "Review" : "Study"}
                      </button>
                    </div>
                  );
                })}

                <div className={`lesson-item border-dashed border-indigo-200 bg-indigo-50/20 ${isExamUnlocked ? "" : "locked"}`}>
                  <div>
                    <h4 className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
                      <span>{ch.examResult?.passed ? "✅" : isExamUnlocked ? "🟣" : "🔒"}</span>
                      <span className="text-xs font-mono font-bold text-indigo-500 dark:text-indigo-400 shrink-0">
                        Exam {ch.originalIndex + 1}
                      </span>
                      <span>Chapter {ch.originalIndex + 1} Assessment Exam</span>
                    </h4>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                      Requires all lessons completed • Passing score: 85% •{" "}
                      {ch.examResult ? `Latest score: ${ch.examResult.score}%` : "Not taken yet"}
                    </p>
                  </div>

                  <button
                    className="btn purple"
                    disabled={!isExamUnlocked}
                    type="button"
                    onClick={() => onOpenExam(ch.id)}
                  >
                    {ch.examResult?.passed ? "Retake Exam" : "Take Exam"}
                  </button>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

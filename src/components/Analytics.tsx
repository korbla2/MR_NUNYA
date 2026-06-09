import React from "react";
import { Course } from "../types";
import {
  learningAnalytics,
  studyRecommendation,
  weakTopics,
} from "../utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Reactive helper hook to detect changes to dark/light theme dynamically
function useIsDark() {
  const [isDark, setIsDark] = React.useState(() => {
    return document.documentElement.getAttribute("data-theme") === "dark";
  });

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 rounded-xl shadow-lg text-xs leading-relaxed max-w-[240px]">
        <p className="font-bold text-gray-800 dark:text-gray-100 mb-1.5">{data.dateStr}</p>
        <div className="flex justify-between items-center gap-4 py-1 border-b border-gray-100 dark:border-gray-700/60 mb-1.5">
          <span className="text-gray-400 dark:text-gray-400 font-medium font-semibold">Study Duration:</span>
          <span className="font-extrabold text-indigo-600 dark:text-indigo-400 font-bold">{data.minutes} min(s)</span>
        </div>
        {(data.lessonsCount > 0 || data.attemptsCount > 0 || data.questionsCount > 0 || data.cardsCount > 0 || data.examsCount > 0) ? (
          <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-1 space-y-0.5">
            {data.lessonsCount > 0 && <div className="flex items-center gap-1">📖 <span>{data.lessonsCount} lesson(s) read</span></div>}
            {data.attemptsCount > 0 && <div className="flex items-center gap-1">🎙️ <span>{data.attemptsCount} feynman check(s)</span></div>}
            {data.questionsCount > 0 && <div className="flex items-center gap-1">❓ <span>{data.questionsCount} tutor question(s)</span></div>}
            {data.cardsCount > 0 && <div className="flex items-center gap-1">🗂️ <span>{data.cardsCount} card(s) reviewed</span></div>}
            {data.examsCount > 0 && <div className="flex items-center gap-1">✍️ <span>{data.examsCount} exam(s) finished</span></div>}
          </div>
        ) : (
          <p className="text-[10px] italic text-gray-400">No active events logged</p>
        )}
      </div>
    );
  }
  return null;
};

interface AnalyticsProps {
  course: Course;
  onOpenLesson: (lessonId: string) => void;
  onBackToOutline: () => void;
}

export default function Analytics({
  course,
  onOpenLesson,
  onBackToOutline,
}: AnalyticsProps) {
  const a = learningAnalytics(course);
  const maxActivity = Math.max(1, ...a.activity.map(d => d.count));
  const isDark = useIsDark();

  const studyTimeData = React.useMemo(() => {
    const daysToShow = 14;
    const base = Array.from({ length: daysToShow }, (_, i) => {
      const d = new Date(Date.now() - (daysToShow - 1 - i) * 86400000);
      const key = d.toISOString().slice(0, 10);
      return {
        key,
        dateStr: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        minutes: 0,
        lessonsCount: 0,
        attemptsCount: 0,
        questionsCount: 0,
        cardsCount: 0,
        examsCount: 0,
      };
    });

    const map = new Map(base.map(d => [d.key, d]));
    const allLessons = course.chapters.flatMap(ch => ch.lessons);

    allLessons.forEach(l => {
      if (l.completed && l.completedAt) {
        const item = map.get(l.completedAt.slice(0, 10));
        if (item) {
          item.minutes += 12; // 12 minutes for reading a full lesson
          item.lessonsCount++;
        }
      }
      
      (l.attempts || []).forEach(at => {
        const item = map.get(String(at.at || "").slice(0, 10));
        if (item) {
          item.minutes += 8; // 8 minutes for typing/submitting a feynman explanation
          item.attemptsCount++;
        }
      });

      (l.questions || []).forEach(q => {
        const item = map.get(String(q.at || "").slice(0, 10));
        if (item) {
          item.minutes += 4; // 4 minutes per active question & tutor discussion
          item.questionsCount++;
        }
      });
    });

    (course.flashcards || []).forEach(c => {
      if (c.lastReviewedAt) {
        const item = map.get(c.lastReviewedAt.slice(0, 10));
        if (item) {
          item.minutes += 1.5; // 1.5 minutes per flashcard review
          item.cardsCount++;
        }
      }
    });

    course.chapters.forEach(ch => {
      if (ch.examResult?.at) {
        const item = map.get(ch.examResult.at.slice(0, 10));
        if (item) {
          item.minutes += 20; // 20 minutes for a comprehensive chapter exam
          item.examsCount++;
        }
      }
    });

    if (course.finalExamResult?.at) {
      const item = map.get(course.finalExamResult.at.slice(0, 10));
      if (item) {
        item.minutes += 30; // 30 minutes for the final course exam
        item.examsCount++;
      }
    }

    return base.map(b => ({
      ...b,
      minutes: Math.round(b.minutes),
    }));
  }, [course]);

  // Determine study alert levels
  const riskLevel =
    a.avgScore < 70 || a.weak.length > 3 || a.due.length > 10
      ? "High Risk"
      : a.avgScore < 85 || a.weak.length > 0 || a.due.length > 2
      ? "Medium Risk"
      : "Low Risk";

  const nextStep = studyRecommendation(course, a);

  // Helper row builder for weak concepts rows
  const renderWeakRow = (concept: string) => {
    const lessons = course.chapters
      .flatMap(ch => ch.lessons)
      .filter(l => (l.weakConcepts || []).includes(concept));

    const avg = lessons.length
      ? Math.round(lessons.reduce((s, l) => s + (l.score || 0), 0) / lessons.length)
      : 0;

    const severityClass =
      lessons.length > 2 || avg < 60
        ? "high"
        : avg < 80
        ? "medium"
        : "low";

    return (
      <div
        className={`weak-row ${severityClass} flex items-center justify-between p-3 border rounded-xl`}
        key={concept}
        id={`weak-idea-${concept}`}
      >
        <div>
          <b className="font-extrabold text-sm">{concept}</b>
          <span className="block text-xs text-gray-500">
            {lessons.length} related syllabus unit(s) • avg score: {avg}%
          </span>
        </div>
        {lessons[0] && (
          <button
            className="btn ghost text-xs py-1 px-3 min-h-fit"
            type="button"
            onClick={() => onOpenLesson(lessons[0].id)}
          >
            Review Module
          </button>
        )}
      </div>
    );
  };

  return (
    <div id="analytics-view">
      <div className="topbar">
        <div>
          <h2>Learning Analytics</h2>
          <p>
            Track detailed intuitive performance metrics, concept heatmap overlays, and recommended steps.
          </p>
        </div>
        <button className="btn ghost" type="button" onClick={onBackToOutline}>
          View Outline
        </button>
      </div>

      {/* Recommended Box */}
      <section className="card insight-card p-4 rounded-2xl mb-6 shadow-sm">
        <h3 className="text-lg font-bold text-indigo-800 dark:text-indigo-300">
          💡 Recommended Learning Step
        </h3>
        <p className="text-gray-700 dark:text-gray-200 mt-2 select-text">{nextStep}</p>
      </section>

      {/* Grid stats */}
      <div className="grid four mb-6 gap-4" id="analytics-stats">
        <div className="stat p-4 flex flex-col gap-1 rounded-2xl border">
          <span className="small text-gray-500 block">Comprehension score</span>
          <b className="text-indigo-600 dark:text-cyan-400 text-3xl font-black">{a.avgScore}%</b>
          <p className="text-[10px] text-gray-400">Average syllabus score</p>
        </div>

        <div className="stat p-4 flex flex-col gap-1 rounded-2xl border">
          <span className="small text-gray-500 block">Curriculum mastery</span>
          <b className="text-green-600 text-3xl font-black">
            {a.completed} / {a.lessons.length}
          </b>
          <p className="text-[10px] text-gray-400">Completed lessons</p>
        </div>

        <div className="stat p-4 flex flex-col gap-1 rounded-2xl border">
          <span className="small text-gray-500 block">Information retention</span>
          <b className="text-[#818cf8] text-3xl font-black">{a.retention}%</b>
          <p className="text-[10px] text-gray-400">SRS cards learned index</p>
        </div>

        <div className="stat p-4 flex flex-col gap-1 rounded-2xl border">
          <span className="small text-gray-500 block">Overdue risk level</span>
          <b
            className={`text-3xl font-black ${
              riskLevel === "High Risk"
                ? "text-red-600"
                : riskLevel === "Medium Risk"
                ? "text-amber-500"
                : "text-emerald-500"
            }`}
          >
            {riskLevel}
          </b>
          <p className="text-[10px] text-gray-400">Based on weaknesses & reviews</p>
        </div>
      </div>

      <div className="grid two gap-6 mb-6">
        {/* CSS Chart */}
        <section className="card" id="analytics-chart-panel">
          <h3 className="mb-2">14-Day Study Engagement Heatmap</h3>
          <div className="bar-chart flex items-end justify-between border-b pb-4 gap-2">
            {a.activity.map(d => {
              const val = Math.max(4, Math.round((d.count / maxActivity) * 130));
              return (
                <div className="bar-col text-center" key={d.key}>
                  <div
                    className="bar cursor-pointer"
                    style={{ height: `${val}px` }}
                    title={`${d.count} feynman exercises completed`}
                  ></div>
                  <span className="text-[9px] block text-gray-400 mt-2 rotate-[-25deg]">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-6 leading-relaxed">
            Consolidates active prompts answered, chat clarifications, chapter quizzes submitted, and spaced card reviews.
          </p>
        </section>

        {/* Heatmap overlay lists */}
        <section className="card flex flex-col gap-4" id="analytics-weakness-panel">
          <h3>Unresolved Weak Area Heatmap</h3>
          <div className="weak-list flex-1 overflow-y-auto max-h-56 gap-2">
            {a.weak.length > 0 ? (
              a.weak.map(w => renderWeakRow(w))
            ) : (
              <div className="text-center italic select-none py-8 text-gray-400">
                🟢 Clean slate! No current conceptual weaknesses mapped.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Recharts Daily Study Time Analytics */}
      <section className="card mb-6" id="analytics-study-time-panel">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
              📊 <span>Daily Study Time (Minutes)</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Interactive session tracking calculated from lesson comprehension checks, flashcards, tutor dialogues, and assessments.
            </p>
          </div>
          <div className="flex gap-4 items-center self-start md:self-auto bg-gray-50/50 dark:bg-gray-850 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-bold leading-none mb-1">Total Minutes</span>
              <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                {Math.round(studyTimeData.reduce((sum, d) => sum + d.minutes, 0))}m
              </span>
            </div>
            <div className="border-l border-gray-200 dark:border-gray-700 pl-4 text-right">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block font-bold leading-none mb-1">Daily Avg</span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                {Math.round(studyTimeData.reduce((sum, d) => sum + d.minutes, 0) / studyTimeData.length)}m
              </span>
            </div>
          </div>
        </div>

        <div className="h-64 w-full mt-2" id="recharts-bar-chart-container" style={{ minHeight: "240px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={studyTimeData}
              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorMinutesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isDark ? "#38bdf8" : "#4f46e5"} stopOpacity={0.9} />
                  <stop offset="95%" stopColor={isDark ? "#818cf8" : "#6366f1"} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"}
              />
              <XAxis
                dataKey="dateStr"
                tick={{ fill: isDark ? "#94a3b8" : "#4b5563", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: isDark ? "#94a3b8" : "#4b5563", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                unit="m"
                width={35}
              />
              <Tooltip
                cursor={{ fill: isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(99, 102, 241, 0.03)", radius: [4, 4, 0, 0] }}
                content={<CustomTooltip />}
              />
              <Bar
                dataKey="minutes"
                name="Duration"
                radius={[4, 4, 0, 0]}
              >
                {studyTimeData.map((entry, idx) => {
                  const isCurrentDay = idx === studyTimeData.length - 1;
                  return (
                    <Cell
                      key={`cell-${idx}`}
                      fill="url(#colorMinutesGrad)"
                      stroke={isCurrentDay ? (isDark ? "#38bdf8" : "#4f46e5") : undefined}
                      strokeWidth={isCurrentDay ? 1.5 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card my-6" id="analytics-mastery-panel">
        <h3 className="mb-4">Chapters Comprehensive Mastery Rates</h3>
        <div className="analytics-table flex flex-col gap-2">
          <div className="table-row head border-b pb-2 font-black text-gray-800 dark:text-gray-300">
            <span>Module Name</span>
            <span>Lessons Done</span>
            <span>Avg score</span>
            <span>Assessed Grade</span>
            <span>Unresolved Weakpoints</span>
          </div>

          {a.chapterStats.map((ch, idx) => (
            <div className="table-row border p-3 rounded-xl bg-white" key={idx}>
              <span className="font-bold truncate max-w-xs">{ch.title}</span>
              <span className="text-sm">
                {ch.completed} / {ch.total}
              </span>
              <span className="text-sm font-semibold">{ch.avg}%</span>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {ch.exam > 0 ? `${ch.exam}%` : "Not assessed"}
              </span>
              <span className="flex flex-wrap gap-1 max-w-[240px]">
                {ch.weak.length > 0 ? (
                  ch.weak.slice(0, 3).map((w, idx2) => (
                    <em className="text-xs px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-full font-medium" key={idx2}>
                      {w}
                    </em>
                  ))
                ) : (
                  <em className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full font-medium ok">
                    clear
                  </em>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" id="analytics-breakdowns">
        <h3>Intuitive Study Metrics Breakdown</h3>
        <div className="grid two gap-6 mt-4 text-sm" id="breakdowns">
          <div>
            <div className="kv py-2 border-b">
              <b>Chat Queries:</b>
              <span>{a.questions.length} asked</span>
            </div>
            <div className="kv py-2 border-b">
              <b>Test Attempts:</b>
              <span>{a.attempts.length} graded</span>
            </div>
          </div>
          <div>
            <div className="kv py-2 border-b">
              <b>SRS Cards Due:</b>
              <span>{a.due.length} remaining</span>
            </div>
            <div className="kv py-2 border-b">
              <b>Overall Exam Average:</b>
              <span>{a.avgExam}% achieved</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

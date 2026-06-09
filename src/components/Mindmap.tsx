import React, { useState } from "react";
import { Course, Lesson } from "../types";
import { courseProgress, weakTopics } from "../utils";

interface MindmapProps {
  course: Course;
  onOpenLesson: (lessonId: string) => void;
  onOpenExam: (chapterId: string) => void;
  onOpenFinal: () => void;
}

export default function Mindmap({
  course,
  onOpenLesson,
  onOpenExam,
  onOpenFinal,
}: MindmapProps) {
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState("");

  const updateZoom = (delta: number) => {
    setZoom(prev => Math.max(0.55, Math.min(1.7, prev + delta)));
  };

  const handleClear = () => {
    setFilter("");
  };

  const handleFocusWeak = () => {
    const weaks = weakTopics(course);
    if (weaks.length) {
      setFilter(weaks[0]);
    } else {
      setFilter("weak");
    }
  };

  const lessonMatches = (l: Lesson, query: string) => {
    if (!query) return true;
    const fQuery = query.toLowerCase();
    return (
      `${l.title} ${l.mainConcept} ${l.simpleExplanation} ${(l.keyTerms || []).join(" ")} ${(l.weakConcepts || []).join(" ")}`
        .toLowerCase()
        .includes(fQuery)
    );
  };

  const chapters = course.chapters || [];
  const width = Math.max(1050, 260 + chapters.length * 300);
  const maxLessonsCount = Math.max(...chapters.map(ch => ch.lessons.length), 1);
  const height = Math.max(650, 260 + maxLessonsCount * 105);

  const rootX = 70;
  const rootY = Math.round(height / 2) - 35;

  // Track coordinates to draw curving connection lines
  const chapterPositions = chapters.map((ch, ci) => ({
    ch,
    x: 320 + ci * 300,
    y: 105 + (ci % 2) * 70,
  }));

  // Generating cubic bezier line paths
  const mapLine = (x1: number, y1: number, x2: number, y2: number) => {
    const mid = Math.round((x1 + x2) / 2);
    return (
      <path
        key={`line-${x1}-${y1}-${x2}-${y2}`}
        d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
        fill="none"
        stroke="#cbd5e1"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
    );
  };

  return (
    <div id="mindmap-view">
      <div className="topbar">
        <div>
          <h2>Mind Map</h2>
          <p>
            An interactive network representing core knowledge branches. Nodes reflect real-time comprehension scores.
          </p>
        </div>
        <div className="row">
          <button className="btn ghost" type="button" onClick={() => updateZoom(-0.1)}>
            − Zoom Out
          </button>
          <button className="btn ghost" type="button" onClick={() => setZoom(1)}>
            Reset
          </button>
          <button className="btn ghost" type="button" onClick={() => updateZoom(0.1)}>
            + Zoom In
          </button>
        </div>
      </div>

      <div className="card mb-4" id="map-controls">
        <div className="row justify-between w-full flex-wrap gap-2">
          <div className="flex gap-2 items-center flex-1 max-w-md">
            <input
              id="map-filter"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search concepts, key terms, or weaknesses..."
            />
            {filter && (
              <button className="btn ghost" type="button" onClick={handleClear}>
                Clear
              </button>
            )}
          </div>
          <div className="row gap-2">
            <button className="btn ghost" type="button" onClick={handleFocusWeak}>
              Focus Weak Area
            </button>
            <span className="badge gray">Zoom {Math.round(zoom * 100)}%</span>
            <span className="badge blue">Click nodes to study</span>
          </div>
        </div>
      </div>

      <section className="card map-stage" id="map-stage">
        <div
          className="map-canvas"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${width}px`,
            height: `${height}px`,
          }}
        >
          {/* Connection Lines */}
          <svg className="map-lines" width={width} height={height}>
            {chapterPositions.map(({ ch, x, y }) => {
              const lines = [];
              // Root node to chapters
              lines.push(mapLine(rootX + 230, rootY + 39, x, y + 32));

              // Chapters to lessons
              ch.lessons.forEach((l, li) => {
                lines.push(mapLine(x + 210, y + 32, x + 40, y + 105 + li * 98 + 32));
              });

              // Chapters to chapter exams
              lines.push(
                mapLine(x + 210, y + 32, x + 40, y + 115 + ch.lessons.length * 98 + 32)
              );
              return lines;
            })}
          </svg>

          {/* Root node */}
          <div className="map-card root" style={{ left: `${rootX}px`, top: `${rootY}px` }}>
            <b>📘 {course.title}</b>
            <span>{courseProgress(course)}% complete</span>
          </div>

          {/* Chapter & Lesson Cards */}
          {chapterPositions.map(({ ch, x, y }, ci) => {
            const chMatch =
              !filter.trim() ||
              `${ch.title} ${ch.summary}`.toLowerCase().includes(filter.toLowerCase()) ||
              ch.lessons.some(l => lessonMatches(l, filter));

            if (!chMatch) return null;

            const allCompleted = ch.lessons.length > 0 && ch.lessons.every(l => l.completed);
            const isExamUnlocked = allCompleted || ch.examUnlocked;

            return (
              <React.Fragment key={ch.id}>
                {/* Chapter Card */}
                <div
                  className={`map-card chapter ${ch.locked ? "locked" : "available"}`}
                  style={{ left: `${x}px`, top: `${y}px` }}
                >
                  <b>📂 Chapter {ci + 1}</b>
                  <span>{ch.title}</span>
                </div>

                {/* Lesson Nodes */}
                {ch.lessons.map((l, li) => {
                  if (filter.trim() && !lessonMatches(l, filter) && !ch.title.toLowerCase().includes(filter.toLowerCase())) {
                    return null;
                  }

                  const statusClass = l.completed
                    ? "completed"
                    : l.weakConcepts?.length
                    ? "weak"
                    : l.locked
                    ? "locked"
                    : "available";

                  return (
                    <button
                      className={`map-card lesson ${statusClass}`}
                      disabled={l.locked}
                      type="button"
                      key={l.id}
                      onClick={() => onOpenLesson(l.id)}
                      style={{ left: `${x + 40}px`, top: `${y + 105 + li * 98}px` }}
                    >
                      <b>
                        {l.completed ? "✅" : l.locked ? "🔒" : l.weakConcepts?.length ? "🔴" : "🔵"}{" "}
                        {l.title}
                      </b>
                      <span>
                        {l.mainConcept} • {l.score}%
                      </span>
                      {l.weakConcepts?.length ? (
                        <em className="truncate max-w-full block">Review: {l.weakConcepts.join(", ")}</em>
                      ) : null}
                    </button>
                  );
                })}

                {/* Chapter Exam Node */}
                <button
                  className={`map-card exam ${isExamUnlocked ? "" : "locked"}`}
                  disabled={!isExamUnlocked}
                  type="button"
                  onClick={() => onOpenExam(ch.id)}
                  style={{ left: `${x + 40}px`, top: `${y + 115 + ch.lessons.length * 98}px` }}
                >
                  <b>🟣 Chapter Exam</b>
                  <span>
                    {ch.examResult?.score || 0}% {ch.examResult?.passed ? "passed" : "required"}
                  </span>
                </button>
              </React.Fragment>
            );
          })}

          {/* Final Exam Node */}
          {(() => {
            const allChapterExamsPassed = chapters.every(ch => ch.examResult?.passed);
            return (
              <button
                className={`map-card exam ${allChapterExamsPassed ? "" : "locked"}`}
                disabled={!allChapterExamsPassed}
                type="button"
                onClick={onOpenFinal}
                style={{
                  left: `${width - 250}px`,
                  top: `${height - 115}px`,
                }}
              >
                <b>🏁 Final Exam</b>
                <span>
                  {course.finalExamResult?.passed
                    ? "Complete"
                    : "Locked until chapters passed"}
                </span>
              </button>
            );
          })()}
        </div>
      </section>

      <div className="card mt-4" id="map-legend">
        <div className="row gap-3 flex-wrap justify-center text-sm">
          <b>Legend:</b>
          <span className="badge gray">Gray: Locked</span>
          <span className="badge blue">Blue: Available</span>
          <span className="badge green">Green: Mastered</span>
          <span className="badge yellow">Yellow: In Spaced Review</span>
          <span className="badge red">Red: Weakness Flagged</span>
          <span className="badge purple">Purple: Examinations</span>
        </div>
      </div>
    </div>
  );
}

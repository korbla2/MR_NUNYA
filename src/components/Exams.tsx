import React, { useState } from "react";
import { Course, Chapter, AISettings, ExamResult } from "../types";
import { weakTopics, uid } from "../utils";
import confetti from "canvas-confetti";

export function fireConfetti() {
  // First burst (center-ish)
  confetti({
    particleCount: 140,
    spread: 80,
    origin: { y: 0.55 },
    colors: ["#6366f1", "#4f46e5", "#10b981", "#3b82f6", "#f59e0b", "#ec4899"],
  });

  // Second burst (left cannon)
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.75 },
      colors: ["#6366f1", "#4f46e5", "#10b981"],
    });
  }, 200);

  // Third burst (right cannon)
  setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.75 },
      colors: ["#10b981", "#3b82f6", "#f59e0b"],
    });
  }, 350);

  // Extra sprinkles over 1.5s
  const end = Date.now() + 1500;
  const colors = ["#818cf8", "#34d399", "#fbbf24", "#f472b6"];

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors,
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

interface ExamsProps {
  course: Course;
  activeExamChapterId: string | null;
  settings: AISettings;
  onUpdateCourse: (course: Course) => void;
  onSetChapterId: (id: string | null) => void;
  setBusy: (busy: boolean, notice?: string) => void;
}

export default function Exams({
  course,
  activeExamChapterId,
  settings,
  onUpdateCourse,
  onSetChapterId,
  setBusy,
}: ExamsProps) {
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const [showSuccessToast, setShowSuccessToast] = useState<{
    title: string;
    score: number;
    type: "chapter" | "final";
  } | null>(null);

  const allChapterExamsPassed = course.chapters.every(ch => ch.examResult?.passed);
  const showFinal = activeExamChapterId === "final";

  // Active Chapter being examined
  const activeChapter =
    course.chapters.find(ch => ch.id === activeExamChapterId) ||
    course.chapters.find(ch => ch.examUnlocked && !ch.examResult?.passed) ||
    course.chapters[0];

  const handleAnswerChange = (idx: number, value: string) => {
    setAnswers(prev => {
      const copy = [...prev];
      copy[idx] = value;
      return copy;
    });
  };

  const handleChapterExamSubmit = async (ch: Chapter) => {
    const combinedAnswers = answers.join("\n\n").trim();
    if (!combinedAnswers) {
      alert("Please write answers to standard questions before submitting.");
      return;
    }

    setBusy(true, `Grading Chapter "${ch.title}" assessment exam...`);

    try {
      const sourceMap = ch.lessons.map(l => `${l.mainConcept}: ${l.simpleExplanation}`).join("\n");
      const prompt = `Grade this student Chapter Exam using the Feynman Technique.
Focus on: can they explain all chapter themes in simple everyday terms, make connections, and illustrate with an example?
You must output RAW JSON complying exactly with this schema definition:
{
  "score": 0-100,
  "passed": boolean,
  "feedback": "Chapter review feedback...",
  "missingIdeas": ["omit 1"],
  "weakConcepts": ["weak term 1"]
}

Chapter: "${ch.title}"
Reference Material Context:\n${sourceMap}
Student Answers:\n${combinedAnswers}`;

      let rawResponse = "";
      if (settings.provider === "gemini") {
        const res = await fetch("/api/ai/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, json: true }),
        });
        if (res.ok) rawResponse = (await res.json()).text || "";
      } else if (settings.provider === "ollama") {
        const res = await fetch("/api/ai/ollama", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ollamaUrl: settings.ollamaUrl,
            model: settings.model || "qwen2.5:7b",
            prompt,
            json: true,
          }),
        });
        if (res.ok) rawResponse = (await res.json()).text || "";
      } else if (settings.provider === "openai-compatible") {
        const res = await fetch("/api/ai/openai-compatible", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiBase: settings.apiBase,
            apiKey: settings.apiKey,
            model: settings.paidModel || settings.model,
            prompt,
            json: true,
          }),
        });
        if (res.ok) rawResponse = (await res.json()).text || "";
      }

      let parsedResult = null;
      if (rawResponse) {
        try {
          parsedResult = JSON.parse(
            rawResponse
              .trim()
              .replace(/^```(?:json)?/i, "")
              .replace(/```$/i, "")
          );
        } catch (_) {}
      }

      if (!parsedResult) {
        parsedResult = generateLocalChapterGrade(combinedAnswers, ch);
      }

      const score = parsedResult.score ?? 50;
      const passed = score >= 85;

      const examResult: ExamResult = {
        score,
        passed,
        feedback: parsedResult.feedback || "Exam checked successfully.",
        missingIdeas: Array.isArray(parsedResult.missingIdeas) ? parsedResult.missingIdeas : [],
        weakConcepts: Array.isArray(parsedResult.weakConcepts) ? parsedResult.weakConcepts : [],
        answers: [...answers],
        at: new Date().toISOString(),
      };

      // Propagate locks updates
      const updatedChapters = course.chapters.map(elem => {
        if (elem.id === ch.id) {
          return { ...elem, examResult };
        }
        return elem;
      });

      // Unlock next chapter lock if exam passed!
      const currIdx = updatedChapters.findIndex(elem => elem.id === ch.id);
      if (passed && currIdx + 1 < updatedChapters.length) {
        const nextCh = updatedChapters[currIdx + 1];
        nextCh.locked = false;
        if (nextCh.lessons.length > 0) {
          nextCh.lessons[0].locked = false;
        }
      }

      onUpdateCourse({ ...course, chapters: updatedChapters });
      setAnswers(["", "", ""]);
      if (passed) {
        fireConfetti();
        setShowSuccessToast({
          title: ch.title,
          score,
          type: "chapter",
        });
      } else {
        alert("Review the material. You can retake the assessment exam anytime.");
      }
    } catch (err) {
      console.error(err);
      // fallback
      const mockResult = generateLocalChapterGrade(combinedAnswers, ch);
      const passed = mockResult.score >= 85;
      const examResult: ExamResult = {
        score: mockResult.score,
        passed,
        feedback: mockResult.feedback,
        missingIdeas: mockResult.missingIdeas,
        answers: [...answers],
        at: new Date().toISOString(),
      };
      const updatedChapters = course.chapters.map(elem => (elem.id === ch.id ? { ...elem, examResult } : elem));
      if (passed && currIdxOf(ch.id) + 1 < updatedChapters.length) {
        updatedChapters[currIdxOf(ch.id) + 1].locked = false;
        if (updatedChapters[currIdxOf(ch.id) + 1].lessons.length > 0) {
          updatedChapters[currIdxOf(ch.id) + 1].lessons[0].locked = false;
        }
      }
      onUpdateCourse({ ...course, chapters: updatedChapters });
      setAnswers(["", "", ""]);
      if (passed) {
        fireConfetti();
        setShowSuccessToast({
          title: ch.title,
          score: mockResult.score,
          type: "chapter",
        });
      } else {
        alert("Review the material. You can retake the assessment exam anytime.");
      }
    } finally {
      setBusy(false);
    }
  };

  const currIdxOf = (chId: string) => course.chapters.findIndex(x => x.id === chId);

  const generateLocalChapterGrade = (combined: string, ch: Chapter) => {
    const studentLen = combined.length;
    let score = Math.min(100, 30 + (studentLen > 300 ? 55 : studentLen > 150 ? 40 : 15));
    if (/example|relationship|concept|because/i.test(combined)) {
      score = Math.min(100, score + 15);
    }
    return {
      score,
      passed: score >= 85,
      feedback:
        score >= 85
          ? "Good comprehension proved offline. You understand the foundational relationships here!"
          : "Exam did not pass. Focus on providing cohesive explanations and incorporating everyday analogies.",
      missingIdeas: score < 85 ? ["Analogies comparison elements", "Key connections"] : [],
      weakConcepts: [],
    };
  };

  // Submit Final Comprehensive Exam
  const handleFinalExamSubmit = async () => {
    const combinedAnswers = answers.join("\n\n").trim();
    if (!combinedAnswers) {
      alert("Please write answers before submitting.");
      return;
    }

    setBusy(true, "AI is grading your comprehensive final exam...");

    try {
      const sourceMap = course.chapters
        .map(ch => `${ch.title}: ${ch.lessons.map(l => l.mainConcept).join(", ")}`)
        .join("\n");
      const prompt = `Grade this Course Final Exam using the Feynman Technique.
Focus on: Can the student explain all primary units simply, relate them together, and outline the overarching summary easily?
You must output RAW JSON complying exactly with this schema block:
{
  "score": 0-100,
  "passed": boolean,
  "feedback": "Final comprehensive curriculum review...",
  "missingIdeas": ["elements"],
  "weakConcepts": ["weak term"]
}

Course Title: "${course.title}"
Scope Syllabus Content Map:\n${sourceMap}
Student Answers:\n${combinedAnswers}`;

      let rawResponse = "";
      if (settings.provider === "gemini") {
        const res = await fetch("/api/ai/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, json: true }),
        });
        if (res.ok) rawResponse = (await res.json()).text || "";
      } else if (settings.provider === "ollama") {
        const res = await fetch("/api/ai/ollama", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ollamaUrl: settings.ollamaUrl,
            model: settings.model || "qwen2.5:7b",
            prompt,
            json: true,
          }),
        });
        if (res.ok) rawResponse = (await res.json()).text || "";
      } else if (settings.provider === "openai-compatible") {
        const res = await fetch("/api/ai/openai-compatible", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiBase: settings.apiBase,
            apiKey: settings.apiKey,
            model: settings.paidModel || settings.model,
            prompt,
            json: true,
          }),
        });
        if (res.ok) rawResponse = (await res.json()).text || "";
      }

      let parsedResult = null;
      if (rawResponse) {
        try {
          parsedResult = JSON.parse(
            rawResponse
              .trim()
              .replace(/^```(?:json)?/i, "")
              .replace(/```$/i, "")
          );
        } catch (_) {}
      }

      if (!parsedResult) {
        parsedResult = generateLocalFinalGrade(combinedAnswers);
      }

      const score = parsedResult.score ?? 50;
      const passed = score >= 85;

      const finalExamResult: ExamResult = {
        score,
        passed,
        feedback: parsedResult.feedback || "Checked successfully.",
        missingIdeas: Array.isArray(parsedResult.missingIdeas) ? parsedResult.missingIdeas : [],
        answers: [...answers],
        at: new Date().toISOString(),
      };

      onUpdateCourse({ ...course, finalExamResult });
      setAnswers(["", "", ""]);
      if (passed) {
        fireConfetti();
        setShowSuccessToast({
          title: course.title,
          score,
          type: "final",
        });
      } else {
        alert("Try again. Go back to study elements to master the topic.");
      }
    } catch (_) {
      const mockResult = generateLocalFinalGrade(combinedAnswers);
      const passed = mockResult.score >= 85;
      onUpdateCourse({
        ...course,
        finalExamResult: {
          score: mockResult.score,
          passed,
          feedback: mockResult.feedback,
          missingIdeas: mockResult.missingIdeas,
          answers: [...answers],
          at: new Date().toISOString(),
        },
      });
      setAnswers(["", "", ""]);
      if (passed) {
        fireConfetti();
        setShowSuccessToast({
          title: course.title,
          score: mockResult.score,
          type: "final",
        });
      } else {
        alert("Try again. Go back to study elements to master the topic.");
      }
    } finally {
      setBusy(false);
    }
  };

  const generateLocalFinalGrade = (combined: string) => {
    const studentLen = combined.length;
    let score = Math.min(100, 35 + (studentLen > 400 ? 55 : studentLen > 200 ? 40 : 15));
    return {
      score,
      passed: score >= 85,
      feedback: "Great online-fallback comprehensive exam assessment completed.",
      missingIdeas: score < 85 ? ["overarching connection paths"] : [],
    };
  };

  // Certificate generation template helper
  const renderCertificate = () => {
    const date = new Date(course.finalExamResult?.at || Date.now()).toLocaleDateString();
    return (
      <section className="certificate select-text" id="certificate-print">
        <div className="cert-inner">
          <div className="cert-logo">F</div>
          <p className="small mb-1 uppercase tracking-widest font-extrabold text-indigo-500">
            Certificate of Conceptual Understanding
          </p>
          <h1 className="text-4xl text-gray-900 leading-tight pr-4">
            Mastery of {course.title}
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto mt-4 text-base">
            This document verifies that the student possesses deep intuitive structure knowledge on the topic, proven through explaining analogies, key definitions, error-correction tests, and comprehensive exams.
          </p>
          <div className="cert-score font-black" id="cert-score-display">
            {course.finalExamResult?.score || 0}%
          </div>
          <p className="text-sm font-bold text-gray-800">Completed Date: {date}</p>
          <p className="text-xs text-gray-400 mt-2">
            No rote memorization. Mastery is certified by teaching ability.
          </p>
          <button className="btn ghost mt-4" type="button" onClick={() => window.print()}>
            Print Certificate
          </button>
        </div>
      </section>
    );
  };

  return (
    <div id="exams-view">
      <div className="topbar">
        <div>
          <h2>Exams & Assessments</h2>
          <p>
            Standard assessment exams evaluate intuitive teach-back performance. Passing a Chapter exam unlocks subsequent modules.
          </p>
        </div>
      </div>

      {course.finalExamResult?.passed && renderCertificate()}

      <div className="grid two">
        <section className="card flex flex-col gap-3" id="exams-accordion">
          <h3>Assessment Modules</h3>

          <div className="lesson-list">
            {course.chapters.map((ch, idx) => {
              const allDone = ch.lessons.every(l => l.completed);
              const isExamUnlocked = allDone || ch.examUnlocked;

              return (
                <div
                  className={`lesson-item ${isExamUnlocked ? "" : "locked"}`}
                  key={ch.id}
                  id={`exam-node-${ch.id}`}
                >
                  <div>
                    <h4>
                      {ch.examResult?.passed ? "✅" : isExamUnlocked ? "🟣" : "🔒"} Chapter {idx + 1}:{" "}
                      {ch.title}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {isExamUnlocked ? "Assessment unlocked" : "Incomplete lessons list"} • Grade:{" "}
                      {ch.examResult ? `${ch.examResult.score}%` : "Not graded"}
                    </p>
                  </div>

                  <button
                    className={`btn ${isExamUnlocked ? "" : "ghost"}`}
                    disabled={!isExamUnlocked}
                    type="button"
                    onClick={() => onSetChapterId(ch.id)}
                  >
                    {ch.examResult?.passed ? "Review" : "Take Exam"}
                  </button>
                </div>
              );
            })}

            <div className={`lesson-item ${allChapterExamsPassed ? "" : "locked"}`}>
              <div>
                <h4>
                  {course.finalExamResult?.passed ? "✅" : allChapterExamsPassed ? "🏁" : "🔒"}{" "}
                  Course Final verification exam
                </h4>
                <p className="text-xs text-indigo-500">
                  {allChapterExamsPassed ? "Comprehensive test unlocked" : "Pass all Chapter exams first"}{" "}
                  • Grade:{" "}
                  {course.finalExamResult ? `${course.finalExamResult.score}%` : "Not graded"}
                </p>
              </div>

              <button
                className="btn purple"
                disabled={!allChapterExamsPassed}
                type="button"
                onClick={() => onSetChapterId("final")}
              >
                Launch Final
              </button>
            </div>
          </div>
        </section>

        {/* Selected exam active view column */}
        <section className="card flex flex-col gap-4" id="active-exam-panel">
          {showFinal ? (
            <div id="final-exam-board">
              <h3>Comprehensive Final: {course.title}</h3>
              <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
                Requires synthesis, deep analogical comparisons, and linking all chapter components in intuitive summaries.
              </p>

              {course.finalExam.map((q, idx) => (
                <div className="field" key={idx}>
                  <label htmlFor={`final-ans-${idx}`}>
                    Question {idx + 1}: {q.question}
                  </label>
                  <textarea
                    id={`final-ans-${idx}`}
                    className="h-28"
                    value={answers[idx] || ""}
                    onChange={e => handleAnswerChange(idx, e.target.value)}
                    placeholder="Provide your intuitively simple teaching answer..."
                  />
                </div>
              ))}

              <button className="btn success w-full mt-2" type="button" onClick={handleFinalExamSubmit}>
                Submit final syllabus verification
              </button>

              {course.finalExamResult && (
                <div className="mt-4 border-t border-gray-100 pt-4" id="final-feedback">
                  <h4>Assessment Results:</h4>
                  <div className="score-box my-3">
                    <div className="score">{course.finalExamResult.score}%</div>
                    <span className={`badge ${course.finalExamResult.passed ? "green" : "red"}`}>
                      {course.finalExamResult.passed ? "Certification Passed!" : "Comprehension Required"}
                    </span>
                  </div>
                  <p className="text-sm! text-gray-700">{course.finalExamResult.feedback}</p>
                </div>
              )}
            </div>
          ) : activeChapter ? (
            <div id="chapter-exam-board">
              <h3>Chapter {course.chapters.findIndex(c=>c.id===activeChapter.id)+1} Exam: {activeChapter.title}</h3>
              <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
                Solve the conceptual situations below. Do not define lists by rote - explain what they do clearly.
              </p>

              {activeChapter.exam.map((q, idx) => (
                <div className="field" key={idx}>
                  <label htmlFor={`ch-ans-${idx}`}>
                    Question {idx + 1}: {q.question}
                  </label>
                  <textarea
                    id={`ch-ans-${idx}`}
                    className="h-24"
                    value={answers[idx] || ""}
                    onChange={e => handleAnswerChange(idx, e.target.value)}
                    placeholder="Describe simply with visual analogies..."
                  />
                </div>
              ))}

              <button
                className="btn success w-full mt-2"
                type="button"
                onClick={() => handleChapterExamSubmit(activeChapter)}
              >
                Submit Chapter examination
              </button>

              {activeChapter.examResult && (
                <div className="mt-4 border-t border-gray-100 pt-4" id="ch-feedback">
                  <h4>Assessment Feedback:</h4>
                  <div className="score-box my-3">
                    <div className="score">{activeChapter.examResult.score}%</div>
                    <span className={`badge ${activeChapter.examResult.passed ? "green" : "red"}`}>
                      {activeChapter.examResult.passed ? "Assessment Passed" : "Keep practicing"}
                    </span>
                  </div>
                  <p className="text-sm! text-gray-700">{activeChapter.examResult.feedback}</p>
                  {activeChapter.examResult.missingIdeas &&
                    activeChapter.examResult.missingIdeas.length > 0 && (
                      <p className="text-xs text-red-500 mt-2 font-bold">
                        Omitted concepts: {activeChapter.examResult.missingIdeas.join(", ")}
                      </p>
                    )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Select an available lesson chapter to begin examination.</p>
          )}
        </section>
      </div>

      {showSuccessToast && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-700 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl text-emerald-500 animate-bounce">
              🏆
            </div>
            <span className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-500 dark:text-indigo-400 block mb-2 font-mono">
              {showSuccessToast.type === "final" ? "Grand Final Passed!" : "Chapter Assessment Passed!"}
            </span>
            <h3 className="text-2xl font-black text-gray-900 dark:text-stone-100 mb-2 leading-tight">
              {showSuccessToast.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
              Awesome job! You demonstrated deep intuitive understanding and broke down complex concepts with clear, simple logic. Keep up the amazing Feynman study work!
            </p>
            
            <div className="bg-gradient-to-br from-indigo-50/50 to-emerald-50/50 dark:from-indigo-950/20 dark:to-emerald-950/20 rounded-2xl p-4 mb-6 border border-indigo-100/30 dark:border-indigo-950/40 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Feynman Grade</span>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {showSuccessToast.score}%
              </span>
            </div>

            <button
              onClick={() => setShowSuccessToast(null)}
              className="w-full btn success py-3.5 rounded-xl font-bold tracking-wide shadow-lg hover:shadow-emerald-500/10 cursor-pointer transition-all"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "white" }}
            >
              Continue Learning 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

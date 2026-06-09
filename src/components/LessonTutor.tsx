import React, { useState, useRef } from "react";
import { Course, Lesson, Chapter, AISettings, Attempt } from "../types";
import { getLesson, makeDetailedExplanation } from "../utils";

interface CodeBlock {
  type: "code" | "text";
  content: string;
  language?: string;
}

export function parseContent(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        content: text.slice(lastIndex, match.index)
      });
    }
    blocks.push({
      type: "code",
      language: match[1] || "code",
      content: match[2].trim()
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    blocks.push({
      type: "text",
      content: text.slice(lastIndex)
    });
  }

  return blocks;
}

export function renderInlineBackticks(text: string) {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-yellow-50 dark:bg-gray-800 text-pink-600 dark:text-cyan-300 font-mono text-xs border border-yellow-200 dark:border-gray-700 font-semibold select-all">
          {part}
        </code>
      );
    }
    return part;
  });
}

export function DeveloperCodeWindow({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightCode = (rawCode: string) => {
    const lines = rawCode.split("\n");
    return lines.map((line, lIdx) => {
      const tokens = line.split(/(\s+|\(|\)|\{|\}|\[|\]|;|,|=|\+|-|\*|\/)/);
      const highlightedLine = tokens.map((token, tIdx) => {
        if (/^(const|let|var|function|return|import|export|class|interface|type|extends|implements|if|else|for|while|do|async|await|try|catch|finally|throw|new|typeof|instanceof|switch|case|default|break|continue|package|public|private|protected|static|readonly|as|from|in|of|keyof|void|any|number|string|boolean|unknown|never|null|undefined)$/.test(token)) {
          return <span key={tIdx} className="text-pink-500 font-bold">{token}</span>;
        }
        if (/^(true|false|[0-9]+)$/.test(token)) {
          return <span key={tIdx} className="text-amber-400 font-mono">{token}</span>;
        }
        if (/^(".*"|'.*'|`.*`)$/.test(token)) {
          return <span key={tIdx} className="text-emerald-400 font-medium">{token}</span>;
        }
        if (token.startsWith("//") || token.startsWith("/*") || token.startsWith("#")) {
          return <span key={tIdx} className="text-gray-500 italic font-mono">{token}</span>;
        }
        return token;
      });
      return (
        <div key={lIdx} className="table-row select-text">
          <span className="table-cell text-right pr-4 py-0.5 text-gray-600 select-none text-xs font-mono w-8">{lIdx + 1}</span>
          <span className="table-cell pl-2 py-0.5 whitespace-pre-wrap">{highlightedLine}</span>
        </div>
      );
    });
  };

  return (
    <div className="my-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-950 text-stone-100 shadow-md overflow-hidden font-mono text-xs max-w-full">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900 border-b border-gray-950 text-gray-400 select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
          <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">{language || "Code"}</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-[10px] uppercase font-extrabold bg-gray-800 hover:bg-gray-750 text-stone-200 px-2.5 py-1 rounded cursor-pointer border-0 transition-colors"
        >
          {copied ? "Copied! ✓" : "Copy"}
        </button>
      </div>
      <div className="p-4 overflow-x-auto max-h-[420px] leading-relaxed table w-full font-mono text-xs">
        {highlightCode(code)}
      </div>
    </div>
  );
}

export function FormattedTechExplanation({ text }: { text: string }) {
  if (!text) return null;
  const blocks = parseContent(text);
  return (
    <>
      {blocks.map((block, idx) => {
        if (block.type === "code") {
          return (
            <div key={idx} className="block w-full">
              <DeveloperCodeWindow code={block.content} language={block.language || "code"} />
            </div>
          );
        }
        return (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed my-2 select-text text-stone-800 dark:text-stone-300">
            {renderInlineBackticks(block.content)}
          </div>
        );
      })}
    </>
  );
}

interface LessonTutorProps {
  course: Course;
  lessonId: string | null;
  settings: AISettings;
  onUpdateCourse: (course: Course) => void;
  setBusy: (busy: boolean, notice?: string) => void;
  onBackToOutline: () => void;
}

export default function LessonTutor({
  course,
  lessonId,
  settings,
  onUpdateCourse,
  setBusy,
  onBackToOutline,
}: LessonTutorProps) {
  const { lesson, chapter } = getLesson(course, lessonId);

  const [questionText, setQuestionText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [recognitionActive, setRecognitionActive] = useState<string | null>(null);

  // References for Speech Recognition
  const recognitionRef = useRef<any>(null);

  if (!lesson || !chapter) {
    return (
      <div className="empty">
        <h3>No Lesson Selected</h3>
        <p>Please select a lesson from the menu or outline.</p>
        <button className="btn" type="button" onClick={onBackToOutline}>
          View outline
        </button>
      </div>
    );
  }

  // Speak synthesized voice output
  const handleTTS = () => {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const fullSpeech = `${lesson.title}. Basic Principle Explanation: ${lesson.simpleExplanation}. Analogous Comparison: ${lesson.analogy}. Detailed Example: ${lesson.example}`;
    const utterance = new SpeechSynthesisUtterance(fullSpeech);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.lang = navigator.language || "en-US";
    window.speechSynthesis.speak(utterance);
  };

  const handleStopTTS = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  // Browser voice inputs
  const triggerVoiceInput = (targetField: "question" | "answer") => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Edge!");
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const rec = new SpeechRecognition();
      recognitionRef.current = rec;
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = true;

      let prefixText = targetField === "question" ? questionText : answerText;
      let finalSpeechAcc = prefixText ? prefixText + " " : "";

      rec.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalSpeechAcc += trans + " ";
          } else {
            interim += trans;
          }
        }
        const textVal = (finalSpeechAcc + interim).trim();
        if (targetField === "question") {
          setQuestionText(textVal);
        } else {
          setAnswerText(textVal);
        }
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e.error);
        setRecognitionActive(null);
      };

      rec.onend = () => {
        setRecognitionActive(null);
      };

      setRecognitionActive(targetField);
      rec.start();
    } catch (err: any) {
      alert(`Speech API failed: ${err.message}`);
    }
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setRecognitionActive(null);
  };

  // Asking a question to the AI Tutor
  const handleAskQuestion = async (customText?: string) => {
    const query = customText || questionText;
    if (!query.trim()) return;

    // Save prompt to questions list
    const updatedLesson = { ...lesson };
    updatedLesson.questions = [
      ...updatedLesson.questions,
      { q: query, at: new Date().toISOString() },
    ];

    setBusy(true, "AI tutor is answering...");

    try {
      let responseText = "";
      const prompt = `Student Question: "${query}"
Answer like a patient, supportive, and elegant Feynman method mentor. 
CRITICAL PEDAGOGY DIRECTION: Teach and explain as if the student has NEVER read the book or source material before. Start from the absolute beginning, defining fundamental basic premises, terms, and core properties. Avoid assuming any prior familiarity. Answer consecutively, building your explanations step-by-step from the ground up so that the student can naturally connect the dots in perfect logical order. Avoid academic jargon unless you explain it fully and simply first.
Teach in clear, structured detail first. Give a clever everyday analogy ONLY after the detailed teaching.
Lesson Core Concept: "${lesson.mainConcept}"
Lesson Basic Principle Explanation: "${lesson.simpleExplanation}"
Lesson Key Terms: ${lesson.keyTerms.join(", ")}
Source Paragraph Context:
"${lesson.sourceText}"`;

      if (settings.provider === "gemini") {
        const res = await fetch("/api/ai/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        if (res.ok) responseText = (await res.json()).text || "";
      } else if (settings.provider === "ollama") {
        const res = await fetch("/api/ai/ollama", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ollamaUrl: settings.ollamaUrl,
            model: settings.model || "qwen2.5:7b",
            prompt,
          }),
        });
        if (res.ok) responseText = (await res.json()).text || "";
      } else if (settings.provider === "openai-compatible") {
        const res = await fetch("/api/ai/openai-compatible", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiBase: settings.apiBase,
            apiKey: settings.apiKey,
            model: settings.paidModel || settings.model,
            prompt,
          }),
        });
        if (res.ok) responseText = (await res.json()).text || "";
      }

      if (!responseText) {
        responseText = getLocalDemoResponse(query, lesson);
      }

      updatedLesson.attempts = [
        ...updatedLesson.attempts,
        {
          type: "question",
          q: query,
          answer: responseText,
          at: new Date().toISOString(),
        },
      ];

      updateCourseData(updatedLesson);
      setQuestionText("");
    } catch (_) {
      const demoRes = getLocalDemoResponse(query, lesson);
      updatedLesson.attempts = [
        ...updatedLesson.attempts,
        {
          type: "question",
          q: query,
          answer: demoRes,
          at: new Date().toISOString(),
        },
      ];
      updateCourseData(updatedLesson);
      setQuestionText("");
    } finally {
      setBusy(false);
    }
  };

  const getLocalDemoResponse = (q: string, l: Lesson) => {
    const lq = q.toLowerCase();
    if (lq.includes("example")) return `Excellent question! Here's another concrete example:\n${l.example}\n\nCan you try teaching this back in your own words using this application?`;
    if (lq.includes("analogy")) return `Clever thought! Let's think of it through this analogy:\n${l.analogy}\n\nAn analogy bridges what you know with the unknown. How does this fit into your understanding?`;
    return `Excellent inquiry. Regarding "${l.mainConcept}", always remember this fundamental explanation:\n${l.simpleExplanation}\n\nLet's test this! Explain this concept to me simply!`;
  };

  // Grade user's teach-back explanation using Feynman rules
  const handleGradeAnswer = async () => {
    if (!answerText.trim()) return;

    setBusy(true, "AI tutor is reviewing your explanation...");

    try {
      const prompt = `Grade this student explanation of "${lesson.mainConcept}" using the strict Feynman learning criteria. Focus on simplicity, clarity, spotting misconceptions or copied definitions, and whether they gave a clear example.
You MUST output raw JSON matching exactly this schema block (no other labels or markdown blocks):
{
  "score": 0-100 number,
  "passed": boolean,
  "feedback": "Paragraph feedback...",
  "whatStudentUnderstood": ["Point 1 mastered"],
  "missingIdeas": ["Concept alpha was omitted"],
  "misconceptions": ["Misconception beta was flagged"],
  "simplerExplanation": "A super simple custom explanation",
  "followUpQuestion": "A new quick check prompt",
  "weakConcepts": ["weak term 1"]
}

Concept: "${lesson.mainConcept}"
Key Terms: ${lesson.keyTerms.join(", ")}
Analogy Context: "${lesson.analogy}"
Source Reference Text:\n"${lesson.sourceText}"
Student Explanation Attempt:\n"${answerText}"`;

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
        parsedResult = generateLocalGrade(answerText, lesson);
      }

      // Normalization of scores
      const finalScore = parsedResult.score ?? 50;
      const passed = finalScore >= 80;

      const updatedLesson = { ...lesson };
      updatedLesson.score = Math.max(updatedLesson.score, finalScore);
      updatedLesson.completed = passed || updatedLesson.completed;
      if (updatedLesson.completed && !updatedLesson.completedAt) {
        updatedLesson.completedAt = new Date().toISOString();
      }

      // Add attempt record
      updatedLesson.attempts = [
        ...updatedLesson.attempts,
        {
          type: "explain-back",
          answer: answerText,
          at: new Date().toISOString(),
          result: {
            score: finalScore,
            passed,
            feedback: parsedResult.feedback || "Grade computed successfully.",
            missingIdeas: Array.isArray(parsedResult.missingIdeas) ? parsedResult.missingIdeas : [],
            simplerExplanation: parsedResult.simplerExplanation || lOriginalExplanation(lesson),
            followUpQuestion: parsedResult.followUpQuestion || "",
          },
        },
      ];

      // Track weak areas
      if (parsedResult.weakConcepts && Array.isArray(parsedResult.weakConcepts)) {
        updatedLesson.weakConcepts = [
          ...new Set([...updatedLesson.weakConcepts, ...parsedResult.weakConcepts]),
        ];
      } else if (!passed) {
        updatedLesson.weakConcepts = [...new Set([...updatedLesson.weakConcepts, lesson.mainConcept])];
      }

      // If passed, unlock next lesson or chapter exams
      if (passed) {
        unlockNextNodes(lesson.id);
      }

      updateCourseData(updatedLesson);
      setAnswerText("");
    } catch (err: any) {
      console.error(err);
      // Fallback fallback
      const mockResult = generateLocalGrade(answerText, lesson);
      const passed = mockResult.score >= 80;
      const updatedLesson = { ...lesson };
      updatedLesson.score = Math.max(updatedLesson.score, mockResult.score);
      updatedLesson.completed = passed || updatedLesson.completed;
      if (updatedLesson.completed && !updatedLesson.completedAt) {
        updatedLesson.completedAt = new Date().toISOString();
      }
      updatedLesson.attempts = [
        ...updatedLesson.attempts,
        {
          type: "explain-back",
          answer: answerText,
          at: new Date().toISOString(),
          result: {
            score: mockResult.score,
            passed,
            feedback: mockResult.feedback,
            missingIdeas: mockResult.missingIdeas,
            simplerExplanation: mockResult.simplerExplanation,
            followUpQuestion: mockResult.followUpQuestion,
          },
        },
      ];
      if (passed) unlockNextNodes(lesson.id);
      updateCourseData(updatedLesson);
      setAnswerText("");
    } finally {
      setBusy(false);
    }
  };

  const lOriginalExplanation = (l: Lesson) => l.simpleExplanation;

  const generateLocalGrade = (text: string, l: Lesson) => {
    const studentWords = text.toLowerCase().split(/\s+/);
    const keyMatch = l.keyTerms.filter(term => studentWords.includes(term.toLowerCase())).length;
    let score = 30 + keyMatch * 10;
    if (text.length > 120) score += 15;
    if (/example|analog|because|means/i.test(text)) score += 15;
    score = Math.min(100, score);

    return {
      score,
      passed: score >= 80,
      feedback:
        score >= 80
          ? "Excellent work! Your explanation was clear, and it proved structural comprehension."
          : "Good try! However, try including more key terms, a concrete example, and avoid vague summaries.",
      missingIdeas: score < 80 ? ["main core examples", "relationship definitions"] : [],
      simplerExplanation: l.simpleExplanation,
      followUpQuestion: `What does "${l.mainConcept}" help map out in standard application?`,
      weakConcepts: score < 80 ? [l.mainConcept] : [],
    };
  };

  // Course update state syncing
  const updateCourseData = (updatedLesson: Lesson) => {
    const updatedChapters = course.chapters.map(ch => {
      if (ch.id === chapter.id) {
        const lessons = ch.lessons.map(l => (l.id === updatedLesson.id ? updatedLesson : l));
        return { ...ch, lessons };
      }
      return ch;
    });

    onUpdateCourse({ ...course, chapters: updatedChapters });
  };

  // Node Lock / unlock calculations
  const unlockNextNodes = (currLessonId: string) => {
    const lessonsList = course.chapters.flatMap(ch => ch.lessons);
    const currIndex = lessonsList.findIndex(l => l.id === currLessonId);

    if (currIndex >= 0 && currIndex + 1 < lessonsList.length) {
      const nextLesson = lessonsList[currIndex + 1];
      const updatedChapters = course.chapters.map(ch => {
        const lessons = ch.lessons.map(l => (l.id === nextLesson.id ? { ...l, locked: false } : l));
        const allLessonsOnChDone = lessons.every(l => l.completed);
        return {
          ...ch,
          lessons,
          examUnlocked: allLessonsOnChDone || ch.examUnlocked,
        };
      });

      onUpdateCourse({ ...course, chapters: updatedChapters });
    } else {
      // Last lesson completed! Lock calculations update
      const updatedChapters = course.chapters.map(ch => {
        const allDone = ch.lessons.every(l => l.completed);
        return { ...ch, examUnlocked: allDone || ch.examUnlocked };
      });
      onUpdateCourse({ ...course, chapters: updatedChapters });
    }
  };

  const getLatestGradeResult = (l: Lesson) => {
    const grades = l.attempts.filter(a => a.type === "explain-back" && a.result);
    return grades.length ? grades[grades.length - 1].result : null;
  };

  const latestFeedback = getLatestGradeResult(lesson);

  return (
    <div id="lesson-view">
      <div className="topbar">
        <div>
          <h2>{lesson.title}</h2>
          <p>
            Chapter: {chapter.title} • Spaced grading check (threshold: 80%)
          </p>
        </div>
        <button className="btn ghost" type="button" onClick={onBackToOutline}>
          Back to outline
        </button>
      </div>

      <div className="tutor-layout">
        <section className="card flex flex-col gap-4" id="tutor-workspace">
          <h3>Feynman Active Tutor Board</h3>

          <div className="chat mb-4" id="tutor-chat-scroller">
            <div className="msg ai">
              <span className="font-extrabold text-indigo-700 block mb-2 dark:text-cyan-400">
                💡 Simple concept explanation
              </span>
              <div className="mb-4">
                <FormattedTechExplanation text={lesson.simpleExplanation} />
              </div>

              <span className="font-extrabold text-indigo-700 block mb-2 dark:text-cyan-400">
                📚 Detailed Concept teaching
              </span>
              <div className="mb-4">
                <FormattedTechExplanation text={lesson.detailedExplanation || makeDetailedExplanation(lesson.mainConcept, lesson.sourceText)} />
              </div>

              <span className="font-extrabold text-indigo-700 block mb-2 dark:text-cyan-400">
                🧠 Clever Everyday analogy
              </span>
              <div className="mb-4 text-justify select-text">
                <FormattedTechExplanation text={lesson.analogy} />
              </div>

              <span className="font-extrabold text-indigo-700 block mb-2 dark:text-cyan-400">
                📝 Actionable real-life example
              </span>
              <div>
                <FormattedTechExplanation text={lesson.example} />
              </div>
            </div>

            {lesson.attempts.map((att, i) => {
              if (att.type === "question") {
                return (
                  <React.Fragment key={`att-${i}`}>
                    <div className="msg student">Q: {att.q}</div>
                    <div className="msg ai">
                      <FormattedTechExplanation text={att.answer} />
                    </div>
                  </React.Fragment>
                );
              } else {
                return (
                  <React.Fragment key={`att-${i}`}>
                    <div className="msg student">{att.answer}</div>
                    {att.result && (
                      <div className="msg ai">
                        <b className="block text-indigo-600 dark:text-cyan-400 mb-1">
                          Comprehensive Score: {att.result.score}%
                        </b>
                        <div className="mb-2">
                          <FormattedTechExplanation text={att.result.feedback} />
                        </div>
                        {att.result.missingIdeas && att.result.missingIdeas.length > 0 && (
                          <p className="text-sm! text-red-600 dark:text-red-400">
                            <b>Missed:</b> {att.result.missingIdeas.join(", ")}
                          </p>
                        )}
                        {att.result.followUpQuestion && (
                          <p className="text-sm! text-indigo-700 dark:text-indigo-400 mt-2 italic">
                            <b>Follow-up:</b> {att.result.followUpQuestion}
                          </p>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              }
            })}
          </div>

          <hr className="border-gray-200" />

          {/* Ask questions panel */}
          <div className="field">
            <label htmlFor="question-box">Ask tutor any doubt or clarification</label>
            <textarea
              id="question-box"
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="How does this apply to...? What is a real-life analogy? Why is this important?..."
            />
          </div>

          <div className="row gap-2 flex-wrap text-sm">
            <button className="btn" type="button" onClick={() => handleAskQuestion()}>
              Ask Question
            </button>
            <button
              className={`btn ghost ${recognitionActive === "question" ? "bg-red-50 text-red-600 animate-pulse border-red-200" : ""}`}
              type="button"
              onClick={() =>
                recognitionActive === "question"
                  ? stopVoiceInput()
                  : triggerVoiceInput("question")
              }
            >
              {recognitionActive === "question" ? "⏹ Stop Mic" : "🎙 Speak Question"}
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                handleAskQuestion("Explain this to me in simpler terms with a child comparison.")
              }
            >
              Explain simpler
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => handleAskQuestion("Give me a deep structured breakdown with bullet points.")}
            >
              Deep detail
            </button>
          </div>

          <hr className="border-gray-200 mt-2" />

          {/* Teach back graded panel */}
          <div className="field">
            <label htmlFor="answer-box">Test me: Teach the concept back in your own words</label>
            <p className="small mb-1">
              PROMPT: <b>{lesson.feynmanPrompt}</b>
            </p>
            <textarea
              id="answer-box"
              value={answerText}
              onChange={e => setAnswerText(e.target.value)}
              placeholder="e.g. In simple words, this concept is about... Think of it like... For example..."
            />
          </div>

          <div className="row gap-2 flex-wrap text-sm">
            <button className="btn success" type="button" onClick={handleGradeAnswer}>
              Submit Explanation
            </button>
            <button
              className={`btn ghost ${recognitionActive === "answer" ? "bg-red-50 text-red-600 animate-pulse border-red-200" : ""}`}
              type="button"
              onClick={() =>
                recognitionActive === "answer" ? stopVoiceInput() : triggerVoiceInput("answer")
              }
            >
              {recognitionActive === "answer" ? "⏹ Stop Mic" : "🎙 Speak Answer"}
            </button>
            <button className="btn ghost" type="button" onClick={handleTTS}>
              🔊 Read Aloud
            </button>
            <button className="btn ghost" type="button" onClick={handleStopTTS}>
              ⏹ Stop speech
            </button>
          </div>
        </section>

        {/* Side columns */}
        <aside className="grid" id="tutor-sidepanel">
          <div className="card score-box">
            <div className="small mb-1">Comprehension score</div>
            <div className="score">{lesson.score}%</div>
            <span
              className={`badge mt-2 ${
                lesson.completed ? "green" : lesson.score >= 60 ? "yellow" : "gray"
              }`}
            >
              {lesson.completed ? "Mastered" : lesson.score > 0 ? "Reviewing" : "Not Tested"}
            </span>
          </div>

          <div className="card flex flex-col gap-2">
            <h3>Lesson Mini Quiz</h3>
            {lesson.miniQuiz.map((q, idx) => (
              <div className="kv" key={idx}>
                <b className="text-gray-700">Q{idx + 1}:</b>
                <span>{q.question}</span>
              </div>
            ))}
            <p className="text-xs text-gray-500 mt-2">
              Tip: Incorporate the quiz answers back into your teaching explanation to score a 100%!
            </p>
          </div>

          <div className="card flex flex-col gap-2">
            <h3>Grade Feedback</h3>
            {latestFeedback ? (
              <div className="text-sm select-text">
                <p className="font-bold flex items-center gap-2 mb-2">
                  <span>{latestFeedback.passed ? "🟢" : "🔴"}</span>
                  {latestFeedback.passed ? "Core Standard Passed!" : "Requires improvement"}
                </p>
                <p className="text-gray-600 dark:text-gray-300 mb-2">{latestFeedback.feedback}</p>
                {latestFeedback.missingIdeas && latestFeedback.missingIdeas.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-bold text-red-500 block">Missing Core Elements:</span>
                    <ul className="list-disc pl-4 text-xs">
                      {latestFeedback.missingIdeas.map((el: string, idx: number) => (
                        <li key={idx}>{el}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {latestFeedback.simplerExplanation && (
                  <div>
                    <span className="text-xs font-bold text-indigo-500 block">Simpler Comparison:</span>
                    <p className="text-xs text-indigo-800 dark:text-indigo-400 italic">
                      {latestFeedback.simplerExplanation}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No feedback computed yet. Go explain Concept Alpha to generate results!</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

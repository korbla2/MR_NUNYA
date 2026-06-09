import React, { useState } from "react";
import { Course, SourceDraft, AISettings } from "../types";
import { heuristicCourse, uid } from "../utils";

const CODING_TRACKS = [
  {
    title: "Rust Ownership, Borrowing & Lifetimes",
    summary: "Master the Rust borrow checker constraints, thread-safety boundaries (Send/Sync), and reference lifetimes.",
    goal: "Skill building",
    level: "University",
    text: "Rust memory management is built upon Ownership, Borrowing, and Lifetimes. Under Ownership, every value has a unique owner. When the owner goes out of scope, the value is dropped. Under Borrowing, references (&T) let code read without taking ownership. Multiple read-only borrows are allowed, but only one active mutable borrow (&mut T) is permitted at a time, enforcing compile-time data race prevention. Lifetimes are generic parameters ('a) that ensure references remain valid for as long as needed, completely eliminating dangling pointers or use-after-free bugs.",
  },
  {
    title: "Advanced React Fiber & Hook Engine",
    summary: "Deep dive into Concurrent Renting, the render vs reconciliation loops, Hook collections, and custom triggers.",
    goal: "Skill building",
    level: "Professional",
    text: "React Fiber is the core scheduling algorithm. Prior to Fiber, reconciliation was synchronous and recursive, blocking the main browser UI thread. Fiber introduces a linked-list tree of work units, allowing React to pause, abort, or reuse work chunks, enabling Concurrent Mode. Hooks rely on call preservation order inside a Fiber's memoizedState linked-list. Custom Hook abstractions let you extract stateful logic. useEffect schedules side effects after render completes, while useLayoutEffect runs synchronously before paint.",
  },
  {
    title: "Systems Design & CAP Theorem Principles",
    summary: "Learn distributed system tradeoffs, horizontal scaling, load balancers, caching (Redis), caching topologies and replication.",
    goal: "Work",
    level: "Professional",
    text: "The CAP Theorem states that a distributed system can guarantee at most two of: Consistency, Availability, and Partition Tolerance. In reality, network partitions (P) are unavoidable, forcing architects to trade Consistency (C) for Availability (A). Highly available systems (AP) like DynamoDB prioritize performance and provide eventual consistency. Strongly consistent systems (CP) like Etcd or CockroachDB preserve linearizability but sacrifice availability under network splits. Modern system designs employ replication lag limits, gossip protocols, consensus groups (Raft/Paxos), and heartbeat monitors to mitigate partitions.",
  },
  {
    title: "Database Performance & SQL B-Trees",
    summary: "Deeply understand B-Trees, transaction isolations, join indexes (Hash, Index, Merge), and Query Plan Tuning.",
    goal: "School exam",
    level: "University",
    text: "A database index speeds up search. B-Tree indexes store key-value mappings in sorted balanced-tree structures, enabling O(log N) searches, range queries, and ordering. Hash indexes provide O(1) searches but do not support range sorting. SQL Query execution plans reveal the cost of Nested Loops, Hash Joins, and Merge Joins. Index scans bypass table scans but require index maintenance overhead. Transaction isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable) employ Read/Write Shared Locks or MVCC (Multi-Version Concurrency Control) to resolve Dirty Reads, Non-Repeatable Reads, and Phantom Reads.",
  },
  {
    title: "Docker Containers & Kubernetes",
    summary: "Deconstruct Linux namespaces, cgroups isolation, container images, pods scheduling, and declarative state.",
    goal: "Skill building",
    level: "Beginner",
    text: "Containers isolate software processes leveraging Linux Namespaces (isolating PID, Network, Mounts) and Control Groups (cgroups, limiting memory/CPU). A container image is a read-only set of stacked filesystem layers. Kubernetes orchestrates containers at scale. A Pod is the smallest deployable unit. The Kubelet supervises containers, communicating with the API Server. The control plane runs etcd, a scheduler, and controller managers, reconciling the cluster configuration declaratively towards the desired state.",
  },
  {
    title: "Data Structures & Big-O Analysis",
    summary: "Deconstruct time-space complexities, binary traversals, graph trees (BFS/DFS), and Memoized Dynamic Patterns.",
    goal: "Personal knowledge",
    level: "Beginner",
    text: "Big-O Notation measures algorithmic efficiency. Arrays offer O(1) random access but O(N) insertion/deletion due to element shifting. Linked Lists offer O(1) pointer updates but O(N) traversal. Binary Search Trees (BST) provide average O(log N) operations, degraded to O(N) if unbalanced. Depth-First Search (DFS) uses a stack (recursion) to explore paths deeply, whereas Breadth-First Search (BFS) uses a queue to explore levels sequentially. Dynamic Programming optimizes overlapping subproblems using memoization (top-down) or tabulation (bottom-up).",
  }
];

interface CreateCourseProps {
  draft: SourceDraft;
  setDraft: React.Dispatch<React.SetStateAction<SourceDraft>>;
  settings: AISettings;
  onCourseCreated: (course: Course) => void;
  setBusy: (busy: boolean, notice?: string) => void;
}

export default function CreateCourse({
  draft,
  setDraft,
  settings,
  onCourseCreated,
  setBusy,
}: CreateCourseProps) {
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setErrorMsg("");
    setSuccessMsg("");
    const { id, value } = e.target;
    const fieldMap: Record<string, keyof SourceDraft> = {
      "src-title": "title",
      "src-level": "level",
      "src-goal": "goal",
      "src-text": "text",
      "src-url": "url",
    };
    const field = fieldMap[id];
    if (field) {
      setDraft(prev => ({ ...prev, [field]: value }));
    }
  };

  const [dragActive, setDragActive] = useState(false);

  const processFile = async (file: File) => {
    setBusy(true, `Extracting text from "${file.name}"...`);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      console.log(`[File Upload] Initiating extraction for: Name="${file.name}", Size=${file.size} bytes, Type="${file.type}"`);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-file", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        console.log("[File Upload] Extraction API response:", data);
        if (!data.text || !data.text.trim()) {
          setErrorMsg(`Successfully uploaded "${file.name}", but the extracted text is empty. The file might contain only unreadable scans, images, or be copy-protected. Please paste its text manually.`);
        } else {
          setDraft(prev => ({
            ...prev,
            text: data.text,
            title: prev.title || data.title || file.name.replace(/\.[^.]+$/, ""),
          }));
          setSuccessMsg(`Successfully extracted ${data.text.length} characters of study text from "${file.name}"!`);
        }
      } else if (file.type.includes("text") || /\.(txt|md)$/i.test(file.name)) {
        // Standard text fallback done on client side
        console.warn("[File Upload] Non-200 response. Falling back to client-side text extraction for text file.");
        const text = await file.text();
        if (!text.trim()) {
          setErrorMsg(`The text file "${file.name}" is empty.`);
        } else {
          setDraft(prev => ({
            ...prev,
            text,
            title: prev.title || file.name.replace(/\.[^.]+$/, ""),
          }));
          setSuccessMsg(`Successfully read ${text.length} characters from "${file.name}"!`);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[File Upload] Server failed to parse file:", err);
        setErrorMsg(err.error || `Could not extract text from "${file.name}". Make sure the PDF file is valid.`);
      }
    } catch (err: any) {
      console.error("[File Upload] Exception during file upload:", err);
      if (file.type.includes("text") || /\.(txt|md)$/i.test(file.name)) {
        const text = await file.text();
        setDraft(prev => ({
          ...prev,
          text,
          title: prev.title || file.name.replace(/\.[^.]+$/, ""),
        }));
        setSuccessMsg(`Successfully read fallback text from "${file.name}"!`);
      } else {
        setErrorMsg(`Failed to connect to extraction server. Please copy-paste the content directly.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
    // Clear file inputs so same file can be selected again if needed
    if (e.target) {
      e.target.value = "";
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf") || name.endsWith(".txt") || name.endsWith(".md")) {
        await processFile(file);
      } else {
        setErrorMsg("Invalid file type. Please upload a study material PDF, TXT, or MD file.");
      }
    }
  };

  const handleLinkFetch = async () => {
    if (!draft.url.trim()) {
      setErrorMsg("Please paste a URL first.");
      return;
    }
    setBusy(true, "Scraping article text...");
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draft.url }),
      });

      if (res.ok) {
        const data = await res.json();
        if (!data.text || !data.text.trim()) {
          setErrorMsg("Successfully connected, but no readable study paragraphs were extracted from this webpage. Try copying and pasting the text manually.");
        } else {
          setDraft(prev => ({
            ...prev,
            text: data.text,
            title: prev.title || data.title || "Extracted Webpage",
          }));
          setSuccessMsg(`Successfully scraped website: "${data.title || "Webpage"}" (${data.text.length} characters extracted)!`);
        }
      } else {
        setErrorMsg("Boilerplate extraction failed. Try manual copy-pasting.");
      }
    } catch (err) {
      setErrorMsg("Scraper endpoint not reachable. Paste content manually instead.");
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!draft.text.trim()) {
      setErrorMsg("Please paste or upload some source material text first!");
      return;
    }
    setBusy(true, "Generating custom Feynman curriculum...");
    setErrorMsg("");
    setSuccessMsg("");

    try {
      let createdCourse: Course | null = null;

      // Prepare Prompt for Feynman syllabus tailored for programming and software engineering
      const prompt = `Create a Feynman Method tech/programming course from this source material. Return only valid JSON with title, summary, chapters, lessons, quizzes, and exams. Group core concepts into sequential chapters. Define lesson locks logic: only first lesson is unlocked initially.
For programming, tech or computer science topics: make sure to explain performance tradeoffs (such as Big-O time and space complexity, resource efficiency, latency, concurrency locks, or consistency trade-offs where applicable), and include beautiful code snippets or pseudocode (enclosed in markdown triple-backticks block) inside the explanations so students can learn both the theory and structural implementation at the same time.
CRITICAL PEDAGOGY RULE: You must teach and construct the entire course, lessons, and explanations as if the student has NEVER read the book or source material before. Always teach from the absolute beginning, defining fundamental basic premises, terms, and core properties. Avoid assuming any prior familiarity. Make the chapters and lessons highly consecutive, building up step-by-step in a logical progressive pipeline so that students can easily connect the dots in consecutive order. All field concepts, variables, and potential jargon must be introduced and broken down from scratch.
Expected output schema structure:
{
  "courseTitle": "Course Name",
  "courseSummary": "Summary...",
  "chapters": [
    {
      "chapterId": "unique_ch1",
      "title": "Chapter 1",
      "summary": "ch summary...",
      "learningGoals": ["Goal 1"],
      "chapterExam": [
        {"type": "explain", "question": "Write a prompt standard for testing Chapter 1."}
      ],
      "lessons": [
        {
          "lessonId": "unique_l1",
          "title": "Lesson 1: Concept simple",
          "mainConcept": "Concept Alpha",
          "simpleExplanation": "Very simple introductory explanation of Concept Alpha, teaching from the basic ground fundamentals assuming zero background.",
          "detailedExplanation": "Highly detailed beginner-friendly paragraphs teaching Concept Alpha from the very beginning. Introduce and explain ideas consecutively block-by-block so the student connects the dots in absolute logical order. Explain all terms from scratch before using them. Use analogies only AFTER complete teaching.",
          "analogy": "Everyday simple analogy comparison using extremely familiar objects/scenarios.",
          "example": "A clear, basic practical application showing how the dots connect.",
          "keyTerms": ["term1", "term2"],
          "commonMisconceptions": ["mismatch1", "mismatch2"],
          "feynmanPrompt": "Teach Concept Alpha simply assuming your listener is a complete beginner.",
          "miniQuiz": [
            {"type": "short", "question": "Explain Concept Alpha in 1 sentence."}
          ]
        }
      ]
    }
  ],
  "finalExam": [
    {"type": "broad", "question": "Summarize full course core structures simply."}
  ]
}

Student capability Level: ${draft.level}.
Learning Intended Goal: ${draft.goal}.
Source Subject Name: ${draft.title || "Untitled"}.
Full text to analyze:\n${draft.text.slice(0, 10000)}`;

      if (settings.provider === "gemini") {
        const res = await fetch("/api/ai/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, json: true }),
        });
        if (res.ok) {
          const aiData = await res.json();
          createdCourse = normalizeAICourse(parseAIJson(aiData.text), draft);
        }
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
        if (res.ok) {
          const aiData = await res.json();
          createdCourse = normalizeAICourse(parseAIJson(aiData.text), draft);
        }
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
        if (res.ok) {
          const aiData = await res.json();
          createdCourse = normalizeAICourse(parseAIJson(aiData.text), draft);
        }
      }

      // If AI failed or offline fallback is active, generate heuristically
      if (!createdCourse) {
        console.warn("Utilizing heuristic fallback engine to shape the curriculum...");
        createdCourse = heuristicCourse(draft);
      }

      onCourseCreated(createdCourse);
    } catch (err: any) {
      console.error(err);
      // Heuristic fallback
      const c = heuristicCourse(draft);
      onCourseCreated(c);
    } finally {
      setBusy(false);
    }
  };

  const parseAIJson = (text: string) => {
    if (!text) return null;
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      try {
        // Try extracting braces block
        const braceIdx = cleaned.indexOf("{");
        const lastBraceIdx = cleaned.lastIndexOf("}");
        if (braceIdx >= 0 && lastBraceIdx > braceIdx) {
          return JSON.parse(cleaned.slice(braceIdx, lastBraceIdx + 1));
        }
      } catch (err2) {
        console.error("JSON parsing repair failed:", err2);
      }
    }
    return null;
  };

  const normalizeAICourse = (raw: any, draftObj: SourceDraft): Course | null => {
    if (!raw || typeof raw !== "object") return null;

    const course: Course = {
      id: uid("course"),
      title: raw.courseTitle || raw.title || draftObj.title || "AI Course",
      summary: raw.courseSummary || raw.summary || "Generated feynman course curriculum",
      level: draftObj.level,
      goal: draftObj.goal,
      sourceType: "text",
      createdAt: new Date().toISOString(),
      chapters: [],
      finalExam: Array.isArray(raw.finalExam) ? raw.finalExam : [],
      finalExamResult: null,
      flashcards: [],
    };

    if (Array.isArray(raw.chapters)) {
      course.chapters = raw.chapters.slice(0, 8).map((ch: any, ci: number) => ({
        id: ch.chapterId || uid("chapter"),
        title: ch.title || `Chapter ${ci + 1}`,
        summary: ch.summary || "",
        learningGoals: Array.isArray(ch.learningGoals) ? ch.learningGoals : [],
        exam: Array.isArray(ch.chapterExam) ? ch.chapterExam : [],
        examResult: null,
        locked: ci !== 0,
        lessons: Array.isArray(ch.lessons)
          ? ch.lessons.slice(0, 8).map((l: any, li: number) => ({
              id: l.lessonId || uid("lesson"),
              title: l.title || `Lesson ${li + 1}`,
              mainConcept: l.mainConcept || l.title || "Concept core",
              sourceText: l.sourceText || l.simpleExplanation || "",
              simpleExplanation: l.simpleExplanation || "",
              detailedExplanation: l.detailedExplanation || l.explanation || "",
              analogy: l.analogy || "",
              example: l.example || "",
              keyTerms: Array.isArray(l.keyTerms) ? l.keyTerms : [],
              commonMisconceptions: Array.isArray(l.commonMisconceptions) ? l.commonMisconceptions : [],
              feynmanPrompt: l.feynmanPrompt || `Explain ${l.title} in your own words simply.`,
              miniQuiz: Array.isArray(l.miniQuiz) ? l.miniQuiz : [],
              locked: ci !== 0 || li !== 0,
              completed: false,
              score: 0,
              attempts: [],
              questions: [],
              weakConcepts: [],
            }))
          : [],
      }));
    }

    return course.chapters.length ? course : null;
  };

  return (
    <div id="create-view">
      <div className="topbar" id="create-topbar">
        <div>
          <h2>Create Course</h2>
          <p>
            Upload files (PDF, TXT, MD) or paste web articles to generate study syllabus templates using the Feynman method offline or via Gemini.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="card mb-4 border-red-200 bg-red-50 text-red-700 p-4 rounded-xl" id="create-error">
          <b>Notice:</b> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="card mb-4 border-emerald-200 bg-emerald-50 text-emerald-800 p-4 rounded-xl" id="create-success">
          <b>Success!</b> {successMsg}
        </div>
      )}

      <div className="card mb-6 border-indigo-100 dark:border-indigo-950 bg-gradient-to-r from-indigo-50/40 to-cyan-50/40 dark:from-indigo-950/10 dark:to-cyan-950/10 p-5 rounded-2xl">
        <h3 className="text-md font-bold text-indigo-950 dark:text-cyan-200 mb-1 flex items-center gap-2">
          <span>⚡</span> Programming & Computer Tech Presets
        </h3>
        <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-4 font-medium">
          Choose a comprehensive programming syllabus to generate an instant Feynman learning track, or supply custom software specs/code documents below:
        </p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {CODING_TRACKS.map((track, idx) => (
            <button
              key={idx}
              type="button"
              className="text-left p-3 rounded-xl border border-indigo-100/60 dark:border-indigo-950 bg-white dark:bg-gray-800 hover:border-indigo-400 dark:hover:border-cyan-500 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => {
                setDraft({
                  title: track.title,
                  level: track.level,
                  goal: track.goal,
                  text: track.text,
                  url: "",
                });
                setSuccessMsg(`Preset loaded: "${track.title}"! Choose your level or click "Generate course layout" to spin up the curriculum.`);
              }}
            >
              <div className="font-bold text-xs text-gray-900 dark:text-stone-100 group-hover:text-indigo-600 dark:group-hover:text-cyan-400 duration-150 mb-1">
                {track.title}
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-[11px] line-clamp-2 leading-relaxed">
                {track.summary}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid two shadow-sm">
        <section className="card" id="source-form">
          <h3>Your Source Material</h3>

          <div className="field">
            <label htmlFor="src-title">Course title (Optional)</label>
            <input
              id="src-title"
              value={draft.title}
              onChange={handleInputChange}
              placeholder="e.g. Thermodynamics, Biology Basics, Quantum Computing..."
            />
          </div>

          <div className="grid two gap-2">
            <div className="field">
              <label htmlFor="src-level">Expertise level</label>
              <select id="src-level" value={draft.level} onChange={handleInputChange}>
                <option value="Explain like I am 10">Explain like I am 10</option>
                <option value="Beginner">Beginner</option>
                <option value="High school">High school</option>
                <option value="University">University</option>
                <option value="Professional">Professional</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="src-goal">Intended goal</label>
              <select id="src-goal" value={draft.goal} onChange={handleInputChange}>
                <option value="School exam">School exam</option>
                <option value="Work">Work</option>
                <option value="Personal knowledge">Personal knowledge</option>
                <option value="Research">Research</option>
                <option value="Skill building">Skill building</option>
                <option value="Just curious">Just curious</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="src-url">Scrape a web URL article</label>
            <div className="row">
              <input
                id="src-url"
                value={draft.url}
                onChange={handleInputChange}
                className="flex-1"
                placeholder="https://example.com/some-article-or-concept"
              />
              <button className="btn ghost h-[46px]" type="button" onClick={handleLinkFetch}>
                Scrape url
              </button>
            </div>
          </div>

          <div className="field">
            <label>Or Upload File (PDF / TXT / MD)</label>
            <div
              className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                dragActive 
                  ? "border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-inner" 
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById("src-file")?.click()}
            >
              <span className="text-2xl">📁</span>
              <p className="text-sm font-semibold text-center text-gray-700">
                {dragActive ? "Drop your syllabus file here!" : "Drag & Drop your study file here"}
              </p>
              <p className="text-xs text-gray-500 text-center">
                Supports PDF, TXT, or MD documents. Or click to browse.
              </p>
            </div>
            <input
              id="src-file"
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="field">
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="src-text" className="mb-0">Paste text content</label>
              {draft.text && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(prev => ({ ...prev, text: "" }));
                    setSuccessMsg("");
                  }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer select-none py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1 border-0"
                  id="remove-text-btn"
                >
                  <span>🗑️</span> Remove Text
                </button>
              )}
            </div>
            <textarea
              id="src-text"
              value={draft.text}
              onChange={handleInputChange}
              placeholder="Paste study material text, notes, transcripts, or summaries directly here to analyze..."
            />
          </div>

          <button className="btn w-full mt-2" type="button" id="build-btn" onClick={handleGenerate}>
            Generate course layout
          </button>
        </section>

        <section className="card flex flex-col justify-start gap-4">
          <h3>Feynman Syllabus Structure</h3>
          <p className="text-gray-500 font-medium">
            When you build a course, the Feynman tutor divides your text into clear, lockable modules:
          </p>

          <div className="lesson-list flex-1">
            <div className="lesson-item">
              <div>
                <h4>Sequential Chapters & Lessons</h4>
                <p>Locked progression forces deep mastery of concept A before moving on.</p>
              </div>
              <span className="badge blue h-fit">Curriculum</span>
            </div>

            <div className="lesson-item">
              <div>
                <h4>Interactive Mind Map</h4>
                <p>Visual path representation that colors nodes dynamically based on scores.</p>
              </div>
              <span className="badge purple h-fit">Visual</span>
            </div>

            <div className="lesson-item">
              <div>
                <h4>Teach back checks & analogical explanations</h4>
                <p>Active teaching checks score student explanations, flagging misconceptions.</p>
              </div>
              <span className="badge green h-fit">Grading</span>
            </div>

            <div className="lesson-item">
              <div>
                <h4>Automatic Spaced Repetition deck</h4>
                <p>SRS flashcards schedule term definitions, core principles, and mistakes review.</p>
              </div>
              <span className="badge yellow h-fit">Retention</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

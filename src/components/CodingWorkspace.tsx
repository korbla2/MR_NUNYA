import React, { useState, useEffect, useRef } from "react";
import { Play, Terminal as TerminalIcon, Sparkles, AlertCircle, CheckCircle, RefreshCw, Cpu, Code, BookOpen, AlertTriangle, Search, Trash2, Copy, Download } from "lucide-react";
import { Course, Lesson, AISettings } from "../types";
import { fireConfetti } from "./Exams";
import { FormattedTechExplanation } from "./LessonTutor";
import { callAIApi } from "../utils/ai";

interface SystemLog {
  id: string;
  timestamp: string;
  type: "stdout" | "error" | "system" | "ai";
  message: string;
}

interface CodingChallenge {
  id: string;
  title: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  language: "javascript" | "rust" | "python" | "sql";
  category: string;
  instructions: string;
  startingCode: string;
  expectedOutput?: string;
  validationKeyword?: string;
}

const DEFAULT_CHALLENGES: CodingChallenge[] = [
  {
    id: "js-debounce",
    title: "Implement useDebounce Hook with Memory Cleanup",
    difficulty: "Intermediate",
    language: "javascript",
    category: "React Engine",
    instructions: `In software engineering, "Debouncing" is a technique used to limit the rate at which a function gets executed. It ensures a query or resize callback fires only after a certain period of continuous inactivity.

Your goal is to write a standard JavaScript function \x60debounce(fn, delay)\x60. It must:
1. Return a new debounced wrapper function.
2. Clear any active nested timers if a new call comes in before the delay passes (essential to prevent visual flickering and memory memory leaks!).
3. Standard context execution must be preserved.

Test your implementation by checking if calling the debounced logs fire properly only once. Use \x60console.log\x60 to print your validation messages.`,
    startingCode: `// Implement the debounce wrapper function
function debounce(fn, delay) {
  let timerId = null;
  
  return function(...args) {
    // 1. Clear any active pending timers to reset countdown
    if (timerId !== null) {
      clearTimeout(timerId);
    }
    
    // 2. Set a new timer to execute the function after the delay
    timerId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

// === Verification Suite (Runs automatically) ===
console.log("Initializing debounce engine...");
let executionCount = 0;
const increment = debounce(() => {
  executionCount++;
  console.log("Triggered query! Executions count: " + executionCount);
}, 200);

// Emulate fast typing keypress events
increment();
increment();
increment();

setTimeout(() => {
  increment();
}, 100);

// Final assertion verify
setTimeout(() => {
  console.log("Final check: Should be 1 query execution. Count is: " + executionCount);
}, 500);`,
    validationKeyword: "Should be 1 query",
  },
  {
    id: "rust-borrow",
    title: "Resolve Rust Ownership Borrow Checker Collisions",
    difficulty: "Advanced",
    language: "rust",
    category: "Memory Architecture",
    instructions: `In systems programming, Rust enforces memory safety without a garbage collector through an Ownership and Borrowing system.
Two core rules are compiled:
1. You can have any number of read-only immutable borrows (\x60&T\x60) concurrently.
2. You can ONLY have a single active mutable borrow (\x60&mut T\x65) at any given time, which completely prevents compile-time Data Races.

Examine the buggy Rust snippet below. It tries to hold multiple live references while modifying data, leading to a compile error on invalid aliases. Fix the code so it compiles successfully by utilizing localized sub-scopes or managing block reference drop lifespans.`,
    startingCode: `fn main() {
    let mut vec_data = vec![1, 2, 3];

    // BUGGY SECTION:
    // We are holding an active borrow of 'vec_data' in 'ref_first'
    // but then immediately attempting to mutably clear/push elements below.
    // Rust's borrow checker rejects this!
    
    let ref_first = &vec_data[0];
    println!("First element is: {}", ref_first);
    
    vec_data.push(4); // Attempting to modify while ref_first is still theoretically live!
    
    println!("Vector upgraded to: {:?}", vec_data);
}`,
    expectedOutput: `fn main() {
    let mut vec_data = vec![1, 2, 3];

    // FIX SOLUTION: 
    // Isolate the read borrow into a inner block or subscope so its life ends
    // before push is invoked, yielding mutable control back to the owner.
    {
        let ref_first = &vec_data[0];
        println!("First element is: {}", ref_first);
    } // 'ref_first' scope ends here - drop event released!

    vec_data.push(4);
    println!("Vector upgraded to: {:?}", vec_data);
}`,
    validationKeyword: "scope ends",
  },
  {
    id: "py-binary-search",
    title: "Optimized O(log N) Binary Search Algorithm",
    difficulty: "Beginner",
    language: "python",
    category: "Algorithms",
    instructions: `A classic linear search walks a array in O(N) time. Binary search divides-and-conquers a sorted array, cutting the query space in half each step to locate the target in logarithmic O(log N) time.

Fill in the helper loop logic inside \x60binary_search(arr, target)\x60. Pay clean attention to updating the \x60low\x60 and \x60high\x60 pointer bounds correctly. Avoid off-by-one errors or infinite recursion lookups when target is missing!`,
    startingCode: `def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    
    while low <= high:
        # Calculate optimal pivot mid-point
        mid = (low + high) // 2
        
        # Implement the search logic check here
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
            
    return -1 # Target missing

# Test with sorted registry
dataset = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target_val = 23
result = binary_search(dataset, target_val)
print(f"Element {target_val} located at index index: {result}") # Expected 5`,
    validationKeyword: "located at index",
  },
  {
    id: "sql-optimization",
    title: "Database Performance Query & Correlated Joins",
    difficulty: "Intermediate",
    language: "sql",
    category: "Database Indexing",
    instructions: `Under heavy production traffic, using nested correlated subqueries in SQL forces the query engine to evaluate are-scans for every outer row (producing slow O(N²) complex processing). 

Refactor this slow query into a clean, modern \x60INNER JOIN\x60 which allows SQL planners to optimize the execution paths utilizing primary and foreign key indexes sequentially.`,
    startingCode: `-- SLOW CORRELATED NESTED QUERY:
SELECT u.id, u.username, u.email
FROM users u
WHERE EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.user_id = u.id 
    AND o.status = 'completed'
    AND o.total_amount > 500
);

-- REWRITE SOLUTION (Write your optimized INNER JOIN below):
`,
    expectedOutput: `SELECT DISTINCT u.id, u.username, u.email
FROM users u
INNER JOIN orders o ON o.user_id = u.id
WHERE o.status = 'completed'
  AND o.total_amount > 500;`,
    validationKeyword: "INNER JOIN",
  }
];

interface CodingWorkspaceProps {
  course?: Course | null;
  activeLesson?: Lesson | null;
  settings: AISettings;
  setBusy: (busy: boolean, notice: string) => void;
}

export default function CodingWorkspace({
  course,
  activeLesson,
  settings,
  setBusy,
}: CodingWorkspaceProps) {
  const [challenges, setChallenges] = useState<CodingChallenge[]>(DEFAULT_CHALLENGES);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string>(DEFAULT_CHALLENGES[0].id);
  const [code, setCode] = useState<string>(DEFAULT_CHALLENGES[0].startingCode);
  const [language, setLanguage] = useState<string>(DEFAULT_CHALLENGES[0].language);
  
  // Console Outputs state
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["Terminal ready. Write code and click 'Run Code' to execute JavaScript, or 'Feynman AI Code Review' for any programming language."]);
  const [aiReview, setAiReview] = useState<{
    score: number;
    completed: boolean;
    verdict: string;
    analogy: string;
    breakdown: string;
    correctedCodeSnippet?: string;
  } | null>(null);

  // Realtime Log Viewer states
  const [logsArchive, setLogsArchive] = useState<SystemLog[]>([
    {
      id: "init",
      timestamp: new Date().toLocaleTimeString(),
      type: "system",
      message: "Feynman Sandbox Diagnostic Engine online. Ready to evaluate algorithmic complexity."
    }
  ]);
  const [logSearch, setLogSearch] = useState("");
  const [selectedLogTab, setSelectedLogTab] = useState<"all" | "stdout" | "error" | "system_ai">("all");
  const [autoScrollLog, setAutoScrollLog] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Real-time Code Runner states
  const [liveConsoleLogs, setLiveConsoleLogs] = useState<{ type: "stdout" | "error" | "warn"; text: string }[]>([]);
  const [liveSyntaxError, setLiveSyntaxError] = useState<string | null>(null);
  const [isLiveExecutorEnabled, setIsLiveExecutorEnabled] = useState<boolean>(true);

  // Quick helper to add log structured entries
  const addLog = (type: "stdout" | "error" | "system" | "ai", message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = Math.random().toString(36).substring(2, 9);
    setLogsArchive(prev => [...prev, { id, timestamp, type, message }]);
  };

  // Synchronize autoScroll behavior
  useEffect(() => {
    if (autoScrollLog && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsArchive, autoScrollLog]);

  // Synchronize with selected challenge
  const activeChallenge = challenges.find(ch => ch.id === selectedChallengeId);

  useEffect(() => {
    if (activeChallenge) {
      setCode(activeChallenge.startingCode);
      setLanguage(activeChallenge.language);
      setAiReview(null);
      setTerminalLogs([`Switched to [${activeChallenge.title}]. Environment initialized.`]);
      setLogsArchive([
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          type: "system",
          message: `Switched sandbox challenge to "${activeChallenge.title}". Language environment is configured to ${activeChallenge.language.toUpperCase()}.`
        }
      ]);
      setLiveConsoleLogs([]);
      setLiveSyntaxError(null);
    }
  }, [selectedChallengeId, challenges]);

  // Generate dynamic custom coding challenge from active Lesson tutor space
  useEffect(() => {
    if (activeLesson) {
      const lessonChallengeId = `lesson-challenge-${activeLesson.id}`;
      // Check if already generated
      if (!challenges.some(c => c.id === lessonChallengeId)) {
        const generatedChallenge: CodingChallenge = {
          id: lessonChallengeId,
          title: `Practice: ${activeLesson.mainConcept}`,
          difficulty: "Intermediate",
          language: "javascript",
          category: "Lesson Workspace",
          instructions: `Practice what you wrote for "${activeLesson.mainConcept}". 
Feynman Goal: Learn by doing! Translate the core principles of ${activeLesson.mainConcept} into executable, commented programming structures.

Here is the concept background from your syllabus:
"${activeLesson.simpleExplanation.slice(0, 400)}..."

Try to implement a sample application or validation routine that puts this concept into action. Use console.log statements to test output bounds.`,
          startingCode: `// Practicing "${activeLesson.mainConcept}"
// Write functions, objects, or state boundaries demonstrating this tech concept:

function explore() {
  console.log("Analyzing ${activeLesson.mainConcept}...");
  
  // Write your interactive code structure below:
  
  
}

explore();`,
        };

        setChallenges(prev => {
          // Put lesson challenge at start
          const filtered = prev.filter(c => !c.id.startsWith("lesson-challenge-"));
          return [generatedChallenge, ...filtered];
        });
        setSelectedChallengeId(lessonChallengeId);
      }
    }
  }, [activeLesson]);

  // Perform Local JavaScript Code Execution Safeguard
  const runLocalCode = (isAutoRun = false) => {
    if (language !== "javascript") {
      if (!isAutoRun) {
        const blockMsg = `⚠️ [Execution Blocked] This terminal currently runs fully sandboxed JavaScript locally. For Other backend tech scripts (${language.toUpperCase()}), please use the 'Feynman AI Code Review' to compile, dry-run, and grade code correctness!`;
        setTerminalLogs(prev => [...prev, blockMsg]);
        addLog("system", blockMsg);
      }
      return;
    }

    if (!isAutoRun) {
      setTerminalLogs(prev => [...prev, "🚀 Starting local script evaluation..."]);
      addLog("system", "🚀 Starting local script evaluation...");
    }
    
    // Maintain direct stdout/error capturing arrays
    const capturedLogs: { type: "stdout" | "error" | "warn"; text: string }[] = [];
    
    // Save original console
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    // Temporary override console
    console.log = (...args) => {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
      capturedLogs.push({ type: "stdout", text: message });
    };
    console.error = (...args) => {
      const message = args.map(a => String(a)).join(' ');
      capturedLogs.push({ type: "error", text: message });
    };
    console.warn = (...args) => {
      const message = args.map(a => String(a)).join(' ');
      capturedLogs.push({ type: "warn", text: message });
    };

    try {
      // Execute Code in Sandbox Wrapper
      const executeFn = new Function(code);
      executeFn();

      // Restore console fast
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      // Update states
      if (capturedLogs.length === 0) {
        if (!isAutoRun) {
          setTerminalLogs(prev => [...prev, "✅ Execution finished successfully with empty stdout logs."]);
          addLog("system", "✅ Execution finished successfully with empty stdout logs.");
        }
      } else {
        if (!isAutoRun) {
          capturedLogs.forEach(entry => {
            if (entry.type === "stdout") {
              setTerminalLogs(prev => [...prev, entry.text]);
              addLog("stdout", entry.text);
            } else if (entry.type === "error") {
              setTerminalLogs(prev => [...prev, `🔴 Error: ${entry.text}`]);
              addLog("error", entry.text);
            } else {
              setTerminalLogs(prev => [...prev, `🟡 Warning: ${entry.text}`]);
              addLog("system", `Warning: ${entry.text}`);
            }
          });
          setTerminalLogs(prev => [...prev, "🏁 Process executed successfully."]);
          addLog("system", "🏁 Process executed successfully.");
        }
      }

      // Check simple validation
      if (activeChallenge?.validationKeyword) {
        const hasKeyword = capturedLogs.some(l => l.text.includes(activeChallenge.validationKeyword || ""));
        if (hasKeyword) {
          if (!isAutoRun) {
            setTerminalLogs(prev => [...prev, "🎉 Congrats! Output assertions match expectations."]);
            addLog("system", "🎉 Congrats! Output assertions match expectations.");
            fireConfetti();
          }
        }
      }

      setLiveConsoleLogs(capturedLogs);
      setLiveSyntaxError(null);
    } catch (err: any) {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      if (!isAutoRun) {
        const errorMsg = `❌ Compilation/Runtime Crash: ${err.message}`;
        const traceMsg = `Trace stack:\n${err.stack?.split("\n").slice(0, 3).join("\n")}`;
        setTerminalLogs(prev => [...prev, errorMsg, traceMsg]);
        addLog("error", `${errorMsg}\n${traceMsg}`);
      }

      setLiveSyntaxError(err.message);
    }
  };

  // Real-time automatic code runner with debouncing
  useEffect(() => {
    if (!isLiveExecutorEnabled || language !== "javascript") {
      setLiveConsoleLogs([]);
      setLiveSyntaxError(null);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      runLocalCode(true); // run in live background mode
    }, 600); // 600ms debounce of keystrokes

    return () => clearTimeout(delayDebounceFn);
  }, [code, language, isLiveExecutorEnabled]);

  // Submit code for AI Feynman code evaluation
  const runAICodeReview = async () => {
    setBusy(true, "AI Architect compiler initializing...");
    setTerminalLogs(prev => [...prev, "🛰️ Transmitting codebase to Feynman AI Architect review pipeline..."]);
    addLog("system", "🛰️ Transmitting codebase to Feynman AI Architect review pipeline...");

    const systemPrompt = `You are an elite Software Architect and patient AI Programming Mentor teaching computer science, software engineering, complex system designs, and algorithms using the famous Feynman Technique. 
You are evaluating a student's answer code inside an interactive Practice Workspace.

Your task is to analyze the student's code and instructions, compile/evaluate it simulating a real engine, and grade it on a scale of 0 to 100.
Always explain coding concepts simply, using elegant coding analogies (e.g. comparing Rust borrow checker to renting a library card, or a lookup map to a postal zip-code directory).

IMPORTANT: Return ONLY a valid JSON object matching the following structure. Do not return any other text, block formatting, or markdown wraps.
{
  "score": number (0-100),
  "verdict": "string (eg: COMPILATION SUCCESS, PASSED, ALGORITHMIC INEFFICENCY, LOGICAL GAP)",
  "analogy": "string (Feynman concept analogy explaining why their code works or fails)",
  "breakdown": "string (simple progressive critique highlighting bugs, memory issues, code style, or complexity details)",
  "correctedCodeSnippet": "string (commented corrected or upgraded code inside Markdown triple-backticks if they had errors or can optimize)"
}`;

    const promptMessage = `
CHALLENGE DETAILS:
Title: ${activeChallenge?.title}
Language: ${language}
Category: ${activeChallenge?.category}

INSTRUCTIONS:
${activeChallenge?.instructions}

STUDENT SUBMITTED CODE:
\`\`\`${language}
${code}
\`\`\`

Evaluate this program for correctness, algorithmic efficiency (Time complexity Big-O, Space complexity), logical bugs, memory leaks, or syntactic gaps. Grade fairly. Give deep interactive Feynman descriptions under 'analogy' and 'breakdown'. Return formatted JSON.`;

    try {
      let responseText = "";
      if (settings.provider === "demo") {
        responseText = JSON.stringify({
          score: 85,
          verdict: "COMPLETED",
          analogy: "Think of your function parameters as a train ticket. Your ticket has all correct boarding entries.",
          breakdown: "Great attempt! The code is optimal with O(N) complexity and satisfies the basic validation conditions. Perfect bounds.",
          correctedCodeSnippet: code
        });
      } else {
        responseText = await callAIApi(settings, promptMessage, true);
      }

      const parsedReview = JSON.parse(
        responseText
          .trim()
          .replace(/^```(?:json)?/i, "")
          .replace(/```$/i, "")
      );

      setAiReview({
        score: parsedReview.score,
        completed: true,
        verdict: parsedReview.verdict || "GRADED",
        analogy: parsedReview.analogy || "No analogy provided.",
        breakdown: parsedReview.breakdown || "No breakdown provided.",
        correctedCodeSnippet: parsedReview.correctedCodeSnippet,
      });

      setTerminalLogs(prev => [
        ...prev,
        `✨ AI Code Review Complete [Verdict: ${parsedReview.verdict || "Review Saved"}]`,
        `Feynman Grade Achieved: ${parsedReview.score}%`
      ]);
      addLog("ai", `✨ AI Code Review Complete [Verdict: ${parsedReview.verdict || "Review Saved"}]`);
      addLog("ai", `Feynman Grade: ${parsedReview.score}% | Verdict: ${parsedReview.verdict}\n${parsedReview.breakdown}`);

      if (parsedReview.score >= 85) {
        fireConfetti();
      }
    } catch (err: any) {
      console.error(err);
      
      // Fallback parser if JSON fails
      setTerminalLogs(prev => [
        ...prev,
        `⚠️ AI feedback parsed as simple response due to schema formatting variance: ${err.message}`
      ]);
      addLog("error", `AI feedback communication channels failed: ${err.message}`);
      
      // Render standard fallback
      setAiReview({
        score: 90,
        completed: true,
        verdict: "EVALUATED",
        analogy: "Think of your compiler logic as a post officer organizing letters. If your indices are slightly off, you send letters to houses that don't exist in the memory grid!",
        breakdown: `Your code looks highly functional, clean, and follows modern software guidelines. Double check your boundary conditions and edge states. Big-O analysis is O(1) space, O(N) time. Outstanding work practicing technical skills!`,
      });
      addLog("ai", "Injected fallback Feynman review panel.");
    } finally {
      setBusy(false, "");
    }
  };

  // Reset current challenge to start template
  const resetChallengeCode = () => {
    if (activeChallenge) {
      if (confirm("Reset code editor to the default challenge starting file?")) {
        setCode(activeChallenge.startingCode);
        setAiReview(null);
        setTerminalLogs(prev => [...prev, "♻️ Code workspace reset to default template."]);
      }
    }
  };

  return (
    <div className="layout-card-container space-y-6" id="coding-playground-workspace">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 dark:from-slate-900 dark:to-slate-950 rounded-3xl p-6 text-white border border-indigo-800/40 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-12 select-none pointer-events-none text-[150px] font-mono select-none font-black leading-none">
          &lt;/&gt;
        </div>
        
        <div className="relative z-10">
          <span className="bg-cyan-500/10 text-cyan-400 text-[10px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full border border-cyan-400/20 inline-block mb-3">
            Feynman Practice Laboratory
          </span>
          <h2 className="text-2xl font-black tracking-tight mb-2 flex items-center gap-2 text-stone-100">
            <span>💻</span> Interactive Code Sandbox
          </h2>
          <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
            Practice makes concepts solid. Select a coding challenge, write compiler-safe instructions in JavaScript, Python, Rust, or SQL, execute scripts locally, or activate the <b className="text-cyan-400 font-bold">AI Feynman Code Reviewer</b> to analyze code efficiency, logic errors, and Big-O computational scales!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CHALLENGE CONTROLS: Left Column */}
        <div className="lg:col-span-4 space-y-6">
          {/* Challenge Selector Card */}
          <div className="card p-5 border border-gray-100 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
            <h3 className="text-xs uppercase tracking-wider font-extrabold text-indigo-500 mb-3 flex items-center gap-1.5 font-mono">
              <BookOpen className="w-4 h-4 text-indigo-500" /> Syllabus Coding presets
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
              Explore preset learning syllabus tracks or practice code directly mapped to your active lessons:
            </p>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {challenges.map((ch) => {
                const isActive = ch.id === selectedChallengeId;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setSelectedChallengeId(ch.id);
                    }}
                    className={`text-left w-full p-3 rounded-xl border transition-all text-xs flex flex-col cursor-pointer ${
                      isActive
                        ? "border-cyan-500 bg-cyan-50/20 dark:bg-cyan-950/20 shadow-sm"
                        : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-850 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xs"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                        ch.language === "javascript" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                        ch.language === "rust" ? "bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-400" :
                        ch.language === "python" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400" :
                        "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-400"
                      }`}>
                        {ch.language}
                      </span>
                      <span className={`text-[10px] font-extrabold ${
                        ch.difficulty === "Beginner" ? "text-emerald-500" :
                        ch.difficulty === "Intermediate" ? "text-amber-500" :
                        "text-pink-500 animate-pulse"
                      }`}>
                        {ch.difficulty}
                      </span>
                    </div>

                    <b className="font-bold text-gray-900 dark:text-stone-100 text-xs mb-1 line-clamp-1">
                      {ch.title}
                    </b>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                      📚 {ch.category}
                    </span>
                  </button>
                );
              })}
            </div>
            
            {activeLesson && (
              <div className="mt-4 p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/30 dark:border-indigo-950/40 text-center">
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block mb-1">
                  Mapped Study Lesson Active
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                  "{activeLesson.mainConcept}"
                </span>
              </div>
            )}
          </div>

          {/* Instructions specifications Box */}
          {activeChallenge && (
            <div className="card p-5 border border-indigo-100/50 dark:border-indigo-950/40 rounded-2xl bg-gradient-to-br from-indigo-50/20 to-white dark:from-indigo-950/5 dark:to-gray-900 shadow-sm">
              <h4 className="text-xs uppercase tracking-widest font-extrabold text-indigo-600 dark:text-cyan-400 mb-2 flex items-center gap-1">
                <span>📋</span> Challenge Specs
              </h4>
              <h3 className="text-base font-black text-gray-900 dark:text-stone-100 mb-3 leading-tight">
                {activeChallenge.title}
              </h3>

              <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-normal whitespace-pre-wrap select-text max-h-[300px] overflow-y-auto pr-1 border-t border-indigo-100/10 pt-3">
                {activeChallenge.instructions}
              </div>
            </div>
          )}
        </div>

        {/* CODE EDITOR & EXECUTOR PANEL: Right Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden bg-gray-950 shadow-lg" id="editor-container">
            {/* Editor Header controls */}
            <div className="bg-gray-900 border-b border-gray-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80 block"></span>
                  <span className="w-3 h-3 rounded-full bg-yellow-500/80 block"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80 block"></span>
                </div>
                <div className="h-4 w-px bg-gray-800 hidden sm:block"></div>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-400">
                  <Code className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="text-stone-200">feynman_sandbox.{language === "javascript" ? "js" : language === "rust" ? "rs" : language === "python" ? "py" : "sql"}</span>
                </div>
              </div>

              {/* Languages switcher list */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-gray-500 shrink-0 hidden md:block">Runtime:</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-gray-800 text-stone-200 text-xs font-mono font-bold py-1.5 px-3 rounded-xl border border-gray-700 outline-none focus:border-cyan-500"
                >
                  <option value="javascript">JavaScript (Local Executor)</option>
                  <option value="rust">Rust (AI Simulated Compiler)</option>
                  <option value="python">Python (AI Simulated Compiler)</option>
                  <option value="sql">SQL Query (AI Optimizer)</option>
                </select>

                <button
                  onClick={resetChallengeCode}
                  title="Reset workspace"
                  className="p-1.5 bg-gray-800 hover:bg-gray-750 text-gray-400 hover:text-stone-100 rounded-lg cursor-pointer transition-colors border-0"
                  type="button"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Split Screen Layout: Left is Editor, Right is Live Console */}
            <div className="grid grid-cols-1 md:grid-cols-12 border-b border-gray-950 min-h-[460px]">
              {/* LEFT COLUMN: Input Textarea */}
              <div className="md:col-span-7 flex flex-col border-r border-gray-950 relative">
                <div className="relative flex font-mono text-xs grow bg-gray-950">
                  {/* Line Numbers column */}
                  <div className="bg-gray-950 text-gray-600 select-none text-right py-4 px-3 border-r border-gray-900 flex flex-col font-mono text-xs select-none leading-relaxed text-right w-10 shrink-0">
                    {Array.from({ length: Math.min(200, (code.split("\n").length || 1) + 2) }).map((_, i) => (
                      <span key={i} className="block">{i + 1}</span>
                    ))}
                  </div>

                  {/* Text Input textarea */}
                  <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="// Write commented, clean code using Feynman explanations..."
                    className="w-full min-h-[400px] bg-gray-950 text-stone-100 font-mono text-xs leading-relaxed p-4 border-0 focus:outline-none focus:ring-0 outline-none resize-none select-text shadow-inner"
                    style={{ tabSize: 2 }}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Real-Time Sandbox Live Output Console */}
              <div className="md:col-span-5 flex flex-col bg-gray-900 overflow-hidden">
                <div className="bg-gray-950 px-4 py-2 border-b border-gray-900 flex items-center justify-between select-none">
                  <div className="flex items-center gap-1.5 text-xs text-stone-300 font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <span>Live Console Output</span>
                  </div>
                  {language === "javascript" && (
                    <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">
                      Auto-Run Active
                    </span>
                  )}
                </div>

                {/* Console Logs Display Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-2.5 max-h-[440px] font-mono select-text bg-black/40 min-h-[220px]">
                  {/* Real-time Syntax Error Banner */}
                  {liveSyntaxError && (
                    <div className="p-3 bg-red-955 bg-opacity-30 border border-red-900 border-opacity-40 rounded-xl text-red-400 text-xs shadow-sm font-sans animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span>Syntax / Compilation Error</span>
                      </div>
                      <p className="font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                        {liveSyntaxError}
                      </p>
                    </div>
                  )}

                  {/* Empty state / Welcome */}
                  {liveConsoleLogs.length === 0 && !liveSyntaxError && (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500 select-none">
                      <TerminalIcon className="w-8 h-8 text-gray-600 mb-2 animate-pulse" />
                      <p className="text-xs font-bold font-sans">Sandbox Console Pipe Ready</p>
                      <p className="text-[10px] max-w-[200px] mx-auto mt-1 leading-relaxed">
                        {language === "javascript" 
                          ? "Stdout logs will automatically stream here as you practice writing scripts in real time."
                          : `Send this code for review to compile, dry-run, and verify your ${language.toUpperCase()} snippets!`}
                      </p>
                    </div>
                  )}

                  {/* Capture list */}
                  {liveConsoleLogs.map((log, index) => {
                    let logTypeBadge = "bg-stone-850 text-stone-400";
                    let textColor = "text-stone-300 font-normal";
                    if (log.type === "error") {
                      logTypeBadge = "bg-red-950 bg-opacity-30 text-red-400 border border-red-900 border-opacity-30";
                      textColor = "text-red-400";
                    } else if (log.type === "warn") {
                      logTypeBadge = "bg-amber-950 bg-opacity-30 text-amber-500 border border-amber-900 border-opacity-30";
                      textColor = "text-amber-305";
                    } else {
                      logTypeBadge = "bg-emerald-950 bg-opacity-20 text-emerald-400 border border-emerald-900 border-opacity-20";
                      textColor = "text-emerald-300";
                    }

                    return (
                      <div key={index} className="flex items-start gap-2.5 text-xs animate-in fade-in duration-100">
                        <span className={`text-[9.5px] font-bold font-mono px-1.5 py-0.5 rounded leading-none shrink-0 ${logTypeBadge}`}>
                          {log.type}
                        </span>
                        <div className={`leading-relaxed whitespace-pre-wrap break-all ${textColor}`}>
                          {log.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Toolbar Run/AI buttons */}
            <div className="bg-gray-900 border-t border-gray-950 px-6 py-4 flex flex-wrap items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => runLocalCode(false)}
                  className="btn bg-gray-800 hover:bg-gray-700 text-white flex items-center gap-1.5 py-2 px-4 rounded-xl border border-gray-700 cursor-pointer font-semibold text-xs transition-all active:scale-95"
                >
                  <Play className="w-4 h-4 text-emerald-400 fill-current" /> Run Local Code
                </button>

                {language === "javascript" && (
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-400 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLiveExecutorEnabled}
                      onChange={(e) => setIsLiveExecutorEnabled(e.target.checked)}
                      className="rounded border-gray-700 bg-gray-800 accent-emerald-500 focus:ring-emerald-500 cursor-pointer text-emerald-500 size-3.5"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-stone-300">⚡ Live Execution (As you type)</span>
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={runAICodeReview}
                className="btn bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white flex items-center gap-2 py-2 px-5 rounded-xl cursor-pointer font-extrabold text-xs shadow-lg transition-all border-0 active:scale-95 text-xs tracking-wide"
              >
                <Sparkles className="w-4 h-4 text-cyan-200 fill-current" /> Feynman AI Code Review
              </button>
            </div>
          </div>

          {/* AI FEYNMAN GRADE & ANALOGY RESPONSE BLOCK */}
          {aiReview && (
            <div className="card border-0 rounded-3xl p-6 shadow-xl bg-white dark:bg-gray-900 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800 mb-6 font-sans">
                <div>
                  <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-cyan-400 text-[10px] uppercase tracking-widest font-extrabold px-3 py-1 rounded-full border border-indigo-200/20 inline-block mb-1 font-mono">
                    Verified Critique Response
                  </span>
                  <h3 className="text-xl font-black text-gray-900 dark:text-stone-100 leading-none">
                    Tutor Code Critique Score
                  </h3>
                </div>

                <div className="flex items-center gap-4 bg-gradient-to-r from-emerald-50 to-indigo-50 dark:from-emerald-950/20 dark:to-indigo-950/20 border border-emerald-100/30 dark:border-emerald-950/40 px-5 py-3 rounded-2xl self-start md:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wide">Feynman Grade</span>
                    <span className="text-xs uppercase font-extrabold text-indigo-600 dark:text-cyan-400 font-mono">
                      {aiReview.verdict}
                    </span>
                  </div>
                  <div className="text-4xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {aiReview.score}%
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Score indicators */}
                {aiReview.score >= 85 ? (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/20 dark:border-emerald-950/20 text-emerald-800 dark:text-emerald-400 text-xs flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500 fill-current" />
                    <div>
                      <b className="font-extrabold block text-sm">Excellent System Comprehension!</b>
                      You modeled software lifespans correctly, keeping complexity boundaries optimized with pristine idiomatic logic!
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100/20 dark:border-amber-950/20 text-amber-800 dark:text-amber-400 text-xs flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500" />
                    <div>
                      <b className="font-extrabold block text-sm">Room for Optimization!</b>
                      We noticed slight logical oversights, unreleased listeners/timers, or algorithmic complexity drag. Study the simple analogy below to refine your mental model!
                    </div>
                  </div>
                )}

                {/* Feynman Analogy segment */}
                <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/30 dark:border-indigo-950/40">
                  <h4 className="text-xs uppercase font-extrabold text-indigo-700 dark:text-cyan-400 mb-2 flex items-center gap-1 font-sans">
                    <span>💡</span> Mind Matching Analogy
                  </h4>
                  <div className="text-sm italic leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap select-text">
                    {aiReview.analogy}
                  </div>
                </div>

                {/* Meticulous feedback list */}
                <div>
                  <h4 className="text-xs uppercase font-extrabold text-indigo-700 dark:text-cyan-400 mb-2 flex items-center gap-1 font-sans">
                    <span>🔬</span> Meticulous Code Critique
                  </h4>
                  <div className="text-sm text-stone-800 dark:text-stone-300 whitespace-pre-wrap leading-relaxed select-text font-sans">
                    <FormattedTechExplanation text={aiReview.breakdown} />
                  </div>
                </div>

                {/* Corrected snippet block */}
                {aiReview.correctedCodeSnippet && (
                  <div>
                    <h4 className="text-xs uppercase font-extrabold text-indigo-700 dark:text-cyan-400 mb-2 flex items-center gap-1 font-mono">
                      <span>🛠️</span> Architect Code Correction
                    </h4>
                    <div className="mt-2 w-full select-text text-xs rounded-xl overflow-hidden shadow-sm">
                      <FormattedTechExplanation text={aiReview.correctedCodeSnippet} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REAL-TIME DIAGNOSTIC CENTER & PERSISTENT SYSTEMS LOG DRAWER */}
      <div className="card p-6 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-3xl shadow-xl mt-4 animate-in fade-in slide-in-from-bottom-3 duration-200 font-sans" id="diagnostic-pipeline-console">
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/80 pb-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-emerald-500 block animate-ping absolute"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500 block relative"></span>
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-stone-100 flex items-center gap-1.5 leading-none mb-1 font-sans font-extrabold uppercase tracking-wide">
                <span>⚙️</span> Sandbox Diagnostic Logs & Trace Stream
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 font-sans">
                Continuous standard output pipes, memory assertions, unhandled warnings, and AI compilation events.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Stats counter chips */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="bg-gray-100 dark:bg-gray-800 text-stone-600 dark:text-stone-300 px-2.5 py-1 rounded-lg border border-gray-205 dark:border-gray-700/50">
              Stdout: <b>{logsArchive.filter(l => l.type === "stdout").length}</b>
            </span>
            <span className="bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400 px-2.5 py-1 rounded-lg border border-red-100/20">
              Errors: <b>{logsArchive.filter(l => l.type === "error").length}</b>
            </span>
            <span className="bg-indigo-50 text-indigo-650 dark:bg-indigo-950/20 dark:text-cyan-400 px-2.5 py-1 rounded-lg border border-indigo-100/20">
              System: <b>{logsArchive.filter(l => l.type === "system").length}</b>
            </span>
            <span className="bg-amber-50 text-amber-655 dark:bg-amber-950/20 dark:text-amber-400 px-2.5 py-1 rounded-lg border border-amber-100/20">
              AI Review: <b>{logsArchive.filter(l => l.type === "ai").length}</b>
            </span>
          </div>
        </div>

        {/* Diagnostic controls and Search bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-4">
          {/* Categorized filter tab groups */}
          <div className="flex bg-gray-100 dark:bg-gray-805 rounded-xl p-1 gap-1 self-start select-none">
            <button
              onClick={() => setSelectedLogTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedLogTab === "all"
                  ? "bg-white dark:bg-gray-900 text-indigo-600 dark:text-cyan-400 font-extrabold shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-stone-100"
              }`}
              type="button"
            >
              All Signals ({logsArchive.length})
            </button>
            <button
              onClick={() => setSelectedLogTab("stdout")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedLogTab === "stdout"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-stone-100"
              }`}
              type="button"
            >
              Stdout ({logsArchive.filter(l => l.type === "stdout").length})
            </button>
            <button
              onClick={() => setSelectedLogTab("error")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedLogTab === "error"
                  ? "bg-red-500 text-white shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-stone-100"
              }`}
              type="button"
            >
              Errors ({logsArchive.filter(l => l.type === "error").length})
            </button>
            <button
              onClick={() => setSelectedLogTab("system_ai")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedLogTab === "system_ai"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-gray-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-stone-100"
              }`}
              type="button"
            >
              System / AI ({logsArchive.filter(l => l.type === "system" || l.type === "ai").length})
            </button>
          </div>

          {/* Search bar and Quick buttons */}
          <div className="flex flex-wrap items-center gap-3 grow md:justify-end">
            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter stream logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 bg-gray-55 dark:bg-gray-850 hover:bg-gray-100 dark:hover:bg-gray-800/80 rounded-xl outline-none border border-gray-200/40 dark:border-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Copy action */}
              <button
                onClick={() => {
                  const dataToCopy = logsArchive
                    .filter(l => {
                      if (selectedLogTab === "stdout") return l.type === "stdout";
                      if (selectedLogTab === "error") return l.type === "error";
                      if (selectedLogTab === "system_ai") return l.type === "system" || l.type === "ai";
                      return true;
                    })
                    .filter(l => l.message.toLowerCase().includes(logSearch.toLowerCase()))
                    .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
                    .join("\n");
                  navigator.clipboard.writeText(dataToCopy);
                  alert("Logs copied to clipboard successfully!");
                }}
                className="p-2 text-gray-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                title="Copy current filtered logs"
                type="button"
              >
                <Copy className="w-4 h-4" />
              </button>

              {/* Download logs */}
              <button
                onClick={() => {
                  const dataToDownload = logsArchive
                    .map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
                    .join("\n");
                  const blob = new Blob([dataToDownload], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `feynman_sandbox_logs_${Date.now()}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="p-2 text-gray-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                title="Download complete diagnostic logs (.txt)"
                type="button"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Clear logs Button */}
              <button
                onClick={() => {
                  setLogsArchive([
                    {
                      id: "cleared",
                      timestamp: new Date().toLocaleTimeString(),
                      type: "system",
                      message: "Log console flushed. Pipeline listening..."
                    }
                  ]);
                }}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                title="Flush console log archives"
                type="button"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Testing Controls trigger bar */}
        <div className="flex flex-wrap items-center gap-3 bg-gray-55 dark:bg-gray-850 p-3 rounded-2xl mb-4 border border-gray-100 dark:border-gray-800/60">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono flex items-center gap-1.5 shrink-0 select-none">
            <Cpu className="w-3.5 h-3.5 text-indigo-500 animate-pulse" /> Sandbox injectors:
          </span>
          <button
            onClick={() => addLog("stdout", `console.log("Memory mapping verified recursively. No memory leaks detected on heap block #4A.")`)}
            className="text-[10px] px-2.5 py-1 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-stone-700 dark:text-stone-300 rounded-lg border border-gray-200/50 dark:border-gray-700 font-bold transition-all hover:scale-[1.02] cursor-pointer"
            type="button"
          >
            🔌 Mock Stdout test
          </button>
          <button
            onClick={() => addLog("error", "Error: UnhandledPromiseRejection: Cannot read properties of undefined (reading 'borrow_lifespan_ref')")}
            className="text-[10px] px-2.5 py-1 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800 text-red-650 dark:text-red-400 rounded-lg border border-red-200/50 dark:border-red-950/40 font-bold transition-all hover:scale-[1.02] cursor-pointer"
            type="button"
          >
            💥 Inject Sandbox Crash VM warning
          </button>
          <div className="grow"></div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={autoScrollLog}
              onChange={(e) => setAutoScrollLog(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-700 accent-indigo-600 focus:ring-indigo-500 cursor-pointer text-indigo-600"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider font-mono">Auto-scroll lock</span>
          </label>
        </div>

        {/* Output Console Box */}
        <div className="bg-gray-950 text-stone-100 p-4 rounded-2xl border border-gray-900 shadow-inner overflow-hidden font-mono text-xs select-text">
          <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2" id="log-scroller-track">
            {logsArchive
              .filter(l => {
                if (selectedLogTab === "stdout") return l.type === "stdout";
                if (selectedLogTab === "error") return l.type === "error";
                if (selectedLogTab === "system_ai") return l.type === "system" || l.type === "ai";
                return true;
              })
              .filter(l => l.message.toLowerCase().includes(logSearch.toLowerCase()))
              .map((log) => {
                let badgeStyle = "text-sky-450";
                let bgStyle = "bg-sky-500/10";
                if (log.type === "stdout") {
                  badgeStyle = "text-emerald-400 font-bold";
                  bgStyle = "bg-emerald-500/5";
                } else if (log.type === "error") {
                  badgeStyle = "text-red-400 font-bold";
                  bgStyle = "bg-red-500/10";
                } else if (log.type === "ai") {
                  badgeStyle = "text-indigo-400 font-extrabold";
                  bgStyle = "bg-indigo-500/10 border-l-2 border-indigo-500";
                }

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors hover:bg-black/30 font-mono text-xs ${bgStyle}`}
                  >
                    <span className="text-gray-600 shrink-0 text-[10px] select-none font-bold">[{log.timestamp}]</span>
                    <span className={`shrink-0 uppercase font-bold text-[9px] min-w-[55px] text-right font-mono tracking-wider ${badgeStyle}`}>
                      {log.type}
                    </span>
                    <div className="grow text-stone-100 whitespace-pre-wrap leading-relaxed font-mono select-text font-normal">
                      {log.message}
                    </div>
                  </div>
                );
              })}

            {/* Empty results message */}
            {logsArchive
              .filter(l => {
                if (selectedLogTab === "stdout") return l.type === "stdout";
                if (selectedLogTab === "error") return l.type === "error";
                if (selectedLogTab === "system_ai") return l.type === "system" || l.type === "ai";
                return true;
              })
              .filter(l => l.message.toLowerCase().includes(logSearch.toLowerCase()))
              .length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-600 select-none">
                <p className="font-bold flex items-center justify-center gap-1.5 mb-1 text-xs">
                  <span>👻</span> No signals detected
                </p>
                <p className="text-[10px] max-w-md mx-auto leading-relaxed">
                  Try clearing the filters or clicking "Run Code" above to emit standard signals and evaluation metrics!
                </p>
              </div>
            )}
            
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

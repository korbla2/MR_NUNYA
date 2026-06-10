import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// @ts-ignore
const pdfParseModule = require("pdf-parse");
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
import MyDatabase from "better-sqlite3";

const app = express();
const PORT = 3000;

// Setup lazy loading of Gemini API client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please enable it in the Secrets manager.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

let currentPreferredModel = "gemini-3.5-flash";

// Robust retry wrapper for Gemini generateContent to handle 503 UNAVAILABLE/high demand and 429 rate limits
async function generateContentWithRetry(
  parameters: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  maxRetries = 5,
  initialDelayMs = 1500
): Promise<ReturnType<GoogleGenAI["models"]["generateContent"]>> {
  let attempt = 0;
  let currentModel = parameters.model;

  // Dynamically switch our baseline requested model to our verified robust fallback to avoid retrying busy endpoints
  if (currentModel === "gemini-3.5-flash" && currentPreferredModel !== "gemini-3.5-flash") {
    console.log(`[GeminiRoute] Re-routing baseline model request to currently stable fallback: "${currentPreferredModel}"`);
    currentModel = currentPreferredModel;
  }
  
  while (true) {
    try {
      const ai = getGeminiClient();
      // Safe copy to update the model reference if we fallback
      const activeParameters = { ...parameters, model: currentModel };
      return await ai.models.generateContent(activeParameters);
    } catch (err: any) {
      attempt++;
      const errorMessage = String(err?.message || err?.status || err || "");
      const isRetryable =
        errorMessage.includes("503") ||
        errorMessage.includes("UNAVAILABLE") ||
        errorMessage.includes("429") ||
        errorMessage.includes("exhausted") ||
        errorMessage.includes("high demand") ||
        errorMessage.includes("temporary") ||
        err?.status === 503 ||
        err?.status === 429;

      if (isRetryable && attempt < maxRetries) {
        // Fall back to alternative robust models if gemini-3.5-flash is temporarily unavailable/busy
        if (currentModel === "gemini-3.5-flash") {
          console.warn(`[GeminiRetry] Switching from gemini-3.5-flash to gemini-flash-latest as robust fallback due to error: ${errorMessage}`);
          currentModel = "gemini-flash-latest";
          currentPreferredModel = "gemini-flash-latest";
        } else if (currentModel === "gemini-flash-latest") {
          console.warn(`[GeminiRetry] Switching from gemini-flash-latest to gemini-3.1-flash-lite as safe third choice due to: ${errorMessage}`);
          currentModel = "gemini-3.1-flash-lite";
          currentPreferredModel = "gemini-3.1-flash-lite";
        }
        
        const delay = initialDelayMs * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4);
        console.warn(`[GeminiRetry] Transient error encountered (attempt ${attempt}/${maxRetries}): ${errorMessage}. Retrying in ${Math.round(delay)}ms with model "${currentModel}"...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
}

// Multer configurations
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max limit
});

// Configure Database safely
let db: any = null;
const dataDir = path.join(process.cwd(), "data");
const jsonDbPath = path.join(dataDir, "courses_fallback.json");

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  db = new MyDatabase(path.join(dataDir, "feynman-tutor.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT,
      json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_courses_updated_at ON courses(updated_at);
  `);
  console.log("SQLite successfully initialized at data/feynman-tutor.sqlite");
} catch (err: any) {
  console.warn("SQLite database failed to initialize. Falling back to JSON storage.", err.message);
  db = null;
}

// Fallback JSON-based store logic
function fallbackReadCourses(): any[] {
  try {
    if (fs.existsSync(jsonDbPath)) {
      const data = fs.readFileSync(jsonDbPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading JSON fallback database:", err);
  }
  return [];
}

function fallbackWriteCourse(course: any) {
  try {
    const courses = fallbackReadCourses();
    const index = courses.findIndex(c => c.id === course.id);
    if (index >= 0) {
      courses[index] = course;
    } else {
      courses.push(course);
    }
    fs.writeFileSync(jsonDbPath, JSON.stringify(courses, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing to JSON fallback database:", err);
  }
}

function fallbackDeleteCourse(id: string) {
  try {
    const courses = fallbackReadCourses();
    const filtered = courses.filter(c => c.id !== id);
    fs.writeFileSync(jsonDbPath, JSON.stringify(filtered, null, 2), "utf-8");
  } catch (err) {
    console.error("Error deleting from JSON fallback database:", err);
  }
}

// Express middlewares
app.use(express.json({ limit: "25mb" }));

// Helper text cleanups
function cleanText(value: string = "") {
  return String(value)
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function removeRepeatedLines(text: string) {
  const seen = new Map<string, number>();
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => {
      if (line.length < 2) return false;
      const count = seen.get(line) || 0;
      seen.set(line, count + 1);
      return count < 2;
    })
    .join("\n");
}

// ================= API ENDPOINTS =================

// Support API Healthchecks
app.get("/api/health", (req, res) => {
  res.json({ ok: true, app: "Feynman AI Tutor", version: "0.2.0", sqlite: !!db });
});

// GET list of courses
app.get("/api/courses", (req, res) => {
  if (db) {
    try {
      const rows = db.prepare("SELECT id, title, summary, created_at AS createdAt, updated_at AS updatedAt FROM courses ORDER BY updated_at DESC").all();
      return res.json({ courses: rows });
    } catch (err: any) {
      console.error("SQLite query error, shifting to file-based fallback", err);
    }
  }
  const fallbackList = fallbackReadCourses().map(c => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  res.json({ courses: fallbackList });
});

// GET detailed course object
app.get("/api/courses/:id", (req, res) => {
  const courseId = req.params.id;
  if (db) {
    try {
      const row = db.prepare("SELECT json FROM courses WHERE id = ?").get(courseId);
      if (row) {
        return res.json({ course: JSON.parse(row.json) });
      }
    } catch (err) {
      console.error("SQLite fetch error", err);
    }
  }
  const fallbackList = fallbackReadCourses();
  const c = fallbackList.find(x => x.id === courseId);
  if (c) {
    return res.json({ course: c });
  }
  res.status(404).json({ error: "Course not found." });
});

// PUT / Update course detailed object
app.put("/api/courses/:id", (req, res) => {
  const course = req.body?.course;
  if (!course || !course.id) {
    return res.status(400).json({ error: "Course object with id required." });
  }
  if (course.id !== req.params.id) {
    return res.status(400).json({ error: "Course id mismatch." });
  }
  const now = new Date().toISOString();
  course.updatedAt = now;
  if (!course.createdAt) {
    course.createdAt = now;
  }

  // Dual-write persistence
  if (db) {
    try {
      db.prepare(`
        INSERT INTO courses (id, title, summary, created_at, updated_at, json)
        VALUES (@id, @title, @summary, @createdAt, @updatedAt, @json)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          summary = excluded.summary,
          updated_at = excluded.updated_at,
          json = excluded.json
      `).run({
        id: course.id,
        title: course.title || "Untitled Course",
        summary: course.summary || "",
        createdAt: course.createdAt,
        updatedAt: now,
        json: JSON.stringify(course)
      });
    } catch (err) {
      console.error("SQLite write error, continuing to file-based fallback", err);
    }
  }
  fallbackWriteCourse(course);
  res.json({ ok: true, id: course.id, updatedAt: now });
});

// DELETE course
app.delete("/api/courses/:id", (req, res) => {
  const courseId = req.params.id;
  let changes = 0;
  if (db) {
    try {
      const result = db.prepare("DELETE FROM courses WHERE id = ?").run(courseId);
      changes = result.changes;
    } catch (err) {
      console.error("SQLite delete error", err);
    }
  }
  fallbackDeleteCourse(courseId);
  res.json({ ok: true, deleted: changes || 1 });
});

// POST / Extract text from files (PDF/TXT/MD)
app.post("/api/extract-file", upload.single("file"), async (req, res) => {
  try {
    console.log("[ExtractFile] Received extract file request");
    if (!req.file) {
      console.warn("[ExtractFile] No file found in req.file");
      return res.status(400).json({ error: "No file uploaded." });
    }

    const originalName = req.file.originalname || "uploaded-file";
    const mime = req.file.mimetype || "";
    const size = req.file.buffer ? req.file.buffer.length : 0;
    const lowerName = originalName.toLowerCase();

    console.log(`[ExtractFile] File Info: Name="${originalName}", Mime="${mime}", Size=${size} bytes`);

    if (mime.includes("pdf") || lowerName.endsWith(".pdf")) {
      console.log("[ExtractFile] Processing as PDF...");
      
      // Prevent memory exhaustion/Out Of Memory (OOM) crashes on large multi-book PDFs
      if (size > 15 * 1024 * 1024) {
        console.warn(`[ExtractFile] File size ${size} bytes exceeds safe limits (15MB).`);
        return res.status(400).json({
          error: `The PDF file is too large (${(size / 1024 / 1024).toFixed(1)} MB) to parse securely on our server. To prevent crash-restarts and timeouts, please upload a smaller PDF (under 15MB) or copy-paste your chapters directly into the manual text area.`
        });
      }

      let text = "";
      let pages = 1;
      let usedGeminiOCR = false;

      try {
        console.log("[ExtractFile] Calling pdf-parse function with limits...");
        const pdfParser = typeof pdfParseModule === "function" ? pdfParseModule : (pdfParseModule?.default || pdfParseModule);
        if (typeof pdfParser !== "function") {
          throw new Error("Resolved pdf-parse is not a function.");
        }
        // Limit parsing to max 100 pages to prevent memory crashes on the Node server
        const result = await pdfParser(req.file.buffer, { max: 100 });
        text = result.text || "";
        pages = result.numpages || 1;
        console.log(`[ExtractFile] PDF parsing succeeded. Pages: ${pages}, Raw text length: ${text.length}`);
      } catch (pdfErr: any) {
        console.error("[ExtractFile] Error inside pdf-parse call:", pdfErr);
      }

      // Automatically fall back to Gemini OCR structure if extracted text is empty or very short
      const trimmedText = text.trim();
      if (trimmedText.length < 150) {
        console.log(`[ExtractFile] Extracted characters too short (${trimmedText.length} chars). Falling back to multimodal Gemini OCR...`);
        try {
          const base64Data = req.file.buffer.toString("base64");
          
          console.log("[ExtractFile] Querying gemini-3.5-flash with PDF attachment (with retry logic)...");
          const response = await generateContentWithRetry({
            model: "gemini-3.5-flash",
            contents: [
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64Data
                }
              },
              {
                text: "Extract and write down all study, lecture, textbook, or educational content from this PDF. Provide a complete, detailed transcription/reconstitution. Do not summarize or provide external commentary; simply extract all readable content in clear markdown format."
              }
            ]
          });

          if (response.text) {
            text = response.text;
            usedGeminiOCR = true;
            console.log(`[ExtractFile] Gemini parser succeeded. New text length: ${text.length} chars.`);
          }
        } catch (geminiErr: any) {
          console.warn("[ExtractFile] Gemini multimodal fallback failed or key matches undefined:", geminiErr.message);
        }
      }

      // If both extraction methods yielded absolutely nothing, let's return a clean 400 error message
      if (!text.trim()) {
        return res.status(400).json({
          error: "Could not extract any readable text from this PDF file. It might be password-protected, corrupt, or contain only scanned visual images without selectable text. Please copy and paste its contents manually."
        });
      }

      return res.json({
        title: originalName.replace(/\.pdf$/i, ""),
        type: "pdf",
        pages,
        text: cleanText(text),
        usedGeminiOCR
      });
    }

    if (mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(lowerName)) {
      console.log("[ExtractFile] Processing as Text plain/md/csv file...");
      const parsedText = req.file.buffer.toString("utf8");
      console.log(`[ExtractFile] Text file parsing succeeded. Text length: ${parsedText.length}`);
      return res.json({
        title: originalName.replace(/\.[^.]+$/, ""),
        type: "text",
        text: cleanText(parsedText)
      });
    }

    console.warn(`[ExtractFile] Unsupported file type uploaded: ${mime} / ${originalName}`);
    return res.status(415).json({ error: `Unsupported file type "${mime}". Please upload a PDF, TXT, or MD.` });
  } catch (err: any) {
    console.error("extract-file handler error:", err);
    res.status(500).json({ error: "Could not extract text from file.", detail: err.message });
  }
});

// POST / Extract webpage contents by URL
app.post("/api/extract-url", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: "Valid http(s) URL required." });
    }

    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 FeynmanAITutor/0.2 (+local learning app)",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7"
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `URL fetch failed: ${response.status}` });
    }

    const contentType = response.headers.get("content-type") || "";
    const htmlText = await response.text();

    if (contentType.includes("text/plain")) {
      return res.json({ title: url, type: "url", text: cleanText(htmlText) });
    }

    const $ = cheerio.load(htmlText);
    const pageTitle = cleanText($("title").first().text() || $("h1").first().text() || url).slice(0, 180);
    
    // Remote boilerplate/scripts
    $("script, style, nav, footer, header, aside, noscript, svg, form, iframe").remove();

    let textSelection = [
      $("article").text(),
      $("main").text(),
      $("body").text()
    ].map(cleanText).sort((a, b) => b.length - a.length)[0] || "";

    textSelection = removeRepeatedLines(textSelection).slice(0, 180000);

    // Fallback to Gemini HTML-transcriber if parsed text looks empty or very short
    if (textSelection.trim().length < 200 && htmlText.trim().length > 0) {
      console.log("[ExtractURL] Extracted text too short, falling back to Gemini HTML content extractor (with retry logic)...");
      try {
        const truncatedHtml = htmlText.slice(0, 200000); // safety cap
        const response = await generateContentWithRetry({
          model: "gemini-3.5-flash",
          contents: [
            {
              text: `Here is the raw HTML content of a webpage. Please extract the main educational or study content from this HTML of the webpage. Ignore navbars, headers, footers, advertisements, sidebars, scripts, or CSS. Reconstruct the article, tutorial, or syllabus material in clean markdown format:\n\n${truncatedHtml}`
            }
          ]
        });
        if (response.text) {
          textSelection = response.text;
          console.log(`[ExtractURL] Gemini HTML extraction succeeded. Length: ${textSelection.length} chars.`);
        }
      } catch (geminiErr: any) {
        console.warn("[ExtractURL] Gemini HTML extraction helper failed:", geminiErr.message);
      }
    }

    res.json({ title: pageTitle, type: "url", text: textSelection });
  } catch (err: any) {
    console.error("extract-url handler error:", err);
    res.status(500).json({ error: "Could not extract website text.", detail: err.message });
  }
});

// Native server-side Gemini API proxy (uses workspace injected GEMINI_API_KEY)
app.post("/api/ai/gemini", async (req, res) => {
  try {
    const { prompt, json = false } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const config: any = {
      systemInstruction: "You are an elite Software Architect and patient AI Programming Mentor teaching computer science, software engineering, complex system designs, and algorithms using the famous Feynman Technique. Always teach and explain coding concepts as if the students have absolutely zero background: start from fundamental mechanics (such as memory allocation, execution stacks, syntax structure, or API footprints), defining all technical terms before using them. Break down complex jargon simply, present consecutive/step-by-step logic, and provide concise programming analogies (e.g. comparing Rust borrow checker to renting a library card, or a lookup map to a postal zip-code directory). Focus on generating concrete, highly clear, commented code snippets (in JS/TS, Python, C++, Go, Rust, SQL, etc.) enclosed inside markdown triple-backticks. Evaluate student explanations accurately, highlighting coding bugs, complexity gaps (Big-O analysis), or structural misunderstandings with supportive guidance.",
    };

    if (json) {
      config.responseMimeType = "application/json";
    }

    const response = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config,
    });

    res.json({ text: response.text || "" });
  } catch (err: any) {
    console.error("Gemini API error:", err);
    res.status(500).json({ error: "Gemini API request failed.", detail: err.message });
  }
});

// Proxied local Ollama adapter
app.post("/api/ai/ollama", async (req, res) => {
  try {
    const { ollamaUrl = "http://localhost:11434", model = "qwen2.5:7b", prompt, json = false } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }
    const response = await fetch(`${String(ollamaUrl).replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, format: json ? "json" : undefined })
    });
    const parsedData = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(parsedData);
    }
    res.json({ text: parsedData.response || "" });
  } catch (err: any) {
    res.status(500).json({ error: "Ollama request failed.", detail: err.message });
  }
});

// Proxied custom OpenAI-compatible endpoints
app.post("/api/ai/openai-compatible", async (req, res) => {
  try {
    const { apiBase, apiKey, model, prompt, json = false } = req.body || {};
    if (!apiBase || !apiKey || !model || !prompt) {
      return res.status(400).json({ error: "apiBase, apiKey, model, and prompt are all required values." });
    }
    const response = await fetch(`${String(apiBase).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${apiKey}` 
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.25,
        response_format: json ? { type: "json_object" } : undefined
      })
    });
    const parsedData = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(parsedData);
    }
    res.json({ text: parsedData.choices?.[0]?.message?.content || "" });
  } catch (err: any) {
    res.status(500).json({ error: "OpenAI-compatible request failed.", detail: err.message });
  }
});

// Proxied OpenRouter endpoints
app.post("/api/ai/openrouter", async (req, res) => {
  try {
    const { apiKey, model, prompt, json = false } = req.body || {};
    const resolvedApiKey = apiKey || process.env.OPENROUTER_API_KEY;
    if (!resolvedApiKey) {
      return res.status(400).json({ error: "OpenRouter API Key is required. Please set the OPENROUTER_API_KEY environment variable in the Secrets manager, or provide an API Key in the settings." });
    }
    if (!prompt) {
      return res.status(400).json({ error: "prompt is a required value." });
    }
    const resolvedModel = model || "google/gemini-2.5-flash";
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "Authorization": `Bearer ${resolvedApiKey}`,
        "HTTP-Referer": "https://ai.studio/build",
        "X-Title": "Feynman AI Tutor"
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.25,
        response_format: json ? { type: "json_object" } : undefined
      })
    });
    const parsedData = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json(parsedData);
    }
    res.json({ text: parsedData.choices?.[0]?.message?.content || "" });
  } catch (err: any) {
    res.status(500).json({ error: "OpenRouter request failed.", detail: err.message });
  }
});

// Vite Middleware & static fallback handler
async function startAppServer() {
  if (process.env.NODE_ENV !== "production") {
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteInstance.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Feynman AI Tutor server is running on http://localhost:${PORT}`);
  });
}

startAppServer();

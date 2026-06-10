import React, { useState, useEffect } from "react";
import { Flame, Menu, X, Smartphone, Monitor, Wifi, Battery, Clock, Home, BookOpen, Brain, Code, Layers, Sparkles, LogIn, LogOut, Cloud, CloudOff, CloudLightning } from "lucide-react";
import { Course, SourceDraft, AISettings, Lesson } from "./types";
import { getLesson, ensureFlashcards, calculateDailyStreak } from "./utils";

// Firebase imports
import { auth, db as firestoreDb, googleProvider, OperationType, handleFirestoreError } from "./lib/firebase";
import { onAuthStateChanged, User, signInWithPopup, signOut } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, query, where, onSnapshot } from "firebase/firestore";

// Component imports
import Dashboard from "./components/Dashboard";
import CreateCourse from "./components/CreateCourse";
import Outline from "./components/Outline";
import Mindmap from "./components/Mindmap";
import LessonTutor from "./components/LessonTutor";
import Exams from "./components/Exams";
import Flashcards from "./components/Flashcards";
import Analytics from "./components/Analytics";
import Settings from "./components/Settings";
import CodingWorkspace from "./components/CodingWorkspace";

const STORE_KEY = "feynman_ai_tutor_v1";

const defaultSettings: AISettings = {
  provider: "gemini",
  ollamaUrl: "http://localhost:11434",
  model: "qwen2.5:7b",
  apiBase: "",
  apiKey: "",
  paidModel: "",
};

const defaultDraft: SourceDraft = {
  title: "",
  level: "Beginner",
  goal: "Personal knowledge",
  text: "",
  url: "",
};

export default function App() {
  const [route, setRoute] = useState<string>("dashboard");
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [activeExamChapterId, setActiveExamChapterId] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [draft, setDraft] = useState<SourceDraft>(defaultDraft);
  const [courses, setCourses] = useState<Course[]>([]);
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [ui, setUi] = useState<{ busy: boolean; notice: string }>({
    busy: false,
    notice: "",
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [androidFrameActive, setAndroidFrameActive] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);

  // Sync and listen to Firestore-based user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      if (currUser) {
        console.log("[Firebase Auth] User logged in:", currUser.uid);
        
        // Non-blocking connection validation check as requested by system skill
        try {
          const { doc, getDocFromServer } = await import("firebase/firestore");
          await getDocFromServer(doc(firestoreDb, "test", "connection")).catch(() => {});
        } catch (e) {}

        // Set up secure real-time listener for user's courses
        const q = query(collection(firestoreDb, "courses"), where("ownerId", "==", currUser.uid));
        const unsubFn = onSnapshot(q, (snapshot) => {
          const fbCourses: Course[] = [];
          snapshot.forEach(docSnap => {
            fbCourses.push(docSnap.data() as Course);
          });
          if (fbCourses.length > 0) {
            const sorted = fbCourses.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
            setCourses(sorted);
            localStorage.setItem(STORE_KEY, JSON.stringify({
              theme,
              courses: sorted,
              settings,
              sourceDraft: draft,
              activeCourseId: activeCourseId || sorted[0]?.id || null,
              activeLessonId: activeLessonId || (sorted[0] ? firstClassroomLessonOf(sorted[0]) : null),
              route,
            }));
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, "courses");
        });

        return () => unsubFn();
      }
    });
    return () => unsubscribe();
  }, [theme, settings, draft, route, activeCourseId, activeLessonId]);

  const handleSignInGoogle = async () => {
    setBusyState(true, "Launching secure Google Sign-in...");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const errMsg = String(err?.message || err?.code || "");
      if (errMsg.includes("unauthorized-domain") || errMsg.includes("auth/unauthorized-domain") || err?.code === "auth/unauthorized-domain") {
        const currentDomain = window.location.hostname;
        alert(`firebase-auth: Authorized Domain Required!

The dynamic preview/dev domain "${currentDomain}" is not yet listed under your Firebase project's Authorized Domains.

To authorize this domain and enable Cloud Sync:
1. Go to your Firebase Console (console.firebase.google.com).
2. Navigate to "Authentication" -> "Settings" tab -> "Authorized domains".
3. Click "Add domain" and add exactly:
   ${currentDomain}
4. Save and try signing in again!`);
      } else {
        alert(`Google sign-in aborted or failed: ${err.message}`);
      }
    } finally {
      setBusyState(false);
    }
  };

  const handleSignOut = async () => {
    setBusyState(true, "Signing out user...");
    try {
      await signOut(auth);
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.courses) setCourses(parsed.courses);
      } else {
        setCourses([]);
      }
      setActiveCourseId(null);
      setActiveLessonId(null);
      setRoute("dashboard");
    } catch (err: any) {
      alert(`Signout failed: ${err.message}`);
    } finally {
      setBusyState(false);
    }
  };

  const handleSyncLocalCoursesToCloud = async () => {
    if (!auth.currentUser) {
      alert("Please sign in with Google first to migrate courses to the cloud!");
      return;
    }
    if (courses.length === 0) {
      alert("No active local courses found to sync.");
      return;
    }
    setBusyState(true, "Uploading local course syllabuses to Cloud Firestore...");
    try {
      let count = 0;
      for (const course of courses) {
        const withUid = { ...course, ownerId: auth.currentUser.uid };
        await setDoc(doc(firestoreDb, "courses", course.id), withUid);
        count++;
      }
      alert(`Successfully synchronized ${count} course(s) with your cloud database!`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, "courses");
    } finally {
      setBusyState(false);
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, "0");
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12;
      h = h ? h : 12;
      setCurrentTime(`${h}:${m} ${ap}`);
    };
    updateTime();
    const intervalId = setInterval(updateTime, 15000);
    return () => clearInterval(intervalId);
  }, []);

  // Load configuration from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.theme) {
          setTheme(parsed.theme);
          document.documentElement.setAttribute("data-theme", parsed.theme);
        }
        if (parsed.courses) setCourses(parsed.courses);
        if (parsed.settings) setSettings({ ...defaultSettings, ...parsed.settings });
        if (parsed.sourceDraft) setDraft(parsed.sourceDraft);
        if (parsed.activeCourseId) setActiveCourseId(parsed.activeCourseId);
        if (parsed.activeLessonId) setActiveLessonId(parsed.activeLessonId);
        if (parsed.route) setRoute(parsed.route);
      }
    } catch (err) {
      console.error("Local storage restoration failed:", err);
    }
  }, []);

  // Sync state changes with local storage and propagate REST writes to SQLite/JSON backup
  const saveState = (
    newCourses: Course[],
    newSettings?: AISettings,
    newDraft?: SourceDraft,
    newRoute?: string,
    newCourseId?: string | null,
    newLessonId?: string | null
  ) => {
    setCourses(newCourses);
    if (newSettings) setSettings(newSettings);
    if (newDraft) setDraft(newDraft);

    const payload = {
      theme,
      courses: newCourses,
      settings: newSettings || settings,
      sourceDraft: newDraft || draft,
      activeCourseId: newCourseId !== undefined ? newCourseId : activeCourseId,
      activeLessonId: newLessonId !== undefined ? newLessonId : activeLessonId,
      route: newRoute || route,
    };

    localStorage.setItem(STORE_KEY, JSON.stringify(payload));

    // Async REST write syncs the course modifications directly on backend
    const activeId = newCourseId !== undefined ? newCourseId : activeCourseId;
    const courseObj = newCourses.find(c => c.id === activeId);
    if (courseObj) {
      if (auth.currentUser) {
        const courseWithUid = { ...courseObj, ownerId: auth.currentUser.uid };
        setDoc(doc(firestoreDb, "courses", courseObj.id), courseWithUid)
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `courses/${courseObj.id}`));
      } else if (location.protocol !== "file:") {
        fetch(`/api/courses/${encodeURIComponent(courseObj.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course: courseObj }),
        }).catch(err => console.warn("Backend database syncing offline fallback active. State saved locally.", err));
      }
    }
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);

    const backup = {
      theme: nextTheme,
      courses,
      settings,
      sourceDraft: draft,
      activeCourseId,
      activeLessonId,
      route,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(backup));
  };

  const setBusyState = (busy: boolean, notice: string = "") => {
    setUi({ busy, notice });
  };

  const activeCourse = courses.find(c => c.id === activeCourseId) || null;

  // Active Routing views render
  const renderRouteView = () => {
    switch (route) {
      case "create":
        return (
          <CreateCourse
            draft={draft}
            setDraft={setDraft}
            settings={settings}
            onCourseCreated={c => {
              const updated = [c, ...courses];
              setActiveCourseId(c.id);
              const firstLessonId = firstClassroomLessonOf(c);
              setActiveLessonId(firstLessonId);
              setRoute("outline");
              saveState(updated, settings, draft, "outline", c.id, firstLessonId);
            }}
            setBusy={setBusyState}
          />
        );

      case "outline":
        if (!activeCourse) return renderEmptyCourse();
        return (
          <Outline
            course={activeCourse}
            onOpenLesson={lid => {
              setActiveLessonId(lid);
              setRoute("lesson");
              saveState(courses, settings, draft, "lesson", activeCourseId, lid);
            }}
            onOpenExam={chId => {
              setActiveExamChapterId(chId);
              setRoute("exams");
              saveState(courses, settings, draft, "exams");
            }}
            onDeleteCourse={handleDeleteCourse}
          />
        );

      case "mindmap":
        if (!activeCourse) return renderEmptyCourse();
        return (
          <Mindmap
            course={activeCourse}
            onOpenLesson={lid => {
              setActiveLessonId(lid);
              setRoute("lesson");
              saveState(courses, settings, draft, "lesson", activeCourseId, lid);
            }}
            onOpenExam={chId => {
              setActiveExamChapterId(chId);
              setRoute("exams");
              saveState(courses, settings, draft, "exams");
            }}
            onOpenFinal={() => {
              setActiveExamChapterId("final");
              setRoute("exams");
              saveState(courses, settings, draft, "exams");
            }}
          />
        );

      case "lesson":
        if (!activeCourse) return renderEmptyCourse();
        return (
          <LessonTutor
            course={activeCourse}
            lessonId={activeLessonId}
            settings={settings}
            onUpdateCourse={updatedCourse => {
              const updatedList = courses.map(c => (c.id === updatedCourse.id ? updatedCourse : c));
              saveState(updatedList);
            }}
            setBusy={setBusyState}
            onBackToOutline={() => {
              setRoute("outline");
              saveState(courses, settings, draft, "outline");
            }}
          />
        );

      case "exams":
        if (!activeCourse) return renderEmptyCourse();
        return (
          <Exams
            course={activeCourse}
            activeExamChapterId={activeExamChapterId}
            settings={settings}
            onUpdateCourse={updatedCourse => {
              const updatedList = courses.map(c => (c.id === updatedCourse.id ? updatedCourse : c));
              saveState(updatedList);
            }}
            onSetChapterId={setChapterId => {
              setActiveExamChapterId(setChapterId);
              saveState(courses, settings, draft, "exams");
            }}
            setBusy={setBusyState}
          />
        );

      case "flashcards":
        if (!activeCourse) return renderEmptyCourse();
        return (
          <Flashcards
            course={activeCourse}
            onUpdateCourse={updatedCourse => {
              const updatedList = courses.map(c => (c.id === updatedCourse.id ? updatedCourse : c));
              saveState(updatedList);
            }}
          />
        );

      case "analytics":
        if (!activeCourse) return renderEmptyCourse();
        return (
          <Analytics
            course={activeCourse}
            onOpenLesson={lid => {
              setActiveLessonId(lid);
              setRoute("lesson");
              saveState(courses, settings, draft, "lesson", activeCourseId, lid);
            }}
            onBackToOutline={() => {
              setRoute("outline");
              saveState(courses, settings, draft, "outline");
            }}
          />
        );

      case "progress":
        if (!activeCourse) return renderEmptyCourse();
        return (
          <Outline
            course={activeCourse}
            onOpenLesson={lid => {
              setActiveLessonId(lid);
              setRoute("lesson");
              saveState(courses, settings, draft, "lesson", activeCourseId, lid);
            }}
            onOpenExam={chId => {
              setActiveExamChapterId(chId);
              setRoute("exams");
              saveState(courses, settings, draft, "exams");
            }}
            onDeleteCourse={handleDeleteCourse}
          />
        );

      case "settings":
        return (
          <Settings
            settings={settings}
            onSaveSettings={s => {
              setSettings(s);
              saveState(courses, s);
            }}
            setBusy={setBusyState}
          />
        );

      case "code":
        return (
          <CodingWorkspace
            course={activeCourse}
            activeLesson={activeLessonObject}
            settings={settings}
            setBusy={setBusyState}
          />
        );

      default:
        return (
          <Dashboard
            courses={courses}
            onOpenCourse={id => {
              setActiveCourseId(id);
              const courseObj = courses.find(c => c.id === id);
              const firstLessonId = courseObj ? firstClassroomLessonOf(courseObj) : null;
              setActiveLessonId(firstLessonId);
              setRoute("outline");
              saveState(courses, settings, draft, "outline", id, firstLessonId);
            }}
            onOpenMindmap={id => {
              setActiveCourseId(id);
              setRoute("mindmap");
              saveState(courses, settings, draft, "mindmap", id);
            }}
            onDeleteCourse={handleDeleteCourse}
            onCreateNewCourse={() => {
              setRoute("create");
              saveState(courses, settings, draft, "create");
            }}
            onImportBackup={handleImportBackup}
            onExportBackup={handleExportBackup}
            onLoadSQLite={handleLoadSQLite}
            onBackupSQLite={handleBackupSQLite}
          />
        );
    }
  };

  const renderEmptyCourse = () => (
    <div className="empty flex flex-col items-center justify-center py-16">
      <h3>Generic Error</h3>
      <p className="text-gray-500 mb-4">No course is active right now. Please create or load a syllabus.</p>
      <button className="btn" type="button" onClick={() => setRoute("dashboard")}>
        Dashboard home
      </button>
    </div>
  );

  const firstClassroomLessonOf = (c: Course) => {
    const list = c.chapters.flatMap(ch => ch.lessons);
    return list.find(l => !l.locked && !l.completed)?.id || list[0]?.id || null;
  };

  // Delete Course Operations
  const handleDeleteCourse = async (courseId: string) => {
    const c = courses.find(x => x.id === courseId);
    if (!c) return;
    if (!confirm(`Are you sure you want to permanently delete course "${c.title}"?`)) return;

    const filtered = courses.filter(item => item.id !== courseId);
    let nextActiveId = activeCourseId;
    let nextRoute = route;

    if (activeCourseId === courseId) {
      nextActiveId = filtered[0]?.id || null;
      nextRoute = "dashboard";
      setRoute("dashboard");
    }
    const nextLessonId = filtered[0] ? firstClassroomLessonOf(filtered[0]) : null;

    setActiveCourseId(nextActiveId);
    if (activeCourseId === courseId) {
      setActiveLessonId(nextLessonId);
      setActiveExamChapterId(null);
    }

    setCourses(filtered);
    saveState(filtered, settings, draft, nextRoute, nextActiveId, nextLessonId);

    if (auth.currentUser) {
      deleteDoc(doc(firestoreDb, "courses", courseId))
        .catch(err => handleFirestoreError(err, OperationType.DELETE, `courses/${courseId}`));
    } else if (location.protocol !== "file:") {
      fetch(`/api/courses/${encodeURIComponent(courseId)}`, { method: "DELETE" }).catch(() => {});
    }
  };

  // SQLite Database Operations
  const handleLoadSQLite = async () => {
    setBusyState(true, "Restoring syllabus schemas from SQLite backup...");
    try {
      const listRes = await fetch("/api/courses");
      if (!listRes.ok) throw new Error("Backend server/SQLite is not initialized.");
      const listObj = await listRes.json();
      const loaded: Course[] = [];

      for (const row of listObj.courses || []) {
        const res = await fetch(`/api/courses/${encodeURIComponent(row.id)}`);
        if (res.ok) {
          loaded.push((await res.json()).course);
        }
      }

      // Merge backend copies directly
      const mergedMap = new Map<string, Course>(courses.map(c => [c.id, c]));
      loaded.forEach(c => {
        ensureFlashcards(c);
        mergedMap.set(c.id, c);
      });

      const listResult = [...mergedMap.values()].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );

      setCourses(listResult);
      const nextActiveId = activeCourseId || listResult[0]?.id || null;
      saveState(listResult, settings, draft, route, nextActiveId, listResult[0] ? firstClassroomLessonOf(listResult[0]) : null);
      alert(`Successfully restored ${loaded.length} course(s) from SQLite server database.`);
    } catch (err: any) {
      alert(`Database load failed: ${err.message}. Offline browser localStorage matches active changes.`);
    } finally {
      setBusyState(false);
    }
  };

  const handleBackupSQLite = async () => {
    if (!courses.length) {
      alert("You have no active courses to back up right now.");
      return;
    }
    setBusyState(true, "Writing local courses to backend SQLite database...");
    try {
      await Promise.all(
        courses.map(c =>
          fetch(`/api/courses/${encodeURIComponent(c.id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course: c }),
          })
        )
      );
      alert("SQLite backup saved successfully.");
    } catch (err: any) {
      alert(`SQLite backup failed: ${err.message}`);
    } finally {
      setBusyState(false);
    }
  };

  // Import / Export backups
  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const importedCourses = Array.isArray(data) ? data : data.courses;

      if (!Array.isArray(importedCourses)) {
        throw new Error("Backup JSON must contain a 'courses' list array.");
      }

      const validList = importedCourses.filter(c => c && c.id && c.title && Array.isArray(c.chapters));
      if (!validList.length) {
        throw new Error("No valid Feynman course configurations mapped.");
      }

      const mergedMap = new Map<string, Course>(courses.map(c => [c.id, c]));
      validList.forEach(c => {
        ensureFlashcards(c);
        mergedMap.set(c.id, c);
      });

      const listResult = [...mergedMap.values()];
      setCourses(listResult);
      saveState(
        listResult,
        settings,
        draft,
        route,
        activeCourseId || validList[0].id,
        activeLessonId || firstClassroomLessonOf(validList[0])
      );
      alert(`Successfully imported ${validList.length} course(s) from backup.`);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  const handleExportBackup = () => {
    const payload = {
      app: "Feynman AI Tutor",
      version: "0.2.0",
      exportedAt: new Date().toISOString(),
      courses,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const fileUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = `feynman-ai-tutor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(fileUrl);
  };

  const activeLessonObject = activeCourse ? getLesson(activeCourse, activeLessonId).lesson : null;
  const streakCount = activeCourse ? calculateDailyStreak(activeCourse) : calculateDailyStreak(courses);

  return (
    <div className={`app-shell ${androidFrameActive ? "android-mode-active" : ""}`} id="app-shell-root">
      {/* Mobile-only Header Bar */}
      <header className="mobile-top-bar select-none">
        <button className="p-2 -ml-2 text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl border-0 bg-transparent" onClick={() => setMobileDrawerOpen(true)}>
          <Menu className="w-5 h-5" />
        </button>
        <span className="mobile-bar-title truncate">
          {route === "dashboard" && "Dashboard"}
          {route === "create" && "New Syllabus"}
          {route === "outline" && "Syllabus Index"}
          {route === "mindmap" && "Interactive Map"}
          {route === "lesson" && "Tutor Space"}
          {route === "code" && "Practice Arena"}
          {route === "exams" && "Exams & Grades"}
          {route === "flashcards" && "Spaced Repetition"}
          {route === "analytics" && "Analytics Desk"}
          {route === "settings" && "AI Architect Config"}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 font-extrabold text-[10px] text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/15 py-1 px-2.5 rounded-full select-none">
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>{streakCount}d</span>
          </div>
        </div>
      </header>

      {/* Floating Dynamic Drawer Overlay for Mobile & Tablet viewports */}
      {mobileDrawerOpen && (
        <div className="drawer-overlay" onClick={() => setMobileDrawerOpen(false)}>
          <div className="drawer-content animate-slide-right" onClick={e => e.stopPropagation()}>
            <div className="drawer-header border-b border-[var(--line)] pb-3 mb-4">
              <div className="brand mb-0!">
                <div className="logo scale-90">F</div>
                <div>
                  <h1 className="text-sm font-black text-gray-900 dark:text-stone-100 mb-0.5" style={{ margin: 0 }}>Feynman AI</h1>
                  <p className="text-[10px] text-gray-500" style={{ margin: 0 }}>Android responsive shell</p>
                </div>
              </div>
              <button 
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-gray-400 border-0 bg-transparent"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Streak Badge in mobile drawer */}
            <div className="p-3 bg-orange-500/5 dark:bg-orange-500/10 rounded-xl border border-orange-500/20 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4 fill-current" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] uppercase tracking-wider font-extrabold text-orange-600 dark:text-orange-400 block mb-0.5">
                  Daily Streak
                </span>
                <span className="text-xs font-bold text-[var(--text)] block truncate">
                  {streakCount > 0 ? `${streakCount} Days active!` : "0 Days study line"}
                </span>
              </div>
            </div>

            {/* Firebase Cloud Sync Control Container (Mobile Drawer) */}
            <div className="flex flex-col gap-2 p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl mb-4 shadow-sm" id="firebase-auth-mobile-widget">
              {user ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7.5 h-7.5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-xs font-black flex items-center justify-center shrink-0 border border-white/25">
                      {user.displayName ? user.displayName[0] : (user.email ? user.email[0].toUpperCase() : "U")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-extrabold text-[var(--text)] block truncate leading-none">
                        {user.displayName || "Explorer"}
                      </span>
                      <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5 pt-0.5 select-none">
                        <Cloud className="w-2.5 h-2.5 fill-emerald-500/10" /> Cloud database active
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 select-none">
                    <button
                      onClick={() => {
                        handleSyncLocalCoursesToCloud();
                        setMobileDrawerOpen(false);
                      }}
                      className="flex-1 py-1.5 px-1.5 bg-purple-600 hover:bg-purple-700 text-white border-0 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1"
                      title="Upload offline syllabus data to Firestore"
                      type="button"
                    >
                      <CloudLightning className="w-2.5 h-2.5 text-yellow-300 fill-current" /> Sync
                    </button>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setMobileDrawerOpen(false);
                      }}
                      className="py-1.5 px-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-[var(--text)] border border-[var(--line)] rounded-lg text-[9px] font-black cursor-pointer"
                      title="Log out of cloud profile"
                      type="button"
                    >
                      Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 leading-normal">
                    Sync your syllabus layouts in the Cloud securely with Google.
                  </span>
                  <button
                    onClick={() => {
                      handleSignInGoogle();
                      setMobileDrawerOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer shadow"
                    type="button"
                  >
                    <LogIn className="w-3 h-3" /> Sign in with Google
                  </button>
                </div>
              )}
            </div>

            <nav className="drawer-nav flex flex-col gap-1 overflow-y-auto max-h-[70%] pr-1">
              {[
                { r: "dashboard", label: "Dashboard", desc: "Your course list" },
                { r: "create", label: "New Course", desc: "Build custom syllabus" },
                { r: "outline", label: "Syllabus Overview", desc: "Chapter study tree" },
                { r: "mindmap", label: "Interactive Map", desc: "Visual learn path" },
                { r: "lesson", label: "Tutor Space", desc: "Explain live to AI" },
                { r: "code", label: "Practice Sandbox", desc: "Run & verify script" },
                { r: "exams", label: "Exams & Grades", desc: "Pass code reviews" },
                { r: "flashcards", label: "Spaced Cards", desc: "SRS memory trigger" },
                { r: "analytics", label: "Study Analytics", desc: "Activity calendar" },
                { r: "settings", label: "AI Configuration", desc: "Model parameters" }
              ].map(item => (
                <button
                  key={item.r}
                  className={`text-left w-full px-3 py-2 rounded-xl transition-all border border-transparent text-xs flex flex-col cursor-pointer bg-transparent ${route === item.r ? 'bg-indigo-50/20 text-indigo-700 dark:bg-indigo-950/25 border-indigo-100/30' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'}`}
                  onClick={() => {
                    setRoute(item.r);
                    setMobileDrawerOpen(false);
                  }}
                  type="button"
                >
                  <span className="font-bold text-[12px]">{item.label}</span>
                  <span className="text-[10px] opacity-75">{item.desc}</span>
                </button>
              ))}
            </nav>

            <div className="pt-4 border-t border-[var(--line)] mt-auto flex flex-col gap-3">
              <button
                className="theme-toggle w-full flex items-center gap-3 p-3 bg-[var(--panel)] border border-[var(--line)] rounded-xl"
                type="button"
                onClick={() => {
                  handleToggleTheme();
                  setMobileDrawerOpen(false);
                }}
              >
                <span>{theme === "dark" ? "☀️" : "🌙"}</span>
                <b className="text-xs font-bold">{theme === "dark" ? "Light Mode" : "Dark Mode"}</b>
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Desktop Persistent Sidebar */}
      <aside className="sidebar">
        <div className="brand" id="brand-header">
          <div className="logo">F</div>
          <div>
            <h1>Feynman AI</h1>
            <p>Mastery through teaching</p>
          </div>
        </div>

        {/* Firebase Cloud Sync Control Container */}
        <div className="flex flex-col gap-2 p-3.5 bg-[var(--panel)] border border-[var(--line)] rounded-2xl mb-4 shadow-sm" id="firebase-auth-sidebar-widget">
          {user ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-md border border-white/20">
                  {user.displayName ? user.displayName[0] : (user.email ? user.email[0].toUpperCase() : "U")}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-black text-[var(--text)] block truncate leading-tight">
                    {user.displayName || "Explorer"}
                  </span>
                  <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold flex items-center gap-1 select-none">
                    <Cloud className="w-3 h-3 fill-emerald-500/10" /> Cloud database active
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <button
                  onClick={handleSyncLocalCoursesToCloud}
                  className="flex-1 py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white border-0 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors flex items-center justify-center gap-1"
                  title="Upload offline syllabus data to Firestore"
                  type="button"
                >
                  <CloudLightning className="w-3 h-3 text-yellow-300 fill-current" /> Sync Local
                </button>
                <button
                  onClick={handleSignOut}
                  className="py-1.5 px-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-[var(--text)] border border-[var(--line)] rounded-lg text-[9px] font-bold cursor-pointer transition-colors"
                  title="Log out of cloud profile"
                  type="button"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-1">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal">
                Sign in with Google to securely sync your syllabus layouts in the Cloud.
              </span>
              <button
                onClick={handleSignInGoogle}
                className="w-full flex items-center justify-center gap-2 py-2 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white border-0 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.01] cursor-pointer shadow"
                type="button"
              >
                <LogIn className="w-3.5 h-3.5" /> Google Sign-in
              </button>
            </div>
          )}
        </div>

        <button
          className="theme-toggle"
          id="theme-toggler-btn"
          type="button"
          onClick={handleToggleTheme}
        >
          <span>{theme === "dark" ? "☀️" : "🌙"}</span>
          <b>{theme === "dark" ? "Light theme" : "Dark theme"}</b>
        </button>

        {/* Dynamic Android Focus Simulator Toggle Selector */}
        <button
          className="flex items-center gap-3 w-full text-left px-3.5 py-3 rounded-2xl border bg-[var(--panel)] shadow-sm backdrop-blur-xl mb-3 transition-all hover:scale-[1.01] cursor-pointer"
          style={{ borderColor: androidFrameActive ? "var(--purple)" : "var(--line)" }}
          id="sidebar-android-toggle"
          type="button"
          onClick={() => setAndroidFrameActive(!androidFrameActive)}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${androidFrameActive ? 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] uppercase tracking-wider font-extrabold text-purple-600 dark:text-purple-400 block mb-0.5">
              Android Mode
            </span>
            <span className="text-xs font-bold text-[var(--text)] block leading-tight truncate">
              {androidFrameActive ? "Focus Screen ON" : "Focused Device Frame"}
            </span>
          </div>
        </button>

        {/* Daily Study Streak Badge */}
        <button
          className="flex items-center gap-3 w-full text-left px-3.5 py-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] shadow-sm backdrop-blur-xl mb-4 transition-all hover:scale-[1.01] hover:bg-orange-500/5 cursor-pointer"
          id="sidebar-daily-streak"
          type="button"
          onClick={() => {
            if (activeCourse) {
              setRoute("analytics");
              saveState(courses, settings, draft, "analytics");
            } else {
              setRoute("dashboard");
              saveState(courses, settings, draft, "dashboard");
            }
          }}
        >
          <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 shadow-inner">
            <Flame className="w-5 h-5 fill-current" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-orange-600 dark:text-orange-400 block mb-0.5">
              Daily Streak
            </span>
            <span className="text-sm font-bold text-[var(--text)] block leading-tight">
              {streakCount > 0 ? (
                `${streakCount} Day${streakCount === 1 ? "" : "s"} Study Streak`
              ) : (
                "0 Days Study Streak"
              )}
            </span>
          </div>
        </button>

        <nav className="nav" id="sidebar-navigation">
          <button
            className={route === "dashboard" ? "active" : ""}
            type="button"
            onClick={() => setRoute("dashboard")}
          >
            <span>⌂ Dashboard</span>
          </button>
          <button
            className={route === "create" ? "active" : ""}
            type="button"
            onClick={() => setRoute("create")}
          >
            <span>+ New Course</span>
          </button>
          <button
            className={route === "outline" ? "active" : ""}
            type="button"
            onClick={() => setRoute("outline")}
          >
            <span>▦ Syllabus Overview</span>
          </button>
          <button
            className={route === "mindmap" ? "active" : ""}
            type="button"
            onClick={() => setRoute("mindmap")}
          >
            <span>◎ Interactive Map</span>
          </button>
          <button
            className={route === "lesson" ? "active" : ""}
            type="button"
            onClick={() => setRoute("lesson")}
          >
            <span>✦ Tutor Space</span>
            {activeLessonObject && <span className="badge blue text-[10px]">study</span>}
          </button>
          <button
            className={route === "code" ? "active" : ""}
            type="button"
            onClick={() => setRoute("code")}
          >
            <span>💻 Practice Sandbox</span>
            <span className="badge green text-[10px]">run code</span>
          </button>
          <button
            className={route === "exams" ? "active" : ""}
            type="button"
            onClick={() => setRoute("exams")}
          >
            <span>🟣 Exams & Grades</span>
          </button>
          <button
            className={route === "flashcards" ? "active" : ""}
            type="button"
            onClick={() => setRoute("flashcards")}
          >
            <span>▣ Spaced Cards</span>
          </button>
          <button
            className={route === "analytics" ? "active" : ""}
            type="button"
            onClick={() => setRoute("analytics")}
          >
            <span>📊 Study Analytics</span>
          </button>
          <button
            className={route === "settings" ? "active" : ""}
            type="button"
            onClick={() => setRoute("settings")}
          >
            <span>⚙ AI Configuration</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          Gemini 3.5 AI Tutor active. Mastery validated by mock explaining.
        </div>
      </aside>

      {/* Main Study views */}
      <main className={`main ${androidFrameActive ? "android-frame-active" : ""}`} id="study-panel-container">
        {androidFrameActive ? (
          /* High-Fidelity Android Phone Container Wrapper */
          <div className="android-wrapper-container select-none">
            <div className="android-virtual-device">
              {/* Phone volume/power triggers */}
              <div className="vol-up-btn"></div>
              <div className="vol-down-btn"></div>
              <div className="power-btn"></div>
              
              <div className="android-screen border border-stone-800/15">
                {/* 1. Android top status bar */}
                <div className="android-status-bar flex items-center justify-between text-[11px] font-bold select-none p-2.5 px-4 bg-gray-50 dark:bg-gray-950 border-b border-[var(--line)]">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 scale-90 text-stone-605 text-gray-500 dark:text-gray-400" />
                    <span className="text-[11px] font-mono tracking-tight text-gray-750 dark:text-stone-300 font-bold leading-none mt-0.5">{currentTime}</span>
                  </div>
                  {/* Speaker Punch Hole notch */}
                  <div className="android-camera-punch"></div>
                  <div className="flex items-center gap-2 text-gray-650 dark:text-stone-400 select-none">
                    <span className="text-[9px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400 px-1 py-0.5 rounded-sm select-none border border-emerald-500/10 tracking-wider">5G</span>
                    <Wifi className="w-3.5 h-3.5" />
                    <Battery className="w-3.5 h-3.5 rotate-90 scale-85 mt-[1px]" />
                  </div>
                </div>

                {/* 2. Top Android header bar */}
                <div className="android-action-bar-header flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-[var(--line)] select-none">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-tr from-[#4f46e5] to-[#06b6d4] text-white text-xs font-black flex items-center justify-center">F</div>
                    <span className="text-xs font-black text-gray-900 dark:text-stone-100 uppercase tracking-widest font-mono select-none">Feynman OS</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleToggleTheme}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg border-0 bg-transparent text-gray-500 cursor-pointer"
                      title="Change theme"
                      type="button"
                    >
                      <span>{theme === "dark" ? "☀️" : "🌙"}</span>
                    </button>
                    <button 
                      onClick={() => setAndroidFrameActive(false)}
                      className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white border-0 rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer"
                      title="Exit Focused Device Layout"
                      type="button"
                    >
                      Exit Focus
                    </button>
                  </div>
                </div>

                {/* 3. Fluid scroll simulation arena */}
                <div className="android-viewport-content select-text p-4">
                  {ui.busy && (
                    <div className="card mb-4 border-indigo-200 bg-indigo-50/50 text-indigo-850 p-3 rounded-xl flex items-center gap-2.5 animate-pulse text-[11px]" id="tutor-busy-notice-device">
                      <span className="text-sm">⚡</span>
                      <div>
                        <b className="font-extrabold block">Mentor is thinking...</b>
                        <p className="text-[10px] opacity-85 leading-relaxed">{ui.notice || "Please wait..."}</p>
                      </div>
                    </div>
                  )}
                  {renderRouteView()}
                </div>

                {/* 4. Native soft touch navigation keys */}
                <div className="android-soft-navigation-bar flex items-center justify-around select-none py-1.5 px-6 border-t border-[var(--line)] bg-gray-50 dark:bg-gray-950">
                  <button 
                    onClick={() => {
                      setRoute("dashboard");
                      saveState(courses, settings, draft, "dashboard");
                    }}
                    className="p-1 text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 bg-transparent border-0 cursor-pointer" 
                    title="System Back Button"
                    type="button"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => {
                      setRoute("dashboard");
                      saveState(courses, settings, draft, "dashboard");
                    }}
                    className="p-1 bg-transparent border-0 cursor-pointer"
                    title="System Home Button"
                    type="button"
                  >
                    <div className="w-4 h-4 rounded-full border-[2.5px] border-gray-400 dark:border-gray-500"></div>
                  </button>
                  <button 
                    onClick={() => {
                      setMobileDrawerOpen(true);
                    }}
                    className="p-1 bg-transparent border-0 cursor-pointer"
                    title="System Active Apps Menu"
                    type="button"
                  >
                    <div className="w-3.5 h-3.5 border-[2.5px] border-gray-400 dark:border-gray-500 rounded-sm"></div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Interactive Standard Canvas */
          <>
            {ui.busy && (
              <div className="card mb-4 border-indigo-200 bg-indigo-50/50 text-indigo-800 p-4 rounded-xl flex items-center gap-3 animate-pulse" id="tutor-busy-notice">
                <span className="text-xl">⚡</span>
                <div>
                  <b className="font-extrabold text-sm block">Mentor is thinking...</b>
                  <p className="text-xs text-indigo-700">{ui.notice || "Please wait..."}</p>
                </div>
              </div>
            )}

            {renderRouteView()}
          </>
        )}
      </main>

      {/* Sticky Bottom Navigation Bar for SmartPhones/Tactile Android Screens */}
      <nav className="mobile-bottom-nav select-none">
        <button className={route === "dashboard" ? "active" : ""} onClick={() => { setRoute("dashboard"); saveState(courses, settings, draft, "dashboard") }}>
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>
        <button className={route === "outline" ? "active" : ""} onClick={() => { setRoute("outline"); saveState(courses, settings, draft, "outline") }}>
          <BookOpen className="w-5 h-5" />
          <span>Syllabus</span>
        </button>
        <button className={route === "lesson" ? "active" : ""} onClick={() => { setRoute("lesson"); saveState(courses, settings, draft, "lesson") }}>
          <Brain className="w-5 h-5" />
          <span>Tutor</span>
        </button>
        <button className={route === "code" ? "active" : ""} onClick={() => { setRoute("code"); saveState(courses, settings, draft, "code") }}>
          <Code className="w-5 h-5" />
          <span>Sandbox</span>
        </button>
        <button className={route === "flashcards" ? "active" : ""} onClick={() => { setRoute("flashcards"); saveState(courses, settings, draft, "flashcards") }}>
          <Layers className="w-5 h-5" />
          <span>Cards</span>
        </button>
      </nav>
    </div>
  );
}

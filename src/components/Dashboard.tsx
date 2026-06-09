import React, { useRef } from "react";
import { Course } from "../types";
import { courseProgress, weakTopics } from "../utils";

interface DashboardProps {
  courses: Course[];
  onOpenCourse: (courseId: string) => void;
  onOpenMindmap: (courseId: string) => void;
  onDeleteCourse: (courseId: string) => void;
  onCreateNewCourse: () => void;
  onImportBackup: (file: File) => void;
  onExportBackup: () => void;
  onLoadSQLite: () => void;
  onBackupSQLite: () => void;
}

export default function Dashboard({
  courses,
  onOpenCourse,
  onOpenMindmap,
  onDeleteCourse,
  onCreateNewCourse,
  onImportBackup,
  onExportBackup,
  onLoadSQLite,
  onBackupSQLite,
}: DashboardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
    }
  };

  const renderCourseCard = (c: Course) => {
    const progress = courseProgress(c);
    const lessons = c.chapters.flatMap(ch => ch.lessons);
    const uncompleted = lessons.find(l => !l.locked && !l.completed) || lessons[0];
    const weakList = weakTopics(c);

    return (
      <div className="card course-card select-text" key={c.id} id={`course-${c.id}`}>
        <div className="row justify-between items-center w-full">
          <span className="badge blue font-bold">{c.level || "Beginner"}</span>
          <span className="small text-gray-400">Created: {new Date(c.createdAt).toLocaleDateString()}</span>
        </div>

        <h3 className="text-xl font-bold truncate max-w-sm mt-1">{c.title}</h3>
        <p className="text-xs text-gray-500 mb-4 line-clamp-2 h-8">{c.summary}</p>

        <div className="progress">
          <div style={{ width: `${progress}%` }}></div>
        </div>

        <div className="small flex justify-between font-semibold mt-1">
          <span>Progress: {progress}%</span>
          <span className="truncate max-w-[150px]">Current: {uncompleted?.mainConcept || "All Mastered!"}</span>
        </div>

        <div className="row mt-2 min-h-6">
          {weakList.length > 0 ? (
            weakList.slice(0, 3).map((w, idx) => (
              <span className="badge red text-[10px] py-0.5 px-2" key={idx}>
                {w}
              </span>
            ))
          ) : (
            <span className="badge green text-[10px] py-0.5 px-2">Ready & Mastered</span>
          )}
        </div>

        <div className="row gap-2 mt-4">
          <button className="btn text-xs py-1.5 px-4 min-h-fit" type="button" onClick={() => onOpenCourse(c.id)}>
            Continue
          </button>
          <button
            className="btn ghost text-xs py-1.5 px-4 min-h-fit"
            type="button"
            onClick={() => onOpenMindmap(c.id)}
          >
            Mind Map
          </button>
          <button
            className="btn ghost text-xs py-1.5 px-3 min-h-fit border-red-200 text-red-500 hover:bg-red-50"
            type="button"
            onClick={() => onDeleteCourse(c.id)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="dashboard-view">
      <div className="topbar">
        <div>
          <h2>Dashboard</h2>
          <p>
            Your structured learning home. Generate syllabus paths, ask clarifying questions, and track active spaced repetition reviews.
          </p>
        </div>
        <div className="row gap-2 flex-wrap text-sm">
          <button className="btn ghost h-10 py-1.5 text-xs" type="button" onClick={() => fileInputRef.current?.click()}>
            Import Backup
          </button>
          <button className="btn ghost h-10 py-1.5 text-xs" type="button" onClick={onExportBackup}>
            Export Backup
          </button>
          <button className="btn ghost h-10 py-1.5 text-xs" type="button" onClick={onLoadSQLite}>
            Load SQLite DB
          </button>
          <button className="btn ghost h-10 py-1.5 text-xs" type="button" onClick={onBackupSQLite}>
            Backup SQLite DB
          </button>
          <button className="btn h-10 py-1.5 text-xs" type="button" onClick={onCreateNewCourse}>
            Create New Course
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/json,.json"
            style={{ display: "none" }}
          />
        </div>
      </div>

      {courses.length > 0 ? (
        <div className="grid two gap-6">{courses.map(renderCourseCard)}</div>
      ) : (
        <div className="empty flex flex-col items-center justify-center py-16 px-4">
          <h3>No Courses Active</h3>
          <p className="max-w-md mx-auto text-gray-500 mb-6 leading-relaxed text-sm">
            Feynman technique maps visual progression paths from book text, notes, and PDFs. Begin by building your first syllabus outline!
          </p>
          <button className="btn px-6 py-2" type="button" onClick={onCreateNewCourse}>
            Create your first syllabus
          </button>
        </div>
      )}
    </div>
  );
}

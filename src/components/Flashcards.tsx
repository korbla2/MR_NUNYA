import React, { useState } from "react";
import { Course, Flashcard } from "../types";
import { ensureFlashcards, dueFlashcards, nextInterval } from "../utils";

interface FlashcardsProps {
  course: Course;
  onUpdateCourse: (course: Course) => void;
}

export default function Flashcards({ course, onUpdateCourse }: FlashcardsProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const cards = ensureFlashcards(course);
  const due = dueFlashcards(course);
  const weakCount = cards.filter(card => card.status === "weak").length;
  const learnedCount = cards.filter(card => card.status === "learned").length;

  const activeCard =
    cards.find(c => c.id === activeCardId) ||
    due[0] ||
    cards[0];

  const handleReview = (cardId: string, quality: "again" | "hard" | "easy") => {
    const nextDays = quality === "easy" ? nextInterval(activeCard.interval, true) : quality === "hard" ? 1 : 0;

    const updatedCards = cards.map(c => {
      if (c.id === cardId) {
        return {
          ...c,
          interval: nextDays,
          reviews: (c.reviews || 0) + 1,
          lastReviewedAt: new Date().toISOString(),
          status: quality === "again" ? "weak" : quality === "hard" ? "review" : "learned",
          dueAt: new Date(Date.now() + nextDays * 864 * 100000).toISOString(), // Days into offset Timestamp
        } as Flashcard;
      }
      return c;
    });

    onUpdateCourse({ ...course, flashcards: updatedCards });
    setShowAnswer(false);
    setActiveCardId(null);
  };

  return (
    <div id="flashcards-view">
      <div className="topbar">
        <div>
          <h2>Spaced Repetition Cards</h2>
          <p>
            Reinforce core definitions and mistakes. Memory cards are automatically scheduled based on recall speed.
          </p>
        </div>
      </div>

      <div className="grid three mb-6" id="flash-stats">
        <div className="stat">
          <span className="small text-gray-500 font-bold block">Review Queue Due</span>
          <b className="text-indigo-600 dark:text-cyan-400 text-3xl">{due.length}</b>
        </div>
        <div className="stat">
          <span className="small text-gray-500 font-bold block">Mastered Terms</span>
          <b className="text-green-600 text-3xl">{learnedCount} / {cards.length}</b>
        </div>
        <div className="stat">
          <span className="small text-gray-500 font-bold block">Weak Flashcards</span>
          <b className="text-red-600 text-3xl">{weakCount}</b>
        </div>
      </div>

      <div className="grid two">
        <section className="card flex flex-col justify-between" id="active-card-workspace">
          <div>
            <h3 className="mb-2">Active Flashcard Deck</h3>
            {activeCard ? (
              <div className="flex flex-col gap-4">
                <span className="text-xs text-indigo-500 font-bold block uppercase tracking-wider">
                  Question prompt
                </span>
                <div className="flashcard select-text">
                  <div className="flash-front font-bold text-gray-800 dark:text-gray-100">
                    {activeCard.front}
                  </div>
                  {showAnswer ? (
                    <div className="flash-back mt-4 bg-white/90 p-4 border border-indigo-100 rounded-xl max-h-48 overflow-y-auto">
                      {activeCard.back}
                    </div>
                  ) : (
                    <div className="flash-back hidden-answer italic mt-4 text-center select-none text-gray-400">
                      Solve from memory first, then click Show Answer.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No remaining flashcards inside this course module.</p>
            )}
          </div>

          {activeCard && (
            <div className="row gap-3 justify-center mt-6">
              {showAnswer ? (
                <>
                  <button
                    className="btn danger px-5"
                    type="button"
                    onClick={() => handleReview(activeCard.id, "again")}
                  >
                    Repeat Again
                  </button>
                  <button
                    className="btn warn px-5"
                    type="button"
                    onClick={() => handleReview(activeCard.id, "hard")}
                  >
                    Recalled Hard
                  </button>
                  <button
                    className="btn success px-5"
                    type="button"
                    onClick={() => handleReview(activeCard.id, "easy")}
                  >
                    Got It Easy
                  </button>
                </>
              ) : (
                <button
                  className="btn w-full"
                  type="button"
                  id="show-answer-btn"
                  onClick={() => setShowAnswer(true)}
                >
                  Show Answer
                </button>
              )}
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-3" id="queue-scroller">
          <h3>Syllabus Memorization Queue</h3>
          <div className="lesson-list max-h-[460px] overflow-y-auto pr-1">
            {cards.length > 0 ? (
              cards
                .slice()
                .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
                .map(cd => {
                  const isDue = new Date(cd.dueAt).getTime() <= Date.now();
                  return (
                    <div
                      className={`lesson-item ${isDue ? "" : "locked opacity-75"}`}
                      key={cd.id}
                      id={`deck-item-${cd.id}`}
                    >
                      <div>
                        <h4 className="truncate max-w-[280px]">
                          {cd.status === "weak"
                            ? "🔴"
                            : cd.status === "learned"
                            ? "✅"
                            : cd.status === "review"
                            ? "🟡"
                            : "🔵"}{" "}
                          {cd.front}
                        </h4>
                        <p className="text-[11px] text-gray-500">
                          Reviews: {cd.reviews || 0} • Due: {new Date(cd.dueAt).toLocaleDateString()}{" "}
                          ({isDue ? "Due now" : "Upcoming"})
                        </p>
                      </div>

                      <button
                        className="btn ghost text-xs py-1 px-3 min-h-fit"
                        type="button"
                        onClick={() => {
                          setActiveCardId(cd.id);
                          setShowAnswer(false);
                        }}
                      >
                        Launch
                      </button>
                    </div>
                  );
                })
            ) : (
              <p className="text-sm text-gray-400 italic">Curriculum terms queue is currently empty.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

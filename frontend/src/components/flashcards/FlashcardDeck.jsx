import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Shuffle } from 'lucide-react';
import Flashcard from './Flashcard';
import { RATINGS, dueLabel } from '../../utils/progress';

/** The four rating buttons shown once a card is flipped. Keys 1-4 also work. */
export const RatingBar = ({ onRate, disabled }) => (
  <div className="grid grid-cols-4 gap-2">
    {RATINGS.map((r) => (
      <button
        key={r.value}
        type="button"
        disabled={disabled}
        onClick={() => onRate(r.value)}
        className={`rounded-lg border bg-white px-2 py-2 text-center text-sm font-medium transition-colors disabled:opacity-50 dark:bg-zinc-900 ${r.className}`}
      >
        <span className="block">{r.label}</span>
        <span className="block text-[11px] font-normal opacity-70">{r.hint}</span>
      </button>
    ))}
  </div>
);

/**
 * Browse a deck and rate each card after flipping it.
 * `onRate(card, rating)` saves the rating (it schedules the card's next review);
 * `schedule` maps card id -> { due_at, last_rating } for cards rated before.
 */
const FlashcardDeck = ({ flashcards, onRate, schedule = {} }) => {
  const [order, setOrder] = useState(() => flashcards.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [rated, setRated] = useState({}); // index -> rating, this session
  const [onlyLearning, setOnlyLearning] = useState(false);

  useEffect(() => {
    setOrder(flashcards.map((_, i) => i));
    setPosition(0);
    setRated({});
    setShowAnswer(false);
  }, [flashcards]);

  const isKnown = useCallback((i) => rated[i] === 'good' || rated[i] === 'easy', [rated]);
  const deck = useMemo(() => (onlyLearning ? order.filter((i) => !isKnown(i)) : order), [order, isKnown, onlyLearning]);
  const index = deck[Math.min(position, deck.length - 1)];
  const card = flashcards[index];

  const go = useCallback(
    (delta) => {
      if (!deck.length) return;
      setShowAnswer(false);
      setPosition((p) => (p + delta + deck.length) % deck.length);
    },
    [deck.length]
  );

  const rate = useCallback(
    (rating) => {
      if (!card) return;
      onRate?.(card, rating);
      setRated((prev) => ({ ...prev, [index]: rating }));
      const known = rating === 'good' || rating === 'easy';
      // In "cards to learn" mode a known card leaves the list, so the next one slides into place.
      if (onlyLearning && known) setShowAnswer(false);
      else go(1);
    },
    [card, index, onRate, onlyLearning, go]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        setShowAnswer((s) => !s);
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (showAnswer) {
        const match = RATINGS.find((r) => r.key === e.key);
        if (match) rate(match.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, rate, showAnswer]);

  const shuffle = () => {
    setOrder((prev) => [...prev].sort(() => Math.random() - 0.5));
    setPosition(0);
    setShowAnswer(false);
  };

  const reset = () => {
    setRated({});
    setOnlyLearning(false);
    setPosition(0);
    setShowAnswer(false);
  };

  const ratedCount = Object.keys(rated).length;
  const knownCount = flashcards.filter((_, i) => isKnown(i)).length;
  const progress = flashcards.length ? (knownCount / flashcards.length) * 100 : 0;
  const saved = card ? schedule[card.id] : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="font-medium tabular-nums">
          {deck.length ? Math.min(position, deck.length - 1) + 1 : 0}
          <span className="muted font-normal"> / {deck.length}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setOnlyLearning((v) => !v);
              setPosition(0);
              setShowAnswer(false);
            }}
            className={`btn btn-sm ${onlyLearning ? 'btn-secondary' : 'btn-ghost'}`}
          >
            {onlyLearning ? 'Showing cards to learn' : 'Show only cards to learn'}
          </button>
          <button type="button" onClick={shuffle} className="btn btn-ghost btn-icon" title="Shuffle" aria-label="Shuffle">
            <Shuffle className="h-4 w-4" />
          </button>
          <button type="button" onClick={reset} className="btn btn-ghost btn-icon" title="Start the deck again" aria-label="Start the deck again">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {card ? (
        <Flashcard card={card} showAnswer={showAnswer} onFlip={() => setShowAnswer((s) => !s)} />
      ) : (
        <div className="card grid h-72 place-items-center p-8 text-center">
          <div>
            <p className="text-lg font-semibold">You know every card</p>
            <p className="muted mt-1 text-sm">They will come back in Review when they are due.</p>
            <button type="button" onClick={reset} className="btn btn-secondary mt-4">Go through the deck again</button>
          </div>
        </div>
      )}

      {card && (
        <div className="mt-5">
          {showAnswer ? (
            <>
              <p className="muted mb-2 text-center text-xs">How well did you know it?</p>
              <RatingBar onRate={rate} />
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => go(-1)} className="btn btn-secondary btn-icon" aria-label="Previous card">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setShowAnswer(true)} className="btn btn-primary flex-1 sm:flex-none sm:px-8">
                Show answer
              </button>
              <button type="button" onClick={() => go(1)} className="btn btn-secondary btn-icon" aria-label="Next card">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {saved?.due_at && (
            <p className="muted mt-3 text-center text-xs">
              Last time: {saved.last_rating} · next review {dueLabel(saved.due_at)}
            </p>
          )}
        </div>
      )}

      <div className="mt-8">
        <div className="mb-2 flex justify-between text-xs">
          <span className="muted">
            Known this session · {ratedCount} of {flashcards.length} rated
          </span>
          <span className="font-medium tabular-nums">
            {knownCount} of {flashcards.length}
          </span>
        </div>
        <div className="progress-track">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="muted mt-4 text-center text-xs">Space to flip · 1–4 to rate · ← → to move between cards</p>
      </div>
    </div>
  );
};

export default FlashcardDeck;

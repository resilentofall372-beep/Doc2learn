import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Shuffle } from 'lucide-react';
import Flashcard from './Flashcard';

const FlashcardDeck = ({ flashcards }) => {
  const [order, setOrder] = useState(() => flashcards.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [known, setKnown] = useState(() => new Set());
  const [onlyLearning, setOnlyLearning] = useState(false);

  useEffect(() => {
    setOrder(flashcards.map((_, i) => i));
    setPosition(0);
    setKnown(new Set());
    setShowAnswer(false);
  }, [flashcards]);

  const deck = useMemo(() => (onlyLearning ? order.filter((i) => !known.has(i)) : order), [order, known, onlyLearning]);
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

  const mark = useCallback(
    (isKnown) => {
      setKnown((prev) => {
        const next = new Set(prev);
        if (isKnown) next.add(index);
        else next.delete(index);
        return next;
      });
      if (!onlyLearning || !isKnown) go(1);
      else setShowAnswer(false);
    },
    [index, go, onlyLearning]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        setShowAnswer((s) => !s);
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const shuffle = () => {
    setOrder((prev) => [...prev].sort(() => Math.random() - 0.5));
    setPosition(0);
    setShowAnswer(false);
  };

  const reset = () => {
    setKnown(new Set());
    setOnlyLearning(false);
    setPosition(0);
    setShowAnswer(false);
  };

  const progress = flashcards.length ? (known.size / flashcards.length) * 100 : 0;

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
          <button type="button" onClick={reset} className="btn btn-ghost btn-icon" title="Reset progress" aria-label="Reset progress">
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
            <p className="muted mt-1 text-sm">Reset to go through the deck again.</p>
            <button type="button" onClick={reset} className="btn btn-secondary mt-4">Reset deck</button>
          </div>
        </div>
      )}

      {card && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => go(-1)} className="btn btn-secondary btn-icon" aria-label="Previous card">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => mark(false)} className="btn btn-secondary">Still learning</button>
            <button type="button" onClick={() => mark(true)} className="btn btn-primary">
              <Check className="h-4 w-4" />
              I knew this
            </button>
          </div>
          <button type="button" onClick={() => go(1)} className="btn btn-secondary btn-icon" aria-label="Next card">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-8">
        <div className="mb-2 flex justify-between text-xs">
          <span className="muted">Mastered</span>
          <span className="font-medium tabular-nums">
            {known.size} of {flashcards.length}
          </span>
        </div>
        <div className="progress-track">
          <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="muted mt-4 text-center text-xs">Space to flip · ← → to move between cards</p>
      </div>
    </div>
  );
};

export default FlashcardDeck;

import React from 'react';

const Face = ({ label, children, footer, back }) => (
  <div
    className={`flip-face absolute inset-0 flex flex-col rounded-2xl border p-8 shadow-sm ${
      back
        ? 'flip-back border-primary-200 bg-primary-50/60 dark:border-primary-500/30 dark:bg-zinc-900'
        : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
    }`}
  >
    <span className="eyebrow">{label}</span>
    <div className="flex flex-1 items-center justify-center overflow-y-auto py-4 text-center">{children}</div>
    <div className="muted text-center text-xs">{footer}</div>
  </div>
);

const Flashcard = ({ card, showAnswer, onFlip }) => (
  <button
    type="button"
    onClick={onFlip}
    className="flip-scene block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-zinc-950"
    aria-label={showAnswer ? 'Show question' : 'Show answer'}
  >
    <div className={`flip-card relative h-72 w-full ${showAnswer ? 'is-flipped' : ''}`}>
      <Face label="Question" footer="Click or press Space to reveal">
        <p className="text-xl font-medium leading-relaxed text-zinc-900 dark:text-zinc-50">{card.front}</p>
      </Face>
      <Face back label="Answer" footer={card.source_page ? `From page ${card.source_page}` : 'Click to flip back'}>
        <p className="text-base leading-relaxed text-zinc-800 dark:text-zinc-200">{card.back}</p>
      </Face>
    </div>
  </button>
);

export default Flashcard;

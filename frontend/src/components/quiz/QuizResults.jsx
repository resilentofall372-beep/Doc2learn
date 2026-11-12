import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MessageSquareText, RotateCcw, X } from 'lucide-react';
import { sourceLabel } from '../ui/RichText';

const verdict = (pct) => {
  if (pct >= 90) return 'Excellent work';
  if (pct >= 75) return 'Strong result';
  if (pct >= 50) return 'Good progress';
  return 'Keep practising';
};

const ScoreRing = ({ percentage }) => {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const tone = percentage >= 75 ? 'text-emerald-500' : percentage >= 50 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} strokeWidth="8" className="fill-none stroke-zinc-200 dark:stroke-zinc-800" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percentage / 100)}
          className={`fill-none stroke-current transition-[stroke-dashoffset] duration-700 ${tone}`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-2xl font-semibold tabular-nums">{percentage}%</span>
      </div>
    </div>
  );
};

const QuizResults = ({ results, onRestart, projectId }) => {
  const [filter, setFilter] = useState('all');
  const shown = results.questions.filter((q) => filter === 'all' || !q.isCorrect);
  const missed = results.questions.filter((q) => !q.isCorrect).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card flex flex-col items-center gap-6 p-6 sm:flex-row sm:p-8">
        <ScoreRing percentage={results.percentage} />
        <div className="flex-1 text-center sm:text-left">
          <h2 className="text-xl font-semibold tracking-tight">{verdict(results.percentage)}</h2>
          <p className="muted mt-1 text-sm">
            {results.score} of {results.total} correct · {results.timeSpent}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button type="button" onClick={onRestart} className="btn btn-primary">
              <RotateCcw className="h-4 w-4" />
              New quiz
            </button>
            {missed > 0 && (
              <Link to={`/projects/${projectId}/tutor`} className="btn btn-secondary">
                <MessageSquareText className="h-4 w-4" />
                Ask the tutor about mistakes
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header py-3">
          <h3 className="card-title">Review</h3>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {[
              ['all', `All (${results.total})`],
              ['missed', `Missed (${missed})`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === value ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50' : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="muted px-5 py-10 text-center text-sm">No mistakes to review. Nicely done.</p>
        ) : (
          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {shown.map((q) => {
              const index = results.questions.indexOf(q);
              return (
                <li key={index} className="flex gap-4 px-5 py-5">
                  <span
                    className={`mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full ${
                      q.isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                    }`}
                  >
                    {q.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">
                      <span className="muted mr-1.5 tabular-nums">{index + 1}.</span>
                      {q.question}
                    </p>
                    <dl className="mt-3 space-y-1.5">
                      <div className="flex gap-2">
                        <dt className="muted w-24 flex-shrink-0">Your answer</dt>
                        <dd className={q.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
                          {q.userAnswer ? `${q.userAnswer}. ${q.options[q.userAnswer]}` : 'No answer'}
                        </dd>
                      </div>
                      {!q.isCorrect && (
                        <div className="flex gap-2">
                          <dt className="muted w-24 flex-shrink-0">Correct</dt>
                          <dd className="text-emerald-700 dark:text-emerald-400">
                            {q.answer}. {q.options[q.answer]}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {q.explanation && <p className="mt-3 text-zinc-600 dark:text-zinc-400">{q.explanation}</p>}
                    {q.source && <span className="badge badge-neutral mt-3">{sourceLabel(q.source)}</span>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
};

export default QuizResults;

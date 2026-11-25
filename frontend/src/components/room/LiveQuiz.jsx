import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Clock, X } from 'lucide-react';
import Avatar from '../ui/Avatar';

const LiveQuiz = ({
  room,
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  onSubmitAnswer,
  hasAnswered,
  lastResult,
  participants,
  isHost,
  onNextQuestion,
  startedAt,
}) => {
  const limit = room.time_per_question;
  // Count down from when the server opened the question, so a refresh doesn't reset the clock.
  const remaining = () => {
    if (!startedAt) return limit;
    const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(startedAt) ? startedAt : `${startedAt}Z`;
    const elapsed = (Date.now() - new Date(iso).getTime()) / 1000;
    return Math.max(0, Math.min(limit, Math.ceil(limit - elapsed)));
  };
  const [timeLeft, setTimeLeft] = useState(remaining);
  const [selected, setSelected] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setTimeLeft(remaining());
    setSelected(null);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, limit, startedAt]);

  const choose = (key) => {
    if (hasAnswered || timeLeft === 0) return;
    setSelected(key);
    onSubmitAnswer({ selected_answer: key });
  };

  const answeredCount = participants?.filter((p) => p.answers?.some((a) => a.question_index === currentQuestionIndex)).length || 0;
  const pct = (timeLeft / limit) * 100;
  const barColor = pct > 50 ? 'bg-primary-600 dark:bg-primary-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
  const locked = hasAnswered || timeLeft === 0;
  const ranked = (participants || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="card overflow-hidden">
        <div className="progress-track h-1 rounded-none">
          <div className={`h-full transition-[width] duration-1000 ease-linear ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between px-6 pt-5 text-sm">
          <span className="font-medium">
            Question {currentQuestionIndex + 1} <span className="muted font-normal">of {totalQuestions}</span>
          </span>
          <span className={`inline-flex items-center gap-1.5 font-mono font-semibold tabular-nums ${timeLeft <= 5 ? 'text-red-600 dark:text-red-400' : ''}`}>
            <Clock className="h-4 w-4" />
            {timeLeft}s
          </span>
        </div>

        <div className="px-6 pb-6 pt-4">
          <h2 className="text-xl font-medium leading-relaxed">{currentQuestion.question}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Object.entries(currentQuestion.options).map(([key, value]) => {
              const active = selected === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => choose(key)}
                  disabled={locked}
                  className={`choice flex items-start gap-3 px-4 py-4 text-left font-normal disabled:cursor-default ${active ? 'choice-active' : ''} ${
                    locked && !active ? 'opacity-50' : ''
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border text-sm font-semibold ${
                      active ? 'border-primary-600 bg-primary-600 text-white' : 'border-zinc-300 text-zinc-500 dark:border-zinc-600'
                    }`}
                  >
                    {key}
                  </span>
                  <span className="pt-0.5 text-[15px]">{value}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 min-h-[3rem]">
            {lastResult ? (
              <div className={`alert ${lastResult.is_correct ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'alert-danger'}`}>
                {lastResult.is_correct ? <Check className="mt-0.5 h-4 w-4" /> : <X className="mt-0.5 h-4 w-4" />}
                <span>
                  {lastResult.is_correct ? (
                    <>
                      Correct. <strong className="font-semibold">+{lastResult.score_earned}</strong> points
                    </>
                  ) : (
                    'Not this time. Wait for the next question.'
                  )}
                </span>
              </div>
            ) : hasAnswered ? (
              <div className="alert alert-info">Answer locked in…</div>
            ) : timeLeft === 0 ? (
              <div className="alert alert-info">Time&apos;s up for this question.</div>
            ) : null}
          </div>
        </div>

        {isHost && (
          <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <span className="muted text-sm tabular-nums">
              {answeredCount} of {participants?.length || 0} answered
            </span>
            <button type="button" onClick={onNextQuestion} className="btn btn-primary">
              {currentQuestionIndex + 1 >= totalQuestions ? 'Show results' : 'Next question'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      <section className="card self-start">
        <div className="card-header py-3">
          <h2 className="card-title">Leaderboard</h2>
        </div>
        <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {ranked.map((p, index) => {
            const answered = p.answers?.some((a) => a.question_index === currentQuestionIndex);
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="muted w-4 text-right text-xs tabular-nums">{index + 1}</span>
                <Avatar name={p.name} avatar={p.avatar} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                {answered && <Check className="h-3.5 w-3.5 text-emerald-500" aria-label="Answered" />}
                <span className="w-12 text-right text-sm font-medium tabular-nums">{p.score || 0}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
};

export default LiveQuiz;

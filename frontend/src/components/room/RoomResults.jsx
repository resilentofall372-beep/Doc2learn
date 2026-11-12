import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Download, Plus, Trophy } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { sourceLabel } from '../ui/RichText';

const MEDALS = ['text-amber-500', 'text-zinc-400', 'text-orange-600'];

const stats = (p) => {
  const answers = p.answers || [];
  const correct = answers.filter((a) => a.is_correct).length;
  const avgTime = answers.length ? answers.reduce((sum, a) => sum + (a.time_taken || 0), 0) / answers.length : 0;
  return { correct, answered: answers.length, avgTime };
};

const RoomResults = ({ room, participants, totalQuestions, isHost, review = [] }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const ranked = participants?.slice().sort((a, b) => (b.score || 0) - (a.score || 0)) || [];
  const winner = ranked[0];

  const summary = () =>
    [
      `${room.room_name} (${room.room_code})`,
      ...ranked.map((p, i) => {
        const s = stats(p);
        return `${i + 1}. ${p.name}: ${p.score || 0} pts, ${s.correct}/${totalQuestions} correct`;
      }),
    ].join('\n');

  const download = () => {
    const url = URL.createObjectURL(new Blob([summary()], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-results-${room.room_code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card px-6 py-8 text-center">
        <Trophy className="mx-auto h-8 w-8 text-amber-500" />
        <p className="eyebrow mt-4">Final results</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{room.room_name}</h1>
        {winner && (winner.score || 0) > 0 && (
          <p className="muted mt-2 text-sm">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{winner.name}</span> wins with {winner.score || 0} points
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={copy} className="btn btn-secondary btn-sm">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy results'}
          </button>
          <button type="button" onClick={download} className="btn btn-secondary btn-sm">
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
          {isHost && (
            <button type="button" onClick={() => navigate('/create-quiz-room')} className="btn btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" />
              Host another
            </button>
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header py-3">
          <h2 className="card-title">Standings</h2>
          <span className="muted text-xs">{totalQuestions} questions · {participants.length} players</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="muted border-b border-zinc-200 text-left text-xs dark:border-zinc-800">
                <th className="px-5 py-2.5 font-medium">#</th>
                <th className="px-5 py-2.5 font-medium">Player</th>
                <th className="px-5 py-2.5 text-right font-medium">Score</th>
                <th className="px-5 py-2.5 text-right font-medium">Correct</th>
                <th className="px-5 py-2.5 text-right font-medium">Avg time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {ranked.map((p, i) => {
                const s = stats(p);
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3">
                      {i < 3 && (p.score || 0) > 0 ? (
                        <Trophy className={`h-4 w-4 ${MEDALS[i]}`} aria-label={`Rank ${i + 1}`} />
                      ) : (
                        <span className="muted tabular-nums">{i + 1}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={p.name} avatar={p.avatar} size="xs" />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{p.score || 0}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {s.correct}/{totalQuestions}
                    </td>
                    <td className="muted px-5 py-3 text-right tabular-nums">{s.answered ? `${s.avgTime.toFixed(1)}s` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {review.length > 0 && (
        <section className="card">
          <div className="card-header py-3">
            <h2 className="card-title">Answers</h2>
          </div>
          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {review.map((q, idx) => (
              <li key={idx} className="px-5 py-4 text-sm">
                <p className="font-medium">
                  <span className="muted mr-1.5 tabular-nums">{idx + 1}.</span>
                  {q.question}
                </p>
                <p className="mt-1.5 text-emerald-700 dark:text-emerald-400">
                  {q.answer}. {q.options?.[q.answer]}
                </p>
                {q.explanation && <p className="mt-1.5 text-zinc-600 dark:text-zinc-400">{q.explanation}</p>}
                {(q.source_document || q.source_page) && (
                  <span className="badge badge-neutral mt-2">
                    {sourceLabel({ filename: q.source_document?.filename, page: q.source_page })}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
};

export default RoomResults;

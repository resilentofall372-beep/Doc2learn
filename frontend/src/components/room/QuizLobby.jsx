import React, { useEffect, useState } from 'react';
import { Check, Copy, Crown, Play, RefreshCw, Sparkles } from 'lucide-react';
import { documentAPI, errorMessage, healthAPI } from '../../services/api';
import Avatar from '../ui/Avatar';
import LoadingSpinner from '../common/LoadingSpinner';

const QuizLobby = ({ room, isHost, onStartQuiz }) => {
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  // Prefer the configured network address so invite links work on other devices,
  // even when the host opened the app at localhost.
  const [baseUrl, setBaseUrl] = useState(window.location.origin);

  useEffect(() => {
    healthAPI
      .get()
      .then((res) => res.data.public_url && setBaseUrl(res.data.public_url))
      .catch(() => {});
  }, []);

  const inviteUrl = `${baseUrl}/join/${room.room_code}`;
  const displayUrl = inviteUrl.replace(/^https?:\/\//, '');
  const onLocalhost = /^(localhost|127\.)/.test(new URL(baseUrl).hostname);

  const generate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const res = await documentAPI.generateQuiz({
        projectId: room.project_id,
        documentId: room.document_id,
        num_questions: room.num_questions,
        difficulty: room.difficulty,
      });
      setQuestions(res.data.questions || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not generate questions'));
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const players = room.participants || [];
  const enoughPlayers = players.length >= 2;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className="card px-6 py-10 text-center">
          <p className="eyebrow">Room code</p>
          <p className="mt-4 font-mono text-5xl font-semibold tracking-[0.25em] text-zinc-900 dark:text-zinc-50 sm:text-6xl">{room.room_code}</p>
          <p className="muted mt-3 text-sm">
            Players join at <span className="font-medium text-zinc-700 dark:text-zinc-300">{displayUrl}</span>
          </p>
          {onLocalhost && isHost && (
            <p className="mx-auto mt-2 max-w-md text-xs text-amber-700 dark:text-amber-400">
              This address only works on this computer. To invite phones or laptops on your Wi-Fi, set PUBLIC_URL and
              CORS_ORIGINS in .env (see the README).
            </p>
          )}
          <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm mt-5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
          <div className="muted mt-8 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
            <span>{room.num_questions} questions</span>
            <span>{room.time_per_question}s per question</span>
            <span className="capitalize">{room.difficulty}</span>
            {(room.document_name || room.project_name) && <span>{room.document_name || room.project_name}</span>}
          </div>
        </section>

        {isHost ? (
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Host controls</h2>
              <span className="muted text-xs">Players can&apos;t see questions until you start</span>
            </div>
            <div className="space-y-4 p-5">
              {error && <div className="alert alert-danger">{error}</div>}
              {questions.length === 0 ? (
                <button type="button" onClick={generate} disabled={generating || !room.document_id} className="btn btn-secondary w-full">
                  {generating ? <LoadingSpinner size="small" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? 'Writing questions…' : 'Generate questions'}
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4" />
                    {questions.length} questions ready
                  </span>
                  <button type="button" onClick={generate} disabled={generating} className="btn btn-ghost btn-sm">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                </div>
              )}
              <button type="button" onClick={() => onStartQuiz(questions)} disabled={!questions.length || !enoughPlayers} className="btn btn-primary btn-lg w-full">
                <Play className="h-4 w-4" />
                Start quiz
              </button>
              {!enoughPlayers && <p className="muted text-center text-xs">Waiting for at least one player to join.</p>}
            </div>
          </section>
        ) : (
          <section className="card flex items-center gap-4 p-5">
            <LoadingSpinner size="medium" />
            <div>
              <p className="text-sm font-medium">You&apos;re in. Waiting for the host to start.</p>
              <p className="muted text-sm">The first question will appear here automatically.</p>
            </div>
          </section>
        )}
      </div>

      <section className="card self-start">
        <div className="card-header py-3">
          <h2 className="card-title">Players</h2>
          <span className="badge badge-neutral tabular-nums">
            {players.length}/{room.max_participants}
          </span>
        </div>
        <ul className="max-h-[28rem] divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={p.name} avatar={p.avatar} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
              {p.is_host && (
                <span className="badge badge-warning">
                  <Crown className="h-3 w-3" />
                  Host
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default QuizLobby;

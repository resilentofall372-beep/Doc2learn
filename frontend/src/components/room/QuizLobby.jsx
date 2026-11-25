import { useEffect, useState } from 'react';
import { Check, Copy, Crown, Link2, Play, RefreshCw, Sparkles, X } from 'lucide-react';
import { errorMessage, healthAPI, roomAPI } from '../../services/api';
import Avatar from '../ui/Avatar';
import LoadingSpinner from '../common/LoadingSpinner';

/** "1 h 40 m" until the invite expires, or null once it has (or for older rooms without an expiry). */
const timeLeft = (iso, now) => {
  if (!iso) return null;
  const minutes = Math.ceil((new Date(iso).getTime() - now) / 60000);
  if (minutes <= 0) return null;
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} m` : `${minutes} m`;
};

const QuizLobby = ({ room, isHost, credentials, onStartQuiz, onRemovePlayer, onRoomChange }) => {
  const [generating, setGenerating] = useState(false);
  const [questionCount, setQuestionCount] = useState(room.question_count || 0);
  const [renewing, setRenewing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  // Prefer the configured network address so invite links work on other devices,
  // even when the host opened the app at localhost.
  const [baseUrl, setBaseUrl] = useState(window.location.origin);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

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
      // Questions (and answers) stay on the server; the host only learns how many are ready.
      const res = await roomAPI.generateQuestions(room.room_id, credentials());
      setQuestionCount(res.data.question_count || 0);
    } catch (err) {
      setError(errorMessage(err, 'Could not generate questions'));
    } finally {
      setGenerating(false);
    }
  };

  // A fresh code: the old link stops working, people already here stay.
  const renewLink = async () => {
    setError(null);
    setRenewing(true);
    try {
      onRoomChange((await roomAPI.newCode(room.room_id, credentials())).data.room);
      setNow(Date.now());
    } catch (err) {
      setError(errorMessage(err, 'Could not make a new link'));
    } finally {
      setRenewing(false);
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
  const enoughPlayers = players.length >= 1;
  const expiresIn = timeLeft(room.invite_expires_at, now);
  const expired = Boolean(room.invite_expires_at) && !expiresIn;

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
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={copyLink} disabled={expired} className="btn btn-secondary btn-sm">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Link copied' : 'Copy invite link'}
            </button>
            {isHost && (
              <button type="button" onClick={renewLink} disabled={renewing} className="btn btn-ghost btn-sm">
                <Link2 className="h-3.5 w-3.5" />
                New link
              </button>
            )}
          </div>
          {isHost && (expiresIn || expired) && (
            <p className={`mt-2 text-xs ${expiresIn ? 'muted' : 'text-amber-700 dark:text-amber-400'}`}>
              {expiresIn ? `Link expires in ${expiresIn}. Players already here stay in.` : 'This link has expired. Make a new one to let more people in.'}
            </p>
          )}
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
              {questionCount === 0 ? (
                <button type="button" onClick={generate} disabled={generating || !room.project_id} className="btn btn-secondary w-full">
                  {generating ? <LoadingSpinner size="small" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? 'Writing questions…' : 'Generate questions'}
                </button>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Check className="h-4 w-4" />
                    {questionCount} questions ready
                  </span>
                  <button type="button" onClick={generate} disabled={generating} className="btn btn-ghost btn-sm">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                </div>
              )}
              <button type="button" onClick={onStartQuiz} disabled={!questionCount || !enoughPlayers} className="btn btn-primary btn-lg w-full">
                <Play className="h-4 w-4" />
                Start quiz
              </button>
              {!enoughPlayers && <p className="muted text-center text-xs">Waiting for the first player to join.</p>}
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
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/60">
          <Avatar name={room.host_name} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{room.host_name}</span>
          <span className="badge badge-warning">
            <Crown className="h-3 w-3" />
            Runs the quiz
          </span>
        </div>
        {players.length === 0 && <p className="muted px-5 py-6 text-center text-sm">No players yet. Share the code or link.</p>}
        <ul className="max-h-[28rem] divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar name={p.name} avatar={p.avatar} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
              {isHost && (
                <button
                  type="button"
                  onClick={() => window.confirm(`Remove ${p.name} from the quiz?`) && onRemovePlayer(p.id)}
                  aria-label={`Remove ${p.name}`}
                  className="btn btn-ghost btn-sm text-zinc-400 hover:text-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default QuizLobby;

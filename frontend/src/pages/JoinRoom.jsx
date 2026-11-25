import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Clock, FileText, Gauge, ListChecks, Users } from 'lucide-react';
import { errorMessage, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useAuth } from '../contexts/AuthContext';
import Avatar, { AVATAR_COLORS } from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner, { PageLoader } from '../components/common/LoadingSpinner';

const JoinRoom = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [color, setColor] = useState(Math.floor(Math.random() * AVATAR_COLORS.length));
  const [code, setCode] = useState('');

  const load = useCallback(async () => {
    if (!roomCode) {
      setLoading(false); // no code in the link: show the code box
      return;
    }
    try {
      const res = await roomAPI.getRoomByCode(roomCode);
      const found = res.data.room;
      setRoom(found);
      // Already in this room, or hosting it: go straight there (the room page restores a host's credentials).
      const hosting = Boolean(user && found.host_id === user.user_id);
      if (hosting || roomIdentity.load(found.room_id)) navigate(`/room/${found.room_id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'This code is invalid or the quiz has ended.'));
    } finally {
      setLoading(false);
    }
  }, [roomCode, navigate, user]);

  useEffect(() => {
    load();
  }, [load]);

  const join = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setJoinError('Enter a name of at least 2 characters.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const res = await roomAPI.join({ room_code: roomCode, participant_name: name.trim(), avatar: `c${color}` });
      const { room: joined, participant_id, participant_token } = res.data;
      roomIdentity.save(joined.room_id, { participant_id, participant_token, is_host: false });
      navigate(`/room/${joined.room_id}`);
    } catch (err) {
      setJoinError(errorMessage(err, 'Could not join'));
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <PageLoader />;

  // /join without a code: one box for the six characters the host shared.
  if (!roomCode) {
    return (
      <form
        className="card mx-auto max-w-md space-y-4 px-6 py-8 text-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) navigate(`/join/${code}`);
        }}
      >
        <h1 className="text-xl font-semibold tracking-tight">Join a live quiz</h1>
        <p className="muted text-sm">Enter the code from the host. No account needed.</p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={6}
          autoFocus
          placeholder="ABC123"
          aria-label="Room code"
          className="input text-center font-mono text-lg uppercase tracking-[0.3em]"
        />
        <button type="submit" className="btn btn-primary w-full" disabled={code.length !== 6}>
          Continue
        </button>
      </form>
    );
  }

  if (error || !room) {
    return (
      <div className="card mx-auto max-w-md">
        <EmptyState
          icon={ListChecks}
          title="Can't join this quiz"
          description={error}
          action={<Link to="/join" className="btn btn-secondary">Enter another code</Link>}
        />
      </div>
    );
  }

  const canJoin = !room.is_full && room.quiz_state === 'lobby';
  const ownRoom = Boolean(user && room.host_id === user.user_id);
  const facts = [
    { icon: ListChecks, label: `${room.num_questions} questions` },
    { icon: Clock, label: `${room.time_per_question}s each` },
    { icon: Gauge, label: `${room.difficulty[0].toUpperCase()}${room.difficulty.slice(1)} difficulty` },
    { icon: Users, label: `${room.participants_count}/${room.max_participants} players` },
  ];

  return (
    <div className="mx-auto max-w-md">
      <div className="card overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-6 text-center dark:border-zinc-800">
          <span className="badge badge-neutral font-mono tracking-widest">{room.room_code}</span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">{room.room_name}</h1>
          <p className="muted mt-1 text-sm">Hosted by {room.host_name}</p>
          {(room.document_name || room.project_name) && (
            <p className="muted mt-2 inline-flex items-center gap-1 text-xs">
              <FileText className="h-3.5 w-3.5" />
              {room.document_name || room.project_name}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2 text-left">
            {facts.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-800/60">
                <Icon className="h-3.5 w-3.5 text-zinc-400" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {ownRoom ? (
          <PageLoader label="Opening your room…" />
        ) : canJoin ? (
          <form onSubmit={join} className="space-y-5 px-6 py-6">
            {joinError && <div className="alert alert-danger">{joinError}</div>}
            <div>
              <label htmlFor="name" className="label">Display name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus className="input" placeholder="How others will see you" />
            </div>
            <div>
              <span className="label">Colour</span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((bg, i) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setColor(i)}
                    aria-label={`Colour ${i + 1}`}
                    aria-pressed={color === i}
                    className={`h-8 w-8 rounded-full ${bg} ring-offset-2 transition dark:ring-offset-zinc-900 ${color === i ? 'ring-2 ring-zinc-900 dark:ring-zinc-100' : 'hover:scale-105'}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
              <Avatar name={name || '?'} avatar={`c${color}`} size="sm" />
              <span className="text-sm font-medium">{name || 'Your name'}</span>
            </div>
            <button type="submit" disabled={joining} className="btn btn-primary w-full">
              {joining ? <LoadingSpinner size="small" /> : 'Join quiz'}
            </button>
          </form>
        ) : (
          <div className="px-6 py-8 text-center">
            <p className="text-sm font-semibold">{room.is_full ? 'This quiz is full' : 'This quiz has already started'}</p>
            <p className="muted mt-1 text-sm">Ask the host to start a new one.</p>
            <Link to="/join" className="btn btn-secondary mt-5">Enter another code</Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinRoom;

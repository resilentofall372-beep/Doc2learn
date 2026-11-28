import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Radio, Users } from 'lucide-react';
import { errorMessage, roomAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';

const StudyRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState(null);
  const [checking, setChecking] = useState(false);
  const { addNotification } = useApp();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await roomAPI.getRooms();
      setRooms(res.data.rooms || []);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load rooms', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Live quizzes"
        description="Host a timed quiz from one of your projects and share its code or link. Only people you send it to can join."
        actions={
          <Link to="/create-quiz-room" className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Host a quiz
          </Link>
        }
      />

      <form
        className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
        onSubmit={async (e) => {
          e.preventDefault();
          const wanted = code.trim().toUpperCase();
          if (wanted.length !== 6 || checking) return;
          // Check the code here, so a wrong one is reported under the box instead of on its own page.
          setChecking(true);
          setCodeError(null);
          try {
            await roomAPI.getRoomByCode(wanted);
            navigate(`/join/${wanted}`);
          } catch (error) {
            setCodeError(error?.response?.status === 404 ? 'No open quiz has this code.' : errorMessage(error, 'Could not check this code'));
          } finally {
            setChecking(false);
          }
        }}
      >
        <div className="flex-1">
          <h2 className="card-title">Join with a code</h2>
          <p className="muted mt-0.5 text-sm">Enter the six characters shown on the host&apos;s screen.</p>
        </div>
        <div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                setCodeError(null);
              }}
              maxLength={6}
              placeholder="ABC123"
              aria-label="Room code"
              aria-invalid={Boolean(codeError)}
              aria-describedby={codeError ? 'room-code-error' : undefined}
              className={`input w-36 text-center font-mono text-base uppercase tracking-[0.3em] ${codeError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            />
            <button type="submit" className="btn btn-secondary" disabled={code.length !== 6 || checking}>
              {checking ? 'Checking…' : 'Join'}
            </button>
          </div>
          {codeError && <p id="room-code-error" className="field-error">{codeError}</p>}
        </div>
      </form>

      <section className="card mt-6">
        <div className="card-header">
          <h2 className="card-title">Your rooms</h2>
          <span className="muted text-xs">Rooms you host that are still open</span>
        </div>
        {loading ? (
          <PageLoader />
        ) : rooms.length === 0 ? (
          <EmptyState icon={Radio} title="No open rooms" description="Host a quiz and it shows here until you close it." />
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rooms.map((room) => (
              <li key={room.room_id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{room.room_name}</p>
                    <span className="badge badge-neutral font-mono">{room.room_code}</span>
                  </div>
                  <p className="muted mt-0.5 truncate text-xs">
                    {room.document_name || room.project_name} · {room.num_questions} questions · {room.time_per_question}s each ·{' '}
                    <span className="capitalize">{room.quiz_state === 'lobby' ? 'waiting for players' : room.quiz_state.replace('_', ' ')}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="muted inline-flex items-center gap-1 text-xs tabular-nums">
                    <Users className="h-3.5 w-3.5" />
                    {room.participants_count}/{room.max_participants}
                  </span>
                  <button type="button" onClick={() => navigate(`/room/${room.room_id}`)} className="btn btn-secondary btn-sm">
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default StudyRooms;

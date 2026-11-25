import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { errorMessage, projectAPI, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useApp } from '../contexts/AppContext';
import ScopePicker from '../components/projects/ScopePicker';
import Segmented from '../components/ui/Segmented';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Section = ({ title, description, children }) => (
  <div className="grid gap-4 px-5 py-6 md:grid-cols-[220px_1fr] md:gap-8">
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="muted mt-1 text-xs">{description}</p>}
    </div>
    <div className="space-y-5">{children}</div>
  </div>
);

const CreateQuizRoom = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addNotification } = useApp();

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectId, setProjectId] = useState(params.get('project') || '');
  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState(params.get('document') || '');
  const [roomName, setRoomName] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [difficulty, setDifficulty] = useState('medium');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    projectAPI
      .list()
      .then((res) => setProjects((res.data.projects || []).filter((p) => p.document_count > 0)))
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false));
  }, []);

  // Load the chosen project's documents for the optional "one document" picker.
  useEffect(() => {
    if (!projectId) {
      setDocuments([]);
      return;
    }
    projectAPI
      .get(projectId)
      .then((res) => {
        const docs = res.data.documents || [];
        setDocuments(docs);
        setDocumentId((current) => (docs.some((d) => d._id === current) ? current : ''));
      })
      .catch(() => setDocuments([]));
  }, [projectId]);

  const create = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return setError('Give the quiz a name.');
    if (!projectId) return setError('Choose the project the questions should come from.');
    setError(null);
    setCreating(true);
    try {
      const res = await roomAPI.create({
        room_name: roomName.trim(),
        project_id: projectId,
        ...(documentId ? { document_id: documentId } : {}),
        num_questions: numQuestions,
        time_per_question: timePerQuestion,
        difficulty,
        max_participants: maxParticipants,
      });
      const { room_id, room_code, participant_id, participant_token } = res.data;
      roomIdentity.save(room_id, { participant_id, participant_token, is_host: true });
      addNotification({ type: 'success', title: 'Quiz created', message: `Share code ${room_code} with your players.` });
      navigate(`/room/${room_id}`);
    } catch (err) {
      setError(errorMessage(err, 'Could not create the quiz'));
    } finally {
      setCreating(false);
    }
    return undefined;
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/study-rooms" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:text-zinc-900 dark:hover:text-zinc-100">
        <ChevronLeft className="h-4 w-4" />
        Live quizzes
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Host a live quiz</h1>
      <p className="muted mt-1.5 text-sm">Players join with a code. You control the pace, one question at a time.</p>

      <form onSubmit={create} className="card mt-8 divide-y divide-zinc-200 dark:divide-zinc-800">
        {error && (
          <div className="p-5">
            <div className="alert alert-danger">{error}</div>
          </div>
        )}
        <Section title="Basics" description="What players will see when they join.">
          <div>
            <label htmlFor="room-name" className="label">Quiz name</label>
            <input id="room-name" value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Friday biology revision" maxLength={60} className="input" />
          </div>
          <div>
            <label htmlFor="project" className="label">Project</label>
            {loadingProjects ? (
              <LoadingSpinner size="small" className="justify-start" />
            ) : projects.length === 0 ? (
              <p className="muted text-sm">
                You need a project with at least one document first.{' '}
                <Link to="/projects" className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
                  Go to projects
                </Link>
              </p>
            ) : (
              <select id="project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
                <option value="">Choose a project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.document_count} {p.document_count === 1 ? 'document' : 'documents'})
                  </option>
                ))}
              </select>
            )}
          </div>
          {documents.length > 1 && (
            <ScopePicker id="room-scope" label="Questions from" documents={documents} value={documentId} onChange={setDocumentId} />
          )}
        </Section>

        <Section title="Questions" description="Generated from your documents when you open the lobby.">
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <label htmlFor="num-questions" className="font-medium text-zinc-700 dark:text-zinc-300">Number of questions</label>
              <span className="font-medium tabular-nums">{numQuestions}</span>
            </div>
            <input id="num-questions" type="range" min="3" max="25" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full" />
          </div>
          <Segmented
            id="time-label"
            label="Time per question"
            value={timePerQuestion}
            onChange={setTimePerQuestion}
            options={[10, 15, 20, 30, 45, 60].map((t) => ({ value: t, label: `${t}s` }))}
          />
          <Segmented
            id="difficulty-label"
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
        </Section>

        <Section title="Players">
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <label htmlFor="max-players" className="font-medium text-zinc-700 dark:text-zinc-300">Maximum players</label>
              <span className="font-medium tabular-nums">{maxParticipants}</span>
            </div>
            <input id="max-players" type="range" min="2" max="100" value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} className="w-full" />
          </div>
        </Section>

        <div className="flex justify-end gap-2 bg-zinc-50 px-5 py-4 dark:bg-zinc-900/60">
          <Link to="/study-rooms" className="btn btn-ghost">Cancel</Link>
          <button type="submit" disabled={creating || projects.length === 0} className="btn btn-primary">
            {creating ? <LoadingSpinner size="small" /> : null}
            Create quiz
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuizRoom;

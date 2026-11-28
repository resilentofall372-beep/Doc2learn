import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { errorMessage, projectAPI, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useApp } from '../contexts/AppContext';
import ScopePicker from '../components/projects/ScopePicker';
import Segmented from '../components/ui/Segmented';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { DIFFICULTY_OPTIONS, QUIZ_PREFERENCES } from '../utils/constants';

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
  // Opened from a project (/projects/:id/live) the project is fixed and the project menu stays.
  const { projectId: routeProject } = useParams();
  const { addNotification } = useApp();

  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectId, setProjectId] = useState(routeProject || params.get('project') || '');
  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState(params.get('document') || '');
  const [roomName, setRoomName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const nameRef = useRef(null);
  const projectRef = useRef(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [difficulty, setDifficulty] = useState('medium');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const project = projects.find((p) => p._id === projectId);
  const suggestedName = project ? `${project.name} quiz` : '';

  // Until the host types a name, it follows the chosen project ("Biology quiz").
  useEffect(() => {
    if (!nameTouched) setRoomName(suggestedName);
  }, [suggestedName, nameTouched]);

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
    const name = roomName.trim() || suggestedName;
    const problems = {};
    if (!projectId) problems.project = 'Choose the project the questions should come from.';
    if (!name) problems.name = 'Give the quiz a name.';
    setFieldErrors(problems);
    if (problems.project) return projectRef.current?.focus();
    if (problems.name) return nameRef.current?.focus();
    setError(null);
    setCreating(true);
    try {
      const res = await roomAPI.create({
        room_name: name,
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
      <Link
        to={routeProject ? `/projects/${routeProject}` : '/study-rooms'}
        className="muted mb-4 inline-flex items-center gap-1 text-sm hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ChevronLeft className="h-4 w-4" />
        {routeProject ? project?.name || 'Back to project' : 'Live quizzes'}
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
            <input
              id="room-name"
              ref={nameRef}
              value={roomName}
              onChange={(e) => {
                setNameTouched(true);
                setRoomName(e.target.value);
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: null }));
              }}
              placeholder={suggestedName || 'Name your quiz'}
              maxLength={60}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'room-name-error' : undefined}
              className={`input ${fieldErrors.name ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            />
            {fieldErrors.name && <p id="room-name-error" className="field-error">{fieldErrors.name}</p>}
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
              <select
                id="project"
                ref={projectRef}
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  if (fieldErrors.project) setFieldErrors((prev) => ({ ...prev, project: null }));
                }}
                aria-invalid={Boolean(fieldErrors.project)}
                className={`input ${fieldErrors.project ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
              >
                <option value="">Choose a project</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.document_count} {p.document_count === 1 ? 'document' : 'documents'})
                  </option>
                ))}
              </select>
            )}
            {fieldErrors.project && <p className="field-error">{fieldErrors.project}</p>}
          </div>
          {documents.length > 1 && (
            <ScopePicker id="room-scope" label="Questions from" documents={documents} value={documentId} onChange={setDocumentId} />
          )}
        </Section>

        <Section title="Questions" description="Generated from your documents when you open the lobby.">
          <Segmented
            id="count-label"
            label="Questions"
            value={numQuestions}
            onChange={setNumQuestions}
            options={QUIZ_PREFERENCES.QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }))}
          />
          <Segmented
            id="time-label"
            label="Time per question"
            value={timePerQuestion}
            onChange={setTimePerQuestion}
            options={[10, 15, 20, 30, 45, 60].map((t) => ({ value: t, label: `${t}s` }))}
          />
          <Segmented id="difficulty-label" label="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
        </Section>

        <Section title="Players">
          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <label htmlFor="max-players" className="font-medium text-zinc-700 dark:text-zinc-300">Maximum players <span className="muted font-normal">(not counting you)</span></label>
              <span className="font-medium tabular-nums">{maxParticipants}</span>
            </div>
            <input id="max-players" type="range" min="1" max="100" value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} className="w-full" />
          </div>
        </Section>

        <div className="flex justify-end gap-2 bg-zinc-50 px-5 py-4 dark:bg-zinc-900/60">
          <Link to={routeProject ? `/projects/${routeProject}` : '/study-rooms'} className="btn btn-ghost">Cancel</Link>
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

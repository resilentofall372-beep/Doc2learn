import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { documentAPI, errorMessage, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useApp } from '../contexts/AppContext';
import DocumentUpload from '../components/document/DocumentUpload';
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

  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [documentId, setDocumentId] = useState(params.get('document') || '');
  const [showUpload, setShowUpload] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [difficulty, setDifficulty] = useState('medium');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    documentAPI
      .getDocuments()
      .then((res) => setDocuments(res.data.documents || []))
      .catch(() => setDocuments([]))
      .finally(() => setLoadingDocs(false));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return setError('Give the quiz a name.');
    if (!documentId) return setError('Choose the document the questions should come from.');
    setError(null);
    setCreating(true);
    try {
      const res = await roomAPI.create({
        room_name: roomName.trim(),
        document_id: documentId,
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
            <label htmlFor="document" className="label">Source document</label>
            {loadingDocs ? (
              <LoadingSpinner size="small" className="justify-start" />
            ) : (
              <select id="document" value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="input">
                <option value="">Choose a document</option>
                {documents.map((doc) => (
                  <option key={doc._id} value={doc._id}>{doc.filename}</option>
                ))}
              </select>
            )}
            <button type="button" onClick={() => setShowUpload((v) => !v)} className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
              {showUpload ? 'Hide upload' : 'Or upload a new document'}
            </button>
            {showUpload && (
              <div className="mt-3">
                <DocumentUpload
                  compact
                  onUpload={(doc) => {
                    setDocuments((prev) => [doc, ...prev]);
                    setDocumentId(doc._id);
                    setShowUpload(false);
                  }}
                />
              </div>
            )}
          </div>
        </Section>

        <Section title="Questions" description="Generated from the document when you open the lobby.">
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
          <button type="submit" disabled={creating} className="btn btn-primary">
            {creating ? <LoadingSpinner size="small" /> : null}
            Create quiz
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuizRoom;

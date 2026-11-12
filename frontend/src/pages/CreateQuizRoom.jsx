import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { documentAPI, errorMessage, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useApp } from '../contexts/AppContext';
import DocumentUpload from '../components/document/DocumentUpload';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CreateQuizRoom = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addNotification } = useApp();

  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [documentId, setDocumentId] = useState(params.get('document') || '');
  const [roomName, setRoomName] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [difficulty, setDifficulty] = useState('medium');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    documentAPI
      .getDocuments()
      .then((res) => setDocuments(res.data.documents || []))
      .catch(() => setDocuments([]))
      .finally(() => setLoadingDocs(false));
  }, []);

  const handleUploaded = (doc) => {
    setDocuments((prev) => [doc, ...prev]);
    setDocumentId(doc._id);
  };

  const create = async () => {
    if (!roomName.trim()) {
      addNotification({ type: 'error', title: 'Name required', message: 'Give your room a name.' });
      return;
    }
    if (!documentId) {
      addNotification({ type: 'error', title: 'Document required', message: 'Questions are generated from a document.' });
      return;
    }
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
      addNotification({ type: 'success', title: 'Room created', message: `Share code ${room_code}` });
      navigate(`/room/${room_id}`);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not create room', message: errorMessage(error) });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Host a live quiz</h1>
        <p className="text-gray-600">Players join with a code. You control the pace question by question.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 space-y-8">
        <div>
          <label htmlFor="room-name" className="block text-sm font-medium text-gray-700 mb-2">Room name</label>
          <input
            id="room-name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g. Friday biology revision"
            maxLength={60}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label htmlFor="document" className="block text-sm font-medium text-gray-700 mb-2">Source document</label>
          {loadingDocs ? (
            <LoadingSpinner size="small" />
          ) : (
            <select
              id="document"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Choose a document…</option>
              {documents.map((doc) => (
                <option key={doc._id} value={doc._id}>{doc.filename}</option>
              ))}
            </select>
          )}
          <details className="mt-3">
            <summary className="text-sm text-primary-600 cursor-pointer">Or upload a new document</summary>
            <div className="mt-3">
              <DocumentUpload onUpload={handleUploaded} />
            </div>
          </details>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Questions: <span className="text-primary-600 font-bold">{numQuestions}</span>
          </label>
          <input type="range" min="3" max="25" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Time per question</label>
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20, 30, 45, 60].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimePerQuestion(t)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  timePerQuestion === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t}s
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: 'easy', label: 'Easy', emoji: '😊', active: 'border-green-500 bg-green-50' },
              { value: 'medium', label: 'Medium', emoji: '🎯', active: 'border-yellow-500 bg-yellow-50' },
              { value: 'hard', label: 'Hard', emoji: '🔥', active: 'border-red-500 bg-red-50' },
            ].map((level) => (
              <button
                key={level.value}
                type="button"
                onClick={() => setDifficulty(level.value)}
                className={`p-4 rounded-lg border-2 transition-all ${difficulty === level.value ? level.active : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="text-3xl mb-1">{level.emoji}</div>
                <div className="font-semibold">{level.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max players: <span className="text-primary-600 font-bold">{maxParticipants}</span>
          </label>
          <input type="range" min="2" max="100" value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} className="w-full" />
        </div>

        <div className="flex space-x-4 pt-2">
          <button
            type="button"
            onClick={() => navigate('/study-rooms')}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={create}
            disabled={creating}
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating…' : 'Create room'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateQuizRoom;

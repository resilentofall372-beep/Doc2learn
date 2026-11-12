import React, { useState } from 'react';
import { documentAPI, errorMessage } from '../../services/api';

const QuizLobby = ({ room, isHost, onStartQuiz }) => {
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const res = await documentAPI.generateQuiz({
        document_id: room.document_id,
        num_questions: room.num_questions,
        difficulty: room.difficulty,
      });
      setQuestions(res.data.questions || []);
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate questions'));
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${room.room_code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const enoughPlayers = (room.participants?.length || 0) >= 2;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl p-8 mb-8 shadow-xl text-center">
        <h1 className="text-4xl font-bold mb-2">{room.room_name}</h1>
        <p className="text-xl opacity-90 mb-6">Waiting for the host to start</p>
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 inline-block">
          <p className="text-sm opacity-90 mb-2">Room code</p>
          <p className="text-5xl font-bold tracking-wider font-mono">{room.room_code}</p>
          <button type="button" onClick={copyLink} className="mt-4 bg-white/30 hover:bg-white/40 px-6 py-2 rounded-lg transition-colors">
            {copied ? 'Link copied' : 'Copy join link'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              {[
                ['Questions', room.num_questions],
                ['Per question', `${room.time_per_question}s`],
                ['Difficulty', room.difficulty],
                ['Players', `${room.participants?.length || 0}/${room.max_participants}`],
              ].map(([label, value]) => (
                <div key={label} className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600">{label}</div>
                  <div className="text-2xl font-bold text-gray-900 capitalize">{value}</div>
                </div>
              ))}
            </div>
            {room.document_name && <p className="mt-4 text-sm text-gray-500">Questions come from <span className="font-medium">{room.document_name}</span>.</p>}
          </div>

          {isHost ? (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Host controls</h2>
              {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>}
              {questions.length === 0 ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generating || !room.document_id}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
                  >
                    {generating ? 'Writing questions…' : 'Generate questions'}
                  </button>
                  <p className="text-sm text-gray-500 text-center">Generate while players join. Nobody sees the questions until you start.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-800 font-semibold">
                    {questions.length} questions ready
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartQuiz(questions)}
                    disabled={!enoughPlayers}
                    className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors text-lg shadow-lg"
                  >
                    Start quiz
                  </button>
                  {!enoughPlayers && <p className="text-sm text-orange-600 text-center">Need at least 2 players to start.</p>}
                  <button type="button" onClick={generate} disabled={generating} className="w-full text-sm text-blue-600 hover:underline">
                    {generating ? 'Regenerating…' : 'Regenerate questions'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="text-5xl mb-4">⏳</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Waiting for the host</h3>
              <p className="text-gray-600">The first question appears here as soon as the quiz starts.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-20">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Players ({room.participants?.length || 0})</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {room.participants?.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg ${p.is_host ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200' : 'bg-gray-50'}`}
                >
                  <span className="text-3xl">{p.avatar || '🙂'}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 truncate block">{p.name}</span>
                    {p.is_host && <span className="text-xs text-yellow-800">Host</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizLobby;

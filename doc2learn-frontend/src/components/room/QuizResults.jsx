// src/components/room/QuizResults.jsx - Final leaderboard and statistics
import React from 'react';
import { useNavigate } from 'react-router-dom';

const QuizResults = ({ room, participants, totalQuestions, isHost }) => {
  const navigate = useNavigate();

  // Sort participants by score
  const rankedParticipants = participants?.slice().sort((a, b) => (b.score || 0) - (a.score || 0)) || [];
  
  // Get top 3
  const winner = rankedParticipants[0];
  const second = rankedParticipants[1];
  const third = rankedParticipants[2];

  // Calculate statistics for each participant
  const getParticipantStats = (participant) => {
    const answers = participant.answers || [];
    const correctAnswers = answers.filter(a => a.is_correct).length;
    const totalAnswered = answers.length;
    const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : 0;
    const avgTime = totalAnswered > 0 
      ? answers.reduce((sum, a) => sum + (a.time_taken || 0), 0) / totalAnswered 
      : 0;
    
    return {
      correctAnswers,
      totalAnswered,
      accuracy,
      avgTime
    };
  };

  const downloadResults = () => {
    const resultsText = `
Quiz Results - ${room.room_name}
Room Code: ${room.room_code}
Date: ${new Date().toLocaleString()}

=== LEADERBOARD ===
${rankedParticipants.map((p, i) => {
  const stats = getParticipantStats(p);
  return `${i + 1}. ${p.name} - ${p.score || 0} points (${stats.accuracy.toFixed(1)}% accuracy)`;
}).join('\n')}

Total Questions: ${totalQuestions}
Participants: ${participants.length}
    `.trim();

    const blob = new Blob([resultsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-results-${room.room_code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyResults = () => {
    const resultsText = `
🏆 Quiz Results - ${room.room_name}

${rankedParticipants.slice(0, 3).map((p, i) => {
  const medals = ['🥇', '🥈', '🥉'];
  return `${medals[i]} ${p.name}: ${p.score || 0} points`;
}).join('\n')}

Room Code: ${room.room_code}
    `.trim();

    navigator.clipboard.writeText(resultsText);
    alert('Results copied to clipboard!');
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Celebration Header */}
      <div className="text-center mb-12">
        <div className="text-8xl mb-4 animate-bounce">🎉</div>
        <h1 className="text-5xl font-bold text-gray-900 mb-2">Quiz Complete!</h1>
        <p className="text-xl text-gray-600">{room.room_name}</p>
      </div>

      {/* Podium - Top 3 */}
      <div className="mb-12">
        <div className="flex items-end justify-center space-x-4 mb-8">
          {/* Second Place */}
          {second && (
            <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl p-6 shadow-xl transform hover:scale-105 transition-transform">
                <div className="text-6xl mb-2">{second.avatar || '😊'}</div>
                <div className="text-5xl mb-2">🥈</div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{second.name}</h3>
                <p className="text-3xl font-bold text-gray-800">{second.score || 0}</p>
                <p className="text-sm text-gray-600">points</p>
              </div>
              <div className="bg-gray-300 h-32 rounded-t-lg mt-4"></div>
            </div>
          )}

          {/* First Place */}
          {winner && (
            <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-2xl p-8 shadow-2xl transform hover:scale-105 transition-transform">
                <div className="text-7xl mb-2">{winner.avatar || '👑'}</div>
                <div className="text-6xl mb-2">🏆</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{winner.name}</h3>
                <p className="text-4xl font-bold text-gray-900">{winner.score || 0}</p>
                <p className="text-sm text-gray-700">points</p>
              </div>
              <div className="bg-yellow-400 h-40 rounded-t-lg mt-4"></div>
            </div>
          )}

          {/* Third Place */}
          {third && (
            <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="bg-gradient-to-br from-orange-300 to-orange-400 rounded-2xl p-6 shadow-xl transform hover:scale-105 transition-transform">
                <div className="text-6xl mb-2">{third.avatar || '😊'}</div>
                <div className="text-5xl mb-2">🥉</div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{third.name}</h3>
                <p className="text-3xl font-bold text-gray-800">{third.score || 0}</p>
                <p className="text-sm text-gray-600">points</p>
              </div>
              <div className="bg-orange-300 h-24 rounded-t-lg mt-4"></div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Results Table */}
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Detailed Results</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Rank</th>
                <th className="text-left py-3 px-4 text-gray-600 font-semibold">Player</th>
                <th className="text-center py-3 px-4 text-gray-600 font-semibold">Score</th>
                <th className="text-center py-3 px-4 text-gray-600 font-semibold">Correct</th>
                <th className="text-center py-3 px-4 text-gray-600 font-semibold">Accuracy</th>
                <th className="text-center py-3 px-4 text-gray-600 font-semibold">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {rankedParticipants.map((participant, index) => {
                const stats = getParticipantStats(participant);
                return (
                  <tr
                    key={participant.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      index < 3 ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <td className="py-4 px-4">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">{participant.avatar || '😊'}</span>
                        <span className="font-semibold text-gray-900">{participant.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-2xl font-bold text-primary-600">
                        {participant.score || 0}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-lg text-gray-700">
                        {stats.correctAnswers}/{stats.totalAnswered}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`text-lg font-semibold ${
                        stats.accuracy >= 80 ? 'text-green-600' :
                        stats.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {stats.accuracy.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-lg text-gray-700">
                        {stats.avgTime.toFixed(1)}s
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={copyResults}
          className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg flex items-center space-x-2"
        >
          <span>📋</span>
          <span>Copy Results</span>
        </button>
        <button
          onClick={downloadResults}
          className="bg-green-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg flex items-center space-x-2"
        >
          <span>⬇️</span>
          <span>Download Results</span>
        </button>
        <button
          onClick={() => navigate('/study-rooms')}
          className="bg-purple-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-purple-700 transition-colors shadow-lg flex items-center space-x-2"
        >
          <span>🏠</span>
          <span>Back to Rooms</span>
        </button>
        {isHost && (
          <button
            onClick={() => navigate('/create-quiz-room')}
            className="bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-orange-700 transition-colors shadow-lg flex items-center space-x-2"
          >
            <span>🎮</span>
            <span>Create New Quiz</span>
          </button>
        )}
      </div>

      {/* Quiz Stats */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-4xl mb-2">👥</div>
          <div className="text-3xl font-bold text-gray-900">{participants.length}</div>
          <div className="text-sm text-gray-600">Participants</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-4xl mb-2">❓</div>
          <div className="text-3xl font-bold text-gray-900">{totalQuestions}</div>
          <div className="text-sm text-gray-600">Questions</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <div className="text-3xl font-bold text-gray-900">{winner?.score || 0}</div>
          <div className="text-sm text-gray-600">Highest Score</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 text-center">
          <div className="text-4xl mb-2">⏱️</div>
          <div className="text-3xl font-bold text-gray-900">{room.time_per_question}s</div>
          <div className="text-sm text-gray-600">Per Question</div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default QuizResults;

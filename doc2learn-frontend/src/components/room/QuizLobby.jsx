// src/components/room/QuizLobby.jsx - Waiting room before quiz starts
import React, { useState } from 'react';
import { documentAPI } from '../../services/api';

const QuizLobby = ({ room, isHost, onStartQuiz, participantInfo }) => {
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [quizReady, setQuizReady] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState(null);

  const handleGenerateQuiz = async () => {
    setError(null);
    
    if (!room.document_id) {
      setError('No document uploaded! Please upload a document when creating the room.');
      return;
    }

    try {
      setGeneratingQuiz(true);
      console.log('📝 Generating quiz for document:', room.document_id);
      
      // Fetch document
      console.log('1️⃣ Fetching document...');
      const docResponse = await documentAPI.getDocument(room.document_id);
      console.log('✅ Document fetched:', docResponse.data);
      
      const documentText = docResponse.data.document?.extracted_text || '';
      
      if (!documentText || documentText.length < 50) {
        setError('Document text is too short or empty. Please upload a document with more content.');
        return;
      }
      
      console.log(`2️⃣ Generating ${room.num_questions} quiz questions...`);
      console.log(`   Text length: ${documentText.length} characters`);
      
      // Generate quiz
      const quizResponse = await documentAPI.generateQuiz({
        text: documentText,
        document_id: room.document_id,
        num_questions: room.num_questions || 10,
        difficulty: room.difficulty || 'medium'
      });
      
      console.log('✅ Quiz generated:', quizResponse.data);
      
      if (quizResponse.data.questions && quizResponse.data.questions.length > 0) {
        setQuestions(quizResponse.data.questions);
        setQuizReady(true);
        setError(null);
      } else {
        setError('No questions were generated. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error generating quiz:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to generate quiz';
      setError(`Error: ${errorMessage}`);
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleStartQuiz = () => {
    if (questions.length === 0) {
      setError('Please generate quiz questions first!');
      return;
    }
    onStartQuiz(questions);
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/join/${room.room_code}`;
    navigator.clipboard.writeText(link);
    alert('Room link copied to clipboard!');
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header with Room Code */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-2xl p-8 mb-8 shadow-xl">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">{room.room_name}</h1>
          <p className="text-xl opacity-90 mb-6">Waiting for quiz to start...</p>
          
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 inline-block">
            <p className="text-sm opacity-90 mb-2">Room Code</p>
            <p className="text-5xl font-bold tracking-wider font-mono">{room.room_code}</p>
            <button
              onClick={copyRoomLink}
              className="mt-4 bg-white/30 hover:bg-white/40 px-6 py-2 rounded-lg transition-colors"
            >
              📋 Copy Join Link
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Quiz Info & Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quiz Settings */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">📊 Quiz Settings</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">❓</div>
                <div className="text-sm text-gray-600">Questions</div>
                <div className="text-2xl font-bold text-gray-900">{room.num_questions}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">⏱️</div>
                <div className="text-sm text-gray-600">Time/Question</div>
                <div className="text-2xl font-bold text-gray-900">{room.time_per_question}s</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">🎯</div>
                <div className="text-sm text-gray-600">Difficulty</div>
                <div className="text-2xl font-bold text-gray-900 capitalize">{room.difficulty}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <div className="text-3xl mb-2">👥</div>
                <div className="text-sm text-gray-600">Players</div>
                <div className="text-2xl font-bold text-gray-900">
                  {room.participants?.length || 0}/{room.max_participants}
                </div>
              </div>
            </div>
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🎮 Host Controls</h2>
              
              {/* Error Message */}
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="text-2xl mr-3">❌</div>
                    <div>
                      <p className="text-red-800 font-semibold">Error</p>
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Document Info */}
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Document Status:</p>
                    <p className="font-semibold text-gray-900">
                      {room.document_id ? (
                        <span className="text-green-600">✅ Document Uploaded</span>
                      ) : (
                        <span className="text-red-600">❌ No Document</span>
                      )}
                    </p>
                  </div>
                  {room.document_id && (
                    <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded">
                      ID: {room.document_id.substring(0, 8)}...
                    </div>
                  )}
                </div>
              </div>
              
              {!quizReady ? (
                <div className="space-y-4">
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={generatingQuiz || !room.document_id}
                    className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
                  >
                    {generatingQuiz ? '⏳ Generating Questions...' : '✨ Generate Quiz Questions'}
                  </button>
                  <p className="text-sm text-gray-500 text-center">
                    {room.document_id 
                      ? 'Quiz questions will be generated from your uploaded document'
                      : '⚠️ Please upload a document when creating the room'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-3xl mb-2">✅</div>
                    <p className="text-green-800 font-semibold">
                      {questions.length} questions ready!
                    </p>
                  </div>
                  <button
                    onClick={handleStartQuiz}
                    disabled={room.participants.length < 2}
                    className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors text-lg shadow-lg"
                  >
                    🚀 Start Quiz Now
                  </button>
                  {room.participants.length < 2 && (
                    <p className="text-sm text-orange-600 text-center">
                      ⚠️ Need at least 2 participants to start
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Participant View */}
          {!isHost && (
            <div className="bg-white rounded-xl shadow-lg p-6 text-center">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Waiting for host to start...
              </h3>
              <p className="text-gray-600">
                The quiz will begin once the host clicks "Start Quiz"
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Participants */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              👥 Participants ({room.participants?.length || 0})
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {room.participants?.map((participant) => (
                <div
                  key={participant.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                    participant.is_host
                      ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-3xl">{participant.avatar || '😊'}</span>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-gray-900">
                        {participant.name}
                      </span>
                      {participant.is_host && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">
                          👑 Host
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Ready to play</p>
                  </div>
                </div>
              ))}
            </div>

            {room.participants?.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>No participants yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-3">📝 How to Play:</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-800">
          <div>
            <span className="font-semibold">1. Wait for players</span>
            <p className="text-blue-600">Share the room code with friends</p>
          </div>
          <div>
            <span className="font-semibold">2. Answer quickly</span>
            <p className="text-blue-600">Faster answers earn more points!</p>
          </div>
          <div>
            <span className="font-semibold">3. Beat the timer</span>
            <p className="text-blue-600">Each question has a time limit</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizLobby;

// src/components/room/LiveQuiz.jsx - Real-time quiz with timer and answers
import React, { useState, useEffect, useRef } from 'react';

const LiveQuiz = ({ 
  room, 
  currentQuestion, 
  currentQuestionIndex, 
  totalQuestions,
  onSubmitAnswer,
  hasAnswered,
  participants,
  isHost,
  onNextQuestion
}) => {
  const [timeLeft, setTimeLeft] = useState(room.time_per_question);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answerStartTime] = useState(Date.now());
  const timerRef = useRef(null);

  // Countdown timer
  useEffect(() => {
    setTimeLeft(room.time_per_question);
    setSelectedAnswer(null);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentQuestionIndex, room.time_per_question]);

  const handleAnswerSelect = (answer) => {
    if (hasAnswered) return;
    
    setSelectedAnswer(answer);
    const answerTime = (Date.now() - answerStartTime) / 1000; // in seconds
    
    onSubmitAnswer({
      selected_answer: answer,
      answer_time: answerTime,
      max_time: room.time_per_question
    });
  };

  // Calculate progress percentage
  const progressPercentage = (timeLeft / room.time_per_question) * 100;
  
  // Timer color based on time left
  const getTimerColor = () => {
    if (timeLeft > room.time_per_question * 0.5) return 'text-green-600';
    if (timeLeft > room.time_per_question * 0.25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTimerBgColor = () => {
    if (timeLeft > room.time_per_question * 0.5) return 'bg-green-100';
    if (timeLeft > room.time_per_question * 0.25) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  // Count how many have answered
  const answeredCount = participants?.filter(p => 
    p.answers?.some(a => a.question_index === currentQuestionIndex)
  ).length || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Quiz Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Progress Bar */}
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-600">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
              <span className="text-sm font-semibold text-gray-600">
                {answeredCount}/{participants?.length} answered
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Timer */}
          <div className={`${getTimerBgColor()} rounded-xl p-6 shadow-lg`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className={`text-6xl font-bold ${getTimerColor()}`}>
                  {timeLeft}
                </div>
                <div>
                  <p className="text-sm text-gray-600">seconds remaining</p>
                  <div className="w-32 bg-gray-300 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        timeLeft > room.time_per_question * 0.5 ? 'bg-green-500' :
                        timeLeft > room.time_per_question * 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              {timeLeft === 0 && (
                <div className="text-red-600 font-bold text-xl animate-pulse">
                  ⏰ Time's Up!
                </div>
              )}
            </div>
          </div>

          {/* Question Card */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 leading-relaxed">
              {currentQuestion.question}
            </h2>

            {/* Answer Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(currentQuestion.options).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => handleAnswerSelect(key)}
                  disabled={hasAnswered || timeLeft === 0}
                  className={`p-6 rounded-xl border-2 text-left transition-all transform hover:scale-105 disabled:cursor-not-allowed ${
                    selectedAnswer === key
                      ? 'border-primary-500 bg-primary-50 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  } ${
                    hasAnswered || timeLeft === 0 ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      selectedAnswer === key
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {key}
                    </div>
                    <div className="flex-1">
                      <p className="text-lg text-gray-900">{value}</p>
                    </div>
                    {selectedAnswer === key && (
                      <div className="flex-shrink-0 text-2xl">✓</div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Status Message */}
            {hasAnswered && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-800 font-semibold">
                  ✅ Answer submitted! Waiting for others...
                </p>
              </div>
            )}

            {timeLeft === 0 && !hasAnswered && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-800 font-semibold">
                  ⏰ Time's up! You didn't answer in time.
                </p>
              </div>
            )}
          </div>

          {/* Host Controls */}
          {isHost && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    {answeredCount} of {participants?.length} participants have answered
                  </p>
                  <div className="w-48 bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(answeredCount / participants?.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <button
                  onClick={onNextQuestion}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Next Question →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">🏆</span>
              Leaderboard
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {participants
                ?.slice()
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((participant, index) => (
                  <div
                    key={participant.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border border-yellow-300'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-100 to-gray-50 border border-gray-300'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-100 to-orange-50 border border-orange-300'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-2xl font-bold text-gray-400 w-8">
                      {index + 1}
                    </div>
                    <span className="text-2xl">{participant.avatar || '😊'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {participant.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {participant.score || 0} pts
                      </p>
                    </div>
                    {participant.answers?.some(a => a.question_index === currentQuestionIndex) && (
                      <div className="text-green-500 text-xl">✓</div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveQuiz;

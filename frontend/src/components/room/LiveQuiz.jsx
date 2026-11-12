import React, { useEffect, useRef, useState } from 'react';

const LiveQuiz = ({
  room,
  currentQuestion,
  currentQuestionIndex,
  totalQuestions,
  onSubmitAnswer,
  hasAnswered,
  lastResult,
  participants,
  isHost,
  onNextQuestion,
}) => {
  const limit = room.time_per_question;
  const [timeLeft, setTimeLeft] = useState(limit);
  const [selected, setSelected] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setTimeLeft(limit);
    setSelected(null);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentQuestionIndex, limit]);

  const choose = (key) => {
    if (hasAnswered || timeLeft === 0) return;
    setSelected(key);
    onSubmitAnswer({ selected_answer: key });
  };

  const answeredCount = participants?.filter((p) => p.answers?.some((a) => a.question_index === currentQuestionIndex)).length || 0;
  const urgency = timeLeft > limit * 0.5 ? 'green' : timeLeft > limit * 0.25 ? 'yellow' : 'red';
  const urgencyText = { green: 'text-green-600', yellow: 'text-yellow-600', red: 'text-red-600' }[urgency];
  const urgencyBg = { green: 'bg-green-100', yellow: 'bg-yellow-100', red: 'bg-red-100' }[urgency];
  const urgencyBar = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' }[urgency];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2 text-sm font-semibold text-gray-600">
              <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
              <span>{answeredCount}/{participants?.length || 0} answered</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full transition-all duration-300" style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }} />
            </div>
          </div>

          <div className={`${urgencyBg} rounded-xl p-6 shadow-lg flex items-center justify-between`}>
            <div className="flex items-center space-x-4">
              <div className={`text-6xl font-bold ${urgencyText}`}>{timeLeft}</div>
              <div>
                <p className="text-sm text-gray-600">seconds left</p>
                <div className="w-32 bg-gray-300 rounded-full h-2 mt-1">
                  <div className={`h-2 rounded-full transition-all duration-1000 ${urgencyBar}`} style={{ width: `${(timeLeft / limit) * 100}%` }} />
                </div>
              </div>
            </div>
            {timeLeft === 0 && <div className="text-red-600 font-bold text-xl">Time's up</div>}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 leading-relaxed">{currentQuestion.question}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(currentQuestion.options).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => choose(key)}
                  disabled={hasAnswered || timeLeft === 0}
                  className={`p-6 rounded-xl border-2 text-left transition-all disabled:cursor-not-allowed ${
                    selected === key ? 'border-primary-500 bg-primary-50 shadow-lg' : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  } ${hasAnswered && selected !== key ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${selected === key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {key}
                    </div>
                    <p className="text-lg text-gray-900 flex-1">{value}</p>
                  </div>
                </button>
              ))}
            </div>

            {lastResult && (
              <div className={`mt-6 rounded-lg p-4 text-center font-semibold ${lastResult.is_correct ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                {lastResult.is_correct ? `Correct! +${lastResult.score_earned} points` : 'Not quite. Waiting for the next question…'}
              </div>
            )}
            {hasAnswered && !lastResult && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center text-blue-800 font-semibold">Answer sent…</div>
            )}
            {timeLeft === 0 && !hasAnswered && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-center text-red-800 font-semibold">No answer this round.</div>
            )}
          </div>

          {isHost && (
            <div className="bg-white rounded-xl shadow-lg p-6 flex items-center justify-between">
              <p className="text-sm text-gray-600">{answeredCount} of {participants?.length || 0} players have answered</p>
              <button type="button" onClick={onNextQuestion} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                {currentQuestionIndex + 1 >= totalQuestions ? 'Finish quiz' : 'Next question'}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 sticky top-20">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Leaderboard</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {participants
                ?.slice()
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((p, index) => (
                  <div
                    key={p.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg ${
                      index === 0 ? 'bg-yellow-50 border border-yellow-300' : index === 1 ? 'bg-gray-100 border border-gray-300' : index === 2 ? 'bg-orange-50 border border-orange-300' : 'bg-gray-50'
                    }`}
                  >
                    <div className="text-xl font-bold text-gray-400 w-6">{index + 1}</div>
                    <span className="text-2xl">{p.avatar || '🙂'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-sm text-gray-600">{p.score || 0} pts</p>
                    </div>
                    {p.answers?.some((a) => a.question_index === currentQuestionIndex) && <span className="text-green-500 text-xl">✓</span>}
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

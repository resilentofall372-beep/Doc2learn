import React, { useState } from 'react';

const QuizResults = ({ results, onRestart, onDashboard }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreMessage = (percentage) => {
    if (percentage >= 90) return 'Excellent! 🎉';
    if (percentage >= 80) return 'Great job! 👍';
    if (percentage >= 70) return 'Good work! 😊';
    if (percentage >= 60) return 'Not bad! 📚';
    return 'Keep practicing! 💪';
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {/* Score Summary */}
        <div className="text-center mb-8">
          <div className={`text-6xl font-bold mb-4 ${getScoreColor(results.percentage)}`}>
            {results.percentage}%
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {getScoreMessage(results.percentage)}
          </h2>
          <p className="text-gray-600 mb-2">
            You scored {results.score} out of {results.total} questions correctly.
          </p>
          <p className="text-gray-500 text-sm">
            Time spent: {results.timeSpent}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mb-8">
          <button
            onClick={onRestart}
            className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 transition-colors"
          >
            Retake Quiz
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          <button
            onClick={onDashboard}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Detailed Results */}
        {showDetails && (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900">Detailed Results</h3>
            {results.questions.map((question, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg ${
                  question.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start mb-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 mt-1 ${
                      question.isCorrect ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    {question.isCorrect ? '✓' : '✗'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Question {index + 1}: {question.question}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm">
                        <span className="font-medium">Your answer:</span>{' '}
                        <span className={question.isCorrect ? 'text-green-700' : 'text-red-700'}>
                          {question.userAnswer ? `${question.userAnswer}) ${question.options[question.userAnswer]}` : 'No answer'}
                        </span>
                      </p>
                      {!question.isCorrect && (
                        <p className="text-sm">
                          <span className="font-medium">Correct answer:</span>{' '}
                          <span className="text-green-700">
                            {question.answer}) {question.options[question.answer]}
                          </span>
                        </p>
                      )}
                      {question.explanation && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Explanation:</span> {question.explanation}
                        </p>
                      )}
                      {question.sourcePage && (
                        <p className="text-xs text-gray-400 mt-1">Source: page {question.sourcePage}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizResults;
import React from 'react';

const QuizQuestion = ({ question, questionNumber, selectedAnswer, onAnswerSelect }) => {
  if (!question) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Question {questionNumber}
        </h3>
        <p className="text-gray-700 text-lg">{question.question}</p>
      </div>

      <div className="space-y-3">
        {Object.entries(question.options).map(([key, value]) => (
          <div
            key={key}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${
              selectedAnswer === key
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => onAnswerSelect(key)}
          >
            <div className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full border flex items-center justify-center mr-3 ${
                  selectedAnswer === key
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-400'
                }`}
              >
                {selectedAnswer === key && (
                  <div className="w-2 h-2 rounded-full bg-white"></div>
                )}
              </div>
              <span className="font-medium mr-2">{key})</span>
              <span>{value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizQuestion;
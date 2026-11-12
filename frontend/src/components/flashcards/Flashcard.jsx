import React from 'react';

const Flashcard = ({ card, showAnswer, onFlip, isKnown }) => {
  // Support both front/back and question/answer formats
  const question = card.front || card.question || 'No question';
  const answer = card.back || card.answer || 'No answer';
  
  return (
    <div 
      className="perspective-1000 cursor-pointer"
      onClick={onFlip}
    >
      <div
        className={`relative w-full h-64 transition-all duration-500 ${
          showAnswer ? 'rotate-y-180' : ''
        }`}
        style={{ 
          transformStyle: 'preserve-3d',
          transform: showAnswer ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* Front of card */}
        <div
          className={`absolute inset-0 w-full h-full rounded-xl border-2 p-6 flex flex-col justify-center items-center ${
            isKnown ? 'bg-green-50 border-green-500' : 'bg-white border-gray-300'
          }`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {isKnown && (
            <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Known
            </div>
          )}
          <div className="text-center">
            <div className="text-gray-500 text-sm mb-2">Question</div>
            <h3 className="text-xl font-semibold text-gray-900">{question}</h3>
            <div className="mt-4 text-sm text-gray-500">
              Click to reveal answer
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div
          className="absolute inset-0 w-full h-full rounded-xl border-2 border-primary-200 bg-primary-50 p-6 flex flex-col justify-center items-center"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <div className="text-center">
            <div className="text-primary-600 text-sm mb-2">Answer</div>
            <h3 className="text-xl font-semibold text-gray-900">{answer}</h3>
            <div className="mt-4 text-sm text-primary-600">
              Click to see question
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
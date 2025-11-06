import React from 'react';

const FlashcardControls = ({
  onPrevious,
  onNext,
  onMarkKnown,
  onReset,
  showAnswer,
  hasPrevious,
  hasNext,
  allKnown
}) => {
  return (
    <div className="flex justify-center space-x-4">
      <button
        onClick={onPrevious}
        disabled={!hasPrevious}
        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>
      
      <button
        onClick={onMarkKnown}
        disabled={!showAnswer}
        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Mark as Known
      </button>
      
      <button
        onClick={onNext}
        className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
      >
        Next
      </button>
      
      {allKnown && (
        <button
          onClick={onReset}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Reset All
        </button>
      )}
    </div>
  );
};

export default FlashcardControls;
import React, { useState } from 'react';
import Flashcard from './Flashcard';
import FlashcardControls from './FlashcardControls';

const FlashcardDeck = ({ flashcards }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [knownCards, setKnownCards] = useState(new Set());

  const currentCard = flashcards[currentIndex];

  const handleNext = () => {
    setShowAnswer(false);
    setCurrentIndex(prev => (prev + 1) % flashcards.length);
  };

  const handlePrevious = () => {
    setShowAnswer(false);
    setCurrentIndex(prev => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleMarkKnown = () => {
    setKnownCards(prev => new Set(prev).add(currentCard.id));
    handleNext();
  };

  const handleReset = () => {
    setKnownCards(new Set());
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const progress = {
    current: currentIndex + 1,
    total: flashcards.length,
    known: knownCards.size
  };

  if (!currentCard) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No flashcards available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="text-center">
        <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
          <span>Card {progress.current} of {progress.total}</span>
          <span>{progress.known} marked as known</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Flashcard */}
      <Flashcard
        card={currentCard}
        showAnswer={showAnswer}
        onFlip={() => setShowAnswer(!showAnswer)}
        isKnown={knownCards.has(currentCard.id)}
      />

      {/* Controls */}
      <FlashcardControls
        onPrevious={handlePrevious}
        onNext={handleNext}
        onMarkKnown={handleMarkKnown}
        onReset={handleReset}
        showAnswer={showAnswer}
        hasPrevious={currentIndex > 0}
        hasNext={currentIndex < flashcards.length - 1}
        allKnown={knownCards.size === flashcards.length}
      />
    </div>
  );
};

export default FlashcardDeck;
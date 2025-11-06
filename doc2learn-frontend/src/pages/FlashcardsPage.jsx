import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { flashcardsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import FlashcardDeck from '../components/flashcards/FlashcardDeck';
import LoadingSpinner from '../components/common/LoadingSpinner';

const FlashcardsPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [studyMode, setStudyMode] = useState('all'); // 'all', 'unknown', 'known'
  const { addNotification } = useApp();

  useEffect(() => {
    loadFlashcards();
  }, [documentId]);

  const loadFlashcards = async () => {
    try {
      const response = await flashcardsAPI.getFlashcards(documentId);
      setFlashcards(response.data.flashcards || []);
    } catch (error) {
      console.error('Error loading flashcards:', error);
      // Flashcard generation will happen on demand
    } finally {
      setLoading(false);
    }
  };

  const generateFlashcards = async () => {
    try {
      setGenerating(true);
      console.log('🎴 Generating flashcards for document:', documentId);
      
      // Fetch the document first to get its text
      const documentResponse = await fetch(`http://localhost:5000/document/${documentId}`);
      const documentData = await documentResponse.json();
      
      if (!documentData.success || !documentData.document) {
        throw new Error('Failed to fetch document');
      }
      
      const documentText = documentData.document.extracted_text || documentData.document.content || '';
      console.log('📄 Document text length:', documentText.length);
      
      if (!documentText) {
        throw new Error('No text content found in document');
      }
      
      const response = await flashcardsAPI.generate({
        document_id: documentId,
        text: documentText,
        num_cards: 10
      });
      
      console.log('✅ Flashcards response:', response.data);
      
      setFlashcards(response.data.flashcards || []);
      addNotification({
        type: 'success',
        title: 'Flashcards Generated',
        message: `Generated ${response.data.flashcards?.length || 0} flashcards successfully!`
      });
    } catch (error) {
      console.error('❌ Error generating flashcards:', error);
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: error.message || 'Could not generate flashcards'
      });
      
      // Fallback sample flashcards
      setFlashcards([
        {
          front: "What is the main topic of this document?",
          back: "The document covers fundamental programming concepts and basic syntax."
        },
        {
          front: "What are the key learning objectives?",
          back: "Understanding basic syntax, data types, control structures, and problem-solving approaches."
        },
        {
          front: "Why is practice important in programming?",
          back: "Practice helps reinforce concepts, develop problem-solving skills, and build muscle memory for coding patterns."
        },
        {
          front: "What is a variable in programming?",
          back: "A variable is a named storage location that holds data which can be modified during program execution."
        },
        {
          front: "What are control structures?",
          back: "Control structures are programming constructs that determine the flow of program execution, like loops and conditionals."
        }
      ]);
    } finally {
      setGenerating(false);
    }
  };

  const filteredFlashcards = () => {
    // In a real app, you'd filter based on user's known/unknown status
    return flashcards;
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Flashcards Available</h3>
        <p className="text-gray-600 mb-6">
          Generate flashcards from your document to start studying.
        </p>
        <div className="space-x-4">
          <button
            onClick={generateFlashcards}
            disabled={generating}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating Flashcards...' : 'Generate Flashcards'}
          </button>
          <button
            onClick={goToDashboard}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Study Flashcards</h1>
        <p className="text-gray-600 mb-4">
          Flip the cards to test your knowledge. {flashcards.length} cards available.
        </p>
        
        {/* Study Mode Selector */}
        <div className="flex justify-center space-x-4 mb-6">
          <button
            onClick={() => setStudyMode('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              studyMode === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Cards
          </button>
          <button
            onClick={() => setStudyMode('unknown')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              studyMode === 'unknown'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Need Practice
          </button>
          <button
            onClick={() => setStudyMode('known')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              studyMode === 'known'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Mastered
          </button>
        </div>
      </div>
      
      <FlashcardDeck flashcards={filteredFlashcards()} />
      
      {/* Study Tips */}
      <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">Study Tips</h3>
            <div className="mt-2 text-sm text-green-700">
              <p>• Click on cards to flip them and reveal answers</p>
              <p>• Mark cards as "Known" when you've mastered them</p>
              <p>• Focus on cards you need more practice with</p>
              <p>• Regular review helps with long-term retention</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardsPage;
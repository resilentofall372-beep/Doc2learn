import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage, flashcardsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import FlashcardDeck from '../components/flashcards/FlashcardDeck';
import LoadingSpinner from '../components/common/LoadingSpinner';

const withIds = (cards) => cards.map((card, index) => ({ ...card, id: card.id ?? index }));

const FlashcardsPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useApp();
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [numCards, setNumCards] = useState(10);

  const load = useCallback(async () => {
    try {
      const res = await flashcardsAPI.getFlashcards(documentId);
      setFlashcards(withIds(res.data.flashcards || []));
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load flashcards', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [documentId, addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await flashcardsAPI.generate({ document_id: documentId, num_cards: numCards });
      setFlashcards(withIds(res.data.flashcards || []));
      addNotification({ type: 'success', title: 'Flashcards ready', message: `${res.data.flashcards.length} cards generated` });
    } catch (error) {
      addNotification({ type: 'error', title: 'Generation failed', message: errorMessage(error) });
    } finally {
      setGenerating(false);
    }
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
        <div className="text-5xl mb-4">🗂️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No flashcards yet</h3>
        <p className="text-gray-600 mb-6">Generate a deck from this document. Each card notes the page it came from.</p>
        <div className="flex items-center justify-center gap-3 mb-6">
          <label htmlFor="num-cards" className="text-sm text-gray-700">Cards</label>
          <select
            id="num-cards"
            value={numCards}
            onChange={(e) => setNumCards(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="space-x-4">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {generating ? 'Generating…' : 'Generate flashcards'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Flashcards</h1>
        <p className="text-gray-600 mb-4">Flip each card to check yourself. {flashcards.length} cards in this deck.</p>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="text-sm text-primary-600 hover:underline disabled:opacity-50"
        >
          {generating ? 'Generating a new deck…' : 'Generate a fresh deck'}
        </button>
      </div>

      <FlashcardDeck flashcards={flashcards} />
    </div>
  );
};

export default FlashcardsPage;

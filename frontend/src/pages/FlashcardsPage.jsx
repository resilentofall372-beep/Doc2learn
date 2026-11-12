import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layers, RefreshCw } from 'lucide-react';
import { errorMessage, flashcardsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import DocumentLayout from '../components/document/DocumentLayout';
import FlashcardDeck from '../components/flashcards/FlashcardDeck';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';

const FlashcardsPage = () => {
  const { id: documentId } = useParams();
  const { addNotification } = useApp();
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [numCards, setNumCards] = useState(10);

  const load = useCallback(async () => {
    try {
      const res = await flashcardsAPI.getFlashcards(documentId);
      setFlashcards(res.data.flashcards || []);
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
      setFlashcards(res.data.flashcards || []);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not generate flashcards', message: errorMessage(error) });
    } finally {
      setGenerating(false);
    }
  };

  let body;
  if (loading) body = <PageLoader />;
  else if (generating) body = <PageLoader label="Writing flashcards from your document…" />;
  else if (flashcards.length === 0) {
    body = (
      <div className="card">
        <EmptyState
          icon={Layers}
          title="No flashcards yet"
          description="Generate a deck from this document. Each card notes the page it came from."
          action={
            <div className="flex items-center gap-2">
              <select
                value={numCards}
                onChange={(e) => setNumCards(Number(e.target.value))}
                className="input w-auto"
                aria-label="Number of cards"
              >
                {[5, 10, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>{n} cards</option>
                ))}
              </select>
              <button type="button" onClick={generate} className="btn btn-primary">Generate deck</button>
            </div>
          }
        />
      </div>
    );
  } else {
    body = (
      <>
        <FlashcardDeck flashcards={flashcards} />
        <div className="mt-10 text-center">
          <button type="button" onClick={generate} className="btn btn-ghost btn-sm">
            <RefreshCw className="h-3.5 w-3.5" />
            Generate a fresh deck
          </button>
        </div>
      </>
    );
  }

  return <DocumentLayout>{body}</DocumentLayout>;
};

export default FlashcardsPage;

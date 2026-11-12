import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Layers, RefreshCw } from 'lucide-react';
import { errorMessage, flashcardsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import ProjectLayout from '../components/projects/ProjectLayout';
import ScopePicker from '../components/projects/ScopePicker';
import FlashcardDeck from '../components/flashcards/FlashcardDeck';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';

const Deck = ({ projectId, documents }) => {
  const { addNotification } = useApp();
  const [params, setParams] = useSearchParams();
  const wanted = params.get('document');
  const documentId = documents.some((d) => d._id === wanted) ? wanted : '';
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [numCards, setNumCards] = useState(10);

  const setDocumentId = (id) => setParams(id ? { document: id } : {}, { replace: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await flashcardsAPI.getFlashcards(projectId, documentId || null);
      setFlashcards(res.data.flashcards || []);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load flashcards', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [projectId, documentId, addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await flashcardsAPI.generate({ projectId, documentId: documentId || null, num_cards: numCards });
      setFlashcards(res.data.flashcards || []);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not generate flashcards', message: errorMessage(error) });
    } finally {
      setGenerating(false);
    }
  };

  const picker =
    documents.length > 1 ? (
      <div className="mx-auto mb-6 max-w-2xl">
        <ScopePicker id="cards-scope" label="Deck for" documents={documents} value={documentId} onChange={setDocumentId} />
      </div>
    ) : null;

  if (loading) return <PageLoader />;
  if (generating) return <PageLoader label="Writing flashcards from your documents…" />;

  if (flashcards.length === 0) {
    return (
      <>
        {picker}
        <div className="card">
          <EmptyState
            icon={Layers}
            title="No flashcards yet"
            description="Generate a deck from your documents. Each card notes the file and page it came from."
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
      </>
    );
  }

  return (
    <>
      {picker}
      <FlashcardDeck flashcards={flashcards} />
      <div className="mt-10 text-center">
        <button type="button" onClick={generate} className="btn btn-ghost btn-sm">
          <RefreshCw className="h-3.5 w-3.5" />
          Generate a fresh deck
        </button>
      </div>
    </>
  );
};

const FlashcardsPage = () => {
  const { projectId } = useParams();
  return <ProjectLayout>{({ documents }) => <Deck projectId={projectId} documents={documents} />}</ProjectLayout>;
};

export default FlashcardsPage;

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Layers, RefreshCw } from 'lucide-react';
import { flashcardsAPI } from '../services/api';
import { useTask } from '../hooks/useTask';
import ProjectLayout from '../components/projects/ProjectLayout';
import ScopePicker from '../components/projects/ScopePicker';
import TopicPicker from '../components/projects/TopicPicker';
import { useTopics } from '../hooks/useTopics';
import FlashcardDeck from '../components/flashcards/FlashcardDeck';
import StaleNotice from '../components/projects/StaleNotice';
import PracticeNav from '../components/projects/PracticeNav';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { newerDocuments } from '../utils/time';
import { cardPayload } from '../utils/progress';

const Deck = ({ projectId, documents }) => {
  const run = useTask();
  const [params, setParams] = useSearchParams();
  const wanted = params.get('document');
  const documentId = documents.some((d) => d._id === wanted) ? wanted : '';
  const { topics, titles: topicTitles, loaded: topicsLoaded } = useTopics(projectId);
  const wantedTopic = params.get('topic') || '';
  // Until the outline loads, trust the URL; afterwards ignore ids that aren't in it.
  const topicId = !topicsLoaded || topicTitles[wantedTopic] ? wantedTopic : '';
  const [flashcards, setFlashcards] = useState([]);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [ratings, setRatings] = useState(0); // bumps the due-count badge after each rating
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [numCards, setNumCards] = useState(10);

  const setParam = (key, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );

  const load = useCallback(
    () =>
      run('Could not load flashcards', async () => {
        const res = await flashcardsAPI.getFlashcards(projectId, documentId || null, topicId || null);
        setFlashcards(res.data.flashcards || []);
        setGeneratedAt(res.data.generated_at || null);
        setSchedule(res.data.schedule || {});
      }, setLoading),
    [projectId, documentId, topicId, run]
  );

  useEffect(() => {
    load();
  }, [load]);

  const generate = () =>
    run('Could not generate flashcards', async () => {
      const res = await flashcardsAPI.generate({ projectId, documentId: documentId || null, topicId: topicId || null, num_cards: numCards });
      setFlashcards(res.data.flashcards || []);
      setGeneratedAt(res.data.generated_at || new Date().toISOString());
      setSchedule({});
    }, setGenerating);

  // Save a rating: it schedules the card's next review and counts towards the topic's mastery.
  const rate = useCallback(
    (card, rating) =>
      run('Could not save your rating', async () => {
        const res = await flashcardsAPI.review(projectId, cardPayload(card), rating, documentId || null);
        setSchedule((prev) => ({ ...prev, [res.data.card_id]: { due_at: res.data.due_at, last_rating: res.data.last_rating } }));
        setRatings((n) => n + 1);
      }),
    [projectId, documentId, run]
  );

  // Topic names on the cards; memoised so the deck doesn't reset on every render.
  const cards = useMemo(
    () => flashcards.map((card) => ({ ...card, topic_title: topicTitles[card.topic_id] || null })),
    [flashcards, topicTitles]
  );

  // A one-document deck can't miss newer files; a whole-project deck can.
  const missing = documentId ? [] : newerDocuments(documents, generatedAt);

  const pickers = (
    <>
    <PracticeNav projectId={projectId} refreshKey={ratings} />
    <div className="mx-auto mb-6 grid max-w-2xl gap-4 sm:grid-cols-2">
      {topicsLoaded && (
        <TopicPicker id="cards-topic" label="Topic" projectId={projectId} topics={topics} value={topicId} onChange={(id) => setParam('topic', id)} />
      )}
      {documents.length > 1 && (
        <ScopePicker id="cards-scope" label="Deck for" documents={documents} value={documentId} onChange={(id) => setParam('document', id)} />
      )}
    </div>
    </>
  );

  if (loading) return <PageLoader />;
  if (generating) return <PageLoader label="Writing flashcards from your documents…" />;

  if (flashcards.length === 0) {
    return (
      <>
        {pickers}
        <div className="card">
          <EmptyState
            icon={Layers}
            title={topicId ? `No flashcards for “${topicTitles[topicId] || 'this topic'}” yet` : 'No flashcards yet'}
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
      {pickers}
      {missing.length > 0 && (
        <div className="mx-auto mb-6 max-w-2xl">
          <StaleNotice what="deck" documents={missing} onRegenerate={generate} />
        </div>
      )}
      <FlashcardDeck flashcards={cards} onRate={rate} schedule={schedule} />
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

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CircleCheck, Repeat } from 'lucide-react';
import { errorMessage, flashcardsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import ProjectLayout from '../components/projects/ProjectLayout';
import PracticeNav from '../components/projects/PracticeNav';
import TopicPicker, { useTopics } from '../components/projects/TopicPicker';
import Flashcard from '../components/flashcards/Flashcard';
import { RatingBar } from '../components/flashcards/FlashcardDeck';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';
import { RATINGS, cardPayload } from '../utils/progress';

/** Go through the flashcards that are due now. A card rated "Again" comes back at the end of the session. */
const Review = ({ projectId }) => {
  const { addNotification } = useApp();
  const [params, setParams] = useSearchParams();
  const { topics, titles: topicTitles, loaded: topicsLoaded } = useTopics(projectId);
  const wantedTopic = params.get('topic') || '';
  const topicId = !topicsLoaded || topicTitles[wantedTopic] ? wantedTopic : '';
  const [queue, setQueue] = useState([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ratings, setRatings] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await flashcardsAPI.due(projectId, topicId || null);
      setQueue(res.data.cards || []);
      setTotal((res.data.cards || []).length);
      setDone(0);
      setShowAnswer(false);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load cards to review', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [projectId, topicId, addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const card = queue[0];

  const rate = useCallback(
    async (rating) => {
      if (!card || saving) return;
      setSaving(true);
      try {
        await flashcardsAPI.review(projectId, cardPayload(card), rating, card.document_id);
        setQueue((prev) => (rating === 'again' ? [...prev.slice(1), prev[0]] : prev.slice(1)));
        if (rating !== 'again') setDone((n) => n + 1);
        setShowAnswer(false);
        setRatings((n) => n + 1);
      } catch (error) {
        addNotification({ type: 'error', title: 'Could not save your rating', message: errorMessage(error) });
      } finally {
        setSaving(false);
      }
    },
    [card, saving, projectId, addNotification]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || !card) return;
      if (e.key === ' ') {
        e.preventDefault();
        setShowAnswer((s) => !s);
      } else if (showAnswer) {
        const match = RATINGS.find((r) => r.key === e.key);
        if (match) rate(match.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, showAnswer, rate]);

  const header = (
    <>
      <PracticeNav projectId={projectId} refreshKey={ratings} />
      {topicsLoaded && topics.length > 0 && (
        <div className="mx-auto mb-6 max-w-2xl">
          <TopicPicker
            id="review-topic"
            label="Review cards from"
            projectId={projectId}
            topics={topics}
            value={topicId}
            onChange={(id) => setParams(id ? { topic: id } : {}, { replace: true })}
          />
        </div>
      )}
    </>
  );

  if (loading) return <PageLoader />;

  if (!card) {
    const finished = total > 0;
    return (
      <>
        {header}
        <div className="card mx-auto max-w-2xl">
          <EmptyState
            icon={finished ? CircleCheck : Repeat}
            title={finished ? `Review done: ${done} ${done === 1 ? 'card' : 'cards'}` : 'Nothing to review right now'}
            description={
              finished
                ? 'Each card is scheduled to come back just before you would forget it.'
                : 'Cards show up here when they are due. Rate cards in Flashcards to start their schedule: the better you know one, the later it returns.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to={`/projects/${projectId}`} className="btn btn-primary">Back to overview</Link>
                <Link to={`/projects/${projectId}/flashcards${topicId ? `?topic=${topicId}` : ''}`} className="btn btn-secondary">
                  {finished ? 'Study more cards' : 'Go to flashcards'}
                </Link>
              </div>
            }
          />
        </div>
      </>
    );
  }

  const shown = { ...card, topic_title: topicTitles[card.topic_id] || null };
  return (
    <>
      {header}
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-medium tabular-nums">
            {done}
            <span className="muted font-normal"> / {total} reviewed</span>
          </span>
          <span className="muted text-xs">{queue.length} left</span>
        </div>
        <div className="progress-track mb-5">
          <div className="progress-bar" style={{ width: `${total ? (100 * done) / total : 0}%` }} />
        </div>

        <Flashcard card={shown} showAnswer={showAnswer} onFlip={() => setShowAnswer((s) => !s)} />

        <div className="mt-5">
          {showAnswer ? (
            <>
              <p className="muted mb-2 text-center text-xs">How well did you know it?</p>
              <RatingBar onRate={rate} disabled={saving} />
            </>
          ) : (
            <div className="text-center">
              <button type="button" onClick={() => setShowAnswer(true)} className="btn btn-primary px-8">Show answer</button>
            </div>
          )}
          <p className="muted mt-4 text-center text-xs">Space to flip · 1–4 to rate</p>
        </div>
      </div>
    </>
  );
};

const ReviewPage = () => {
  const { projectId } = useParams();
  return <ProjectLayout>{() => <Review projectId={projectId} />}</ProjectLayout>;
};

export default ReviewPage;

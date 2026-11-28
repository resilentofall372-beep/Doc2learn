// Shared helpers for topic progress: routes for each study step, status labels, next-step actions,
// and flashcard ratings.
import { toTime } from './time';

/** How a learner rates a flashcard after flipping it (keys 1-4). */
export const RATINGS = [
  { value: 'again', label: 'Again', hint: 'Forgot it', key: '1', className: 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-500/10' },
  { value: 'hard', label: 'Hard', hint: 'Struggled', key: '2', className: 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-300 dark:hover:bg-amber-500/10' },
  { value: 'good', label: 'Good', hint: 'Got it', key: '3', className: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10' },
  { value: 'easy', label: 'Easy', hint: 'Too easy', key: '4', className: 'border-primary-200 text-primary-700 hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-300 dark:hover:bg-primary-500/10' },
];

/** "in 10 min", "tomorrow", "in 3 days" for a due date. */
export const dueLabel = (iso) => {
  if (!iso) return '';
  const ms = toTime(iso) - Date.now();
  if (ms <= 0) return 'now';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `in ${Math.max(1, minutes)} min`;
  const days = Math.round(ms / 86400000);
  if (days <= 1) return 'tomorrow';
  return `in ${days} days`;
};

/** Routes for the Learn -> Practice -> Review -> Test loop of one topic. */
export const topicRoutes = (projectId, topic) => {
  const base = `/projects/${projectId}`;
  return {
    learn: `${base}/learn?tool=explain&concept=${encodeURIComponent(topic.title)}&topic=${topic.id}`,
    practice: `${base}/flashcards?topic=${topic.id}`,
    review: `${base}/review?topic=${topic.id}`,
    test: `${base}/quiz?topic=${topic.id}`,
  };
};

/** The fields of a flashcard the review API stores. */
export const cardPayload = (card) => ({
  id: card.id,
  front: card.front,
  back: card.back,
  topic_id: card.topic_id || null,
  source_document: card.source_document || null,
  source_page: card.source_page ?? null,
  source_section: card.source_section || null,
});

/** A generated item's {source_document, source_page, source_section} as a source for SourceChips. */
export const itemSource = (item) =>
  item?.source_document
    ? { ...item.source_document, page: item.source_page ?? null, section: item.source_section || null }
    : item?.source_page
      ? { page: item.source_page }
      : null;

export const STATUS = {
  not_started: { label: 'Not started', badge: 'badge-neutral', bar: 'bg-zinc-300 dark:bg-zinc-600', dot: 'bg-zinc-300 dark:bg-zinc-600' },
  learning: { label: 'Learning', badge: 'badge-primary', bar: 'bg-primary-500', dot: 'bg-primary-500' },
  review_due: { label: 'Review due', badge: 'badge-warning', bar: 'bg-amber-500', dot: 'bg-amber-500' },
  mastered: { label: 'Mastered', badge: 'badge-success', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
};

/**
 * Buttons for a next step from the API: [{ label, to }] (links) or [{ label, action }]
 * where action is 'add_documents' (the caller opens the upload dialog). First is primary.
 */
export const nextStepActions = (projectId, step) => {
  const base = `/projects/${projectId}`;
  const topic = step.topic_id ? { id: step.topic_id, title: step.topic_title || '' } : null;
  const routes = topic ? topicRoutes(projectId, topic) : null;
  switch (step.kind) {
    case 'add_documents':
      return [{ label: 'Add documents', action: 'add_documents' }];
    case 'build_outline':
      return [{ label: 'Build outline', to: `${base}/topics` }];
    case 'update_outline':
      return [{ label: 'Update outline', to: `${base}/topics` }];
    case 'review':
      return [{ label: 'Start review', to: `${base}/review` }];
    case 'strengthen':
      return [
        { label: 'Re-learn it', to: routes.learn },
        { label: 'Take a quiz', to: routes.test },
      ];
    case 'start_topic':
      return [
        { label: 'Learn it', to: routes.learn },
        { label: 'Make flashcards', to: routes.practice },
      ];
    case 'test_topic':
      return [{ label: 'Take a quiz', to: routes.test }];
    case 'all_mastered':
      return [{ label: 'Mixed hard quiz', to: `${base}/quiz?difficulty=hard` }];
    default:
      return [{ label: 'Open project', to: base }];
  }
};

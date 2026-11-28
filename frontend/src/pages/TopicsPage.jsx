import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, FilePlus, Layers, ListChecks, ListTree, Merge, Pencil, Plus, RotateCw, Sparkles, Trash2 } from 'lucide-react';
import { topicsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useTask } from '../hooks/useTask';
import StaleNotice from '../components/projects/StaleNotice';
import ProjectLayout from '../components/projects/ProjectLayout';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner, { PageLoader } from '../components/common/LoadingSpinner';
import { sourceLabel } from '../components/ui/RichText';
import { timeAgo } from '../utils/time';

let draftKey = 0;

const toDraft = (topic) => ({
  key: ++draftKey,
  id: topic.id,
  title: topic.title,
  summary: topic.summary || '',
  subtopics: (topic.subtopics || []).join(', '),
  sources: topic.sources || [],
});

const fromDraft = (draft) => ({
  ...(draft.id ? { id: draft.id } : {}),
  title: draft.title.trim(),
  summary: draft.summary.trim(),
  subtopics: draft.subtopics.split(',').map((s) => s.trim()).filter(Boolean),
  sources: draft.sources,
});

const uniqueSources = (sources) => {
  const seen = new Set();
  return sources.filter((s) => {
    const key = `${s.document_id}:${s.page ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const TopicSources = ({ sources }) => {
  if (!sources?.length) return null;
  const labels = uniqueSources(sources).map((s) => sourceLabel({ filename: s.filename, page: s.page, section: s.section }));
  return <p className="muted mt-2 truncate text-xs" title={labels.join('; ')}>From {labels.join('; ')}</p>;
};

/** One topic in view mode. */
const TopicRow = ({ topic, index, projectId }) => (
  <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
    <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-primary-50 text-xs font-semibold text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
      {index + 1}
    </span>
    <div className="min-w-0 flex-1">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{topic.title}</h3>
      {topic.summary && <p className="muted mt-0.5 text-sm">{topic.summary}</p>}
      {topic.subtopics?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {topic.subtopics.map((sub) => (
            <span key={sub} className="badge badge-neutral font-normal">{sub}</span>
          ))}
        </div>
      )}
      <TopicSources sources={topic.sources} />
    </div>
    <div className="flex flex-shrink-0 gap-1 pl-10 sm:pl-0">
      <Link to={`/projects/${projectId}/quiz?topic=${topic.id}`} className="btn btn-secondary btn-sm">
        <ListChecks className="h-3.5 w-3.5" />
        Quiz
      </Link>
      <Link to={`/projects/${projectId}/flashcards?topic=${topic.id}`} className="btn btn-secondary btn-sm">
        <Layers className="h-3.5 w-3.5" />
        Flashcards
      </Link>
    </div>
  </li>
);

/** One topic in edit mode. */
const TopicEditor = ({ draft, index, count, onChange, onMove, onMerge, onRemove }) => (
  <li className="flex gap-3 px-5 py-4">
    <span className="mt-2 grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {index + 1}
    </span>
    <div className="min-w-0 flex-1 space-y-2">
      <input
        value={draft.title}
        onChange={(e) => onChange({ title: e.target.value })}
        maxLength={80}
        placeholder="Topic title"
        aria-label={`Title of topic ${index + 1}`}
        className="input font-medium"
      />
      <input
        value={draft.summary}
        onChange={(e) => onChange({ summary: e.target.value })}
        maxLength={300}
        placeholder="One-line summary (optional)"
        aria-label={`Summary of topic ${index + 1}`}
        className="input"
      />
      <input
        value={draft.subtopics}
        onChange={(e) => onChange({ subtopics: e.target.value })}
        placeholder="Key ideas, separated by commas"
        aria-label={`Key ideas of topic ${index + 1}`}
        className="input"
      />
      <TopicSources sources={draft.sources} />
    </div>
    <div className="flex flex-shrink-0 flex-col gap-1">
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="btn btn-ghost btn-icon" aria-label="Move up" title="Move up">
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className="btn btn-ghost btn-icon" aria-label="Move down" title="Move down">
        <ArrowDown className="h-4 w-4" />
      </button>
      <button type="button" onClick={onMerge} disabled={index === 0} className="btn btn-ghost btn-icon" aria-label="Merge into the topic above" title="Merge into the topic above">
        <Merge className="h-4 w-4" />
      </button>
      <button type="button" onClick={onRemove} className="btn btn-danger btn-icon" aria-label="Delete topic" title="Delete topic">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  </li>
);

const Outline = ({ projectId, documents, addDocuments }) => {
  const { addNotification } = useApp();
  const run = useTask();
  const [state, setState] = useState({ outline: null, pending: [] });
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(null); // null | 'build' | 'update' | 'rebuild' | 'save'
  const [drafts, setDrafts] = useState(null); // non-null while editing

  const apply = (data) => setState({ outline: data.outline, pending: data.pending_documents || [] });

  // No spinner on reloads: only the first load shows one.
  const load = useCallback(async () => {
    await run('Could not load topics', async () => {
      const { data } = await topicsAPI.get(projectId);
      setState({ outline: data.outline, pending: data.pending_documents || [] });
    });
    setLoading(false);
  }, [projectId, run]);

  // Reload when documents are added or removed, so "new documents" stays accurate.
  useEffect(() => {
    load();
  }, [load, documents.length]);

  const build = async (mode) => {
    if (mode === 'rebuild' && !window.confirm('Rebuild the outline from every document? Your edits are replaced, and quizzes and flashcards made for the old topics lose their topic labels.')) return;
    setWorking(mode === 'rebuild' ? 'rebuild' : state.outline ? 'update' : 'build');
    await run('Could not build the outline', async () => {
      apply((await topicsAPI.build(projectId, mode)).data);
      setDrafts(null);
    });
    setWorking(null);
  };

  const save = async () => {
    const topics = drafts.map(fromDraft);
    if (topics.some((t) => !t.title)) {
      addNotification({ type: 'error', title: 'Missing title', message: 'Every topic needs a title.' });
      return;
    }
    setWorking('save');
    await run('Could not save the outline', async () => {
      apply((await topicsAPI.save(projectId, topics)).data);
      setDrafts(null);
      addNotification({ type: 'success', title: 'Outline saved' });
    });
    setWorking(null);
  };

  const changeDraft = (i, patch) => setDrafts((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const moveDraft = (i, delta) =>
    setDrafts((prev) => {
      const next = [...prev];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
  const mergeDraft = (i) =>
    setDrafts((prev) => {
      const [above, current] = [prev[i - 1], prev[i]];
      const subs = [above.subtopics, current.title, current.subtopics].map((s) => s.trim()).filter(Boolean).join(', ');
      const merged = { ...above, subtopics: subs, sources: uniqueSources([...above.sources, ...current.sources]) };
      return prev.map((d, j) => (j === i - 1 ? merged : d)).filter((_, j) => j !== i);
    });

  if (loading) return <PageLoader />;
  if (working === 'build') return <PageLoader label="Reading your documents and splitting them into topics…" />;

  const { outline, pending } = state;

  if (!outline) {
    return (
      <div className="card">
        <EmptyState
          icon={ListTree}
          title="No topic outline yet"
          description="Doc2Learn reads your documents and splits them into topics in a sensible learning order. Each topic gets its own quiz and flashcards, and you can edit the outline any time."
          action={
            <button type="button" onClick={() => build('update')} className="btn btn-primary">
              <Sparkles className="h-4 w-4" />
              Build outline
            </button>
          }
        />
      </div>
    );
  }

  const editing = drafts !== null;
  const topics = outline.topics || [];

  return (
    <div className="space-y-6">
      {pending.length > 0 && !editing && (
        <StaleNotice
          documents={pending}
          title={`${pending.length === 1 ? '1 new document is' : `${pending.length} new documents are`} not in the outline yet`}
          action={
            <button type="button" onClick={() => build('update')} disabled={Boolean(working)} className="btn btn-primary btn-sm flex-shrink-0">
              {working === 'update' ? <LoadingSpinner size="small" /> : <Plus className="h-3.5 w-3.5" />}
              {working === 'update' ? 'Adding…' : 'Add to outline'}
            </button>
          }
        />
      )}

      <section className="card">
        <div className="card-header flex-wrap">
          <div>
            <h2 className="card-title">Topic outline</h2>
            <p className="muted mt-0.5 text-xs">
              {topics.length} {topics.length === 1 ? 'topic' : 'topics'} · updated {timeAgo(outline.updated_at)}
              {editing ? ' · editing' : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <button type="button" onClick={() => setDrafts(null)} disabled={working === 'save'} className="btn btn-ghost btn-sm">Cancel</button>
                <button type="button" onClick={save} disabled={working === 'save'} className="btn btn-primary btn-sm">
                  {working === 'save' && <LoadingSpinner size="small" />}
                  Save outline
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={addDocuments} className="btn btn-ghost btn-sm">
                  <FilePlus className="h-3.5 w-3.5" />
                  Add documents
                </button>
                <button type="button" onClick={() => build('rebuild')} disabled={Boolean(working)} className="btn btn-ghost btn-sm">
                  {working === 'rebuild' ? <LoadingSpinner size="small" /> : <RotateCw className="h-3.5 w-3.5" />}
                  {working === 'rebuild' ? 'Rebuilding…' : 'Rebuild'}
                </button>
                <button type="button" onClick={() => setDrafts(topics.map(toDraft))} disabled={Boolean(working)} className="btn btn-secondary btn-sm">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </>
            )}
          </div>
        </div>

        {editing ? (
          <>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {drafts.map((draft, i) => (
                <TopicEditor
                  key={draft.key}
                  draft={draft}
                  index={i}
                  count={drafts.length}
                  onChange={(patch) => changeDraft(i, patch)}
                  onMove={(delta) => moveDraft(i, delta)}
                  onMerge={() => mergeDraft(i)}
                  onRemove={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </ul>
            <div className="border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setDrafts((prev) => [...prev, { key: ++draftKey, title: '', summary: '', subtopics: '', sources: [] }])}
                className="btn btn-ghost btn-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Add topic
              </button>
            </div>
          </>
        ) : topics.length === 0 ? (
          <EmptyState icon={ListTree} title="The outline is empty" description="Add topics by hand with Edit, or rebuild it from your documents." />
        ) : (
          <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {topics.map((topic, i) => (
              <TopicRow key={topic.id} topic={topic} index={i} projectId={projectId} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};

const TopicsPage = () => {
  const { projectId } = useParams();
  return (
    <ProjectLayout>
      {({ documents, addDocuments }) => <Outline projectId={projectId} documents={documents} addDocuments={addDocuments} />}
    </ProjectLayout>
  );
};

export default TopicsPage;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronRight, Copy, History, Layers, Lightbulb, ListChecks, PenLine, RotateCw, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { assistantAPI, errorMessage } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import Dialog from '../ui/Dialog';
import RichText, { sourceLabel } from '../ui/RichText';
import Segmented from '../ui/Segmented';
import ScopePicker from '../projects/ScopePicker';
import { useTopics } from '../../hooks/useTopics';
import { timeAgo } from '../../utils/time';
import { topicRoutes } from '../../utils/progress';

/**
 * Each tool: what it asks for, how it calls the API, and a short label for its result.
 * `options` are the tool's defaults; the dialog edits a copy.
 */
const TOOLS = [
  {
    id: 'explain',
    name: 'Explain a concept',
    description: 'Definition, plain explanation, example and a common mistake',
    icon: Lightbulb,
    options: { text: '' },
    required: true,
    size: 'xl',
    // With a topic the explanation is saved to it and the topic's Learn step is ticked.
    run: (projectId, docId, o) => assistantAPI.explainConcept(projectId, docId, o.text, o.topicId),
    label: (o) => o.text,
  },
  {
    id: 'practice',
    name: 'Written practice',
    description: 'Open questions to answer in your own words, with hints and model answers',
    icon: PenLine,
    options: { text: '', count: 5 },
    run: (projectId, docId, o) => assistantAPI.generatePractice(projectId, docId, o.text || 'general', o.count),
    label: (o) => `${o.count} problems${o.text ? ` · ${o.text}` : ''}`,
  },
];

const toolById = Object.fromEntries(TOOLS.map((t) => [t.id, t]));

// --------------------------------------------------------------------------- results
const Sources = ({ sources }) =>
  sources?.length ? <p className="muted mt-4 border-t border-zinc-200 pt-3 text-xs dark:border-zinc-800">Sources: {sources.map(sourceLabel).join('; ')}</p> : null;

const Result = ({ type, data, projectId }) => {
  const legend = data.legend;
  if (type === 'explain') {
    const routes = data.topic_id && projectId ? topicRoutes(projectId, { id: data.topic_id, title: data.concept }) : null;
    return (
      <div>
        <RichText text={data.explanation} legend={legend} className="text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300" />
        <Sources sources={data.sources} />
        {routes && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <span className="muted mr-auto self-center text-xs">Next, check you've got it:</span>
            <Link to={routes.practice} className="btn btn-primary btn-sm">
              <Layers className="h-3.5 w-3.5" />
              Make flashcards for this
            </Link>
            <Link to={routes.test} className="btn btn-secondary btn-sm">
              <ListChecks className="h-3.5 w-3.5" />
              Quiz me on this
            </Link>
          </div>
        )}
      </div>
    );
  }
  if (type === 'practice') {
    if (!data.problems?.length) return <p className="muted text-sm">No problems came back. Try again or pick a different topic.</p>;
    return (
      <ol className="space-y-3">
        {data.problems.map((problem, idx) => (
          <li key={problem.question} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              <span className="muted mr-1.5 font-normal tabular-nums">{idx + 1}.</span>
              {problem.question}
            </p>
            <textarea rows={2} placeholder="Write your answer here before you check…" className="input mt-3 resize-y text-sm" aria-label={`Your answer to problem ${idx + 1}`} />
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {problem.hint && (
                <details className="group min-w-0 flex-1">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Show hint</summary>
                  <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">{problem.hint}</p>
                </details>
              )}
              <details className="group min-w-0 flex-1">
                <summary className="cursor-pointer text-xs font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">Check model answer</summary>
                <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{problem.answer}</p>
              </details>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return null;
};

/** Plain-text version of a result, for the Copy button. */
const asText = (type, data) => {
  if (type === 'explain') return data.explanation;
  if (type === 'practice')
    return (data.problems || []).map((p, i) => `${i + 1}. ${p.question}\nHint: ${p.hint}\nAnswer: ${p.answer}`).join('\n\n');
  return '';
};

// --------------------------------------------------------------------------- inputs
const Chips = ({ items, selected = [], onPick, label }) =>
  items.length ? (
    <div className="mt-2">
      {label && <p className="muted mb-1.5 text-xs">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const on = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPick(item)}
              aria-pressed={on}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                on
                  ? 'border-primary-600 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-500/10 dark:text-primary-200'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {item}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

const ToolFields = ({ tool, options, setOptions, topics }) => {
  const set = (patch) => setOptions((prev) => ({ ...prev, ...patch }));
  const topicTitles = topics.map((t) => t.title);
  const concepts = useMemo(() => {
    const all = topics.flatMap((t) => [t.title, ...(t.subtopics || [])]);
    return [...new Set(all)].slice(0, 14);
  }, [topics]);

  if (tool.id === 'explain') {
    return (
      <div>
        <label htmlFor="tool-concept" className="label">Concept</label>
        <input id="tool-concept" autoFocus value={options.text} onChange={(e) => set({ text: e.target.value })} maxLength={200} placeholder="e.g. photosynthesis" className="input" />
        <Chips items={concepts} selected={[options.text]} onPick={(text) => set({ text })} label="From your topic outline" />
      </div>
    );
  }
  if (tool.id === 'practice') {
    return (
      <div className="space-y-5">
        <div>
          <label htmlFor="tool-topic" className="label">
            Topic <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input id="tool-topic" value={options.text} onChange={(e) => set({ text: e.target.value })} maxLength={200} placeholder="Leave blank to cover everything" className="input" />
          <Chips items={topicTitles} selected={[options.text]} onPick={(text) => set({ text: options.text === text ? '' : text })} label="Your topics" />
        </div>
        <Segmented
          id="practice-count"
          label="How many"
          value={options.count}
          onChange={(count) => set({ count })}
          options={[3, 5, 10].map((n) => ({ value: n, label: String(n) }))}
        />
      </div>
    );
  }
  return null;
};

// --------------------------------------------------------------------------- dialog
const StudyToolDialog = ({ tool, projectId, documents, topics, initial, preset, autoRun, onClose, onResult }) => {
  const [options, setOptions] = useState(() => initial?.options || { ...tool.options, ...(preset || {}) });
  const [documentId, setDocumentId] = useState(initial?.documentId || '');
  const [result, setResult] = useState(initial || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const ready = !tool.required || options.text?.trim();

  const run = async (e) => {
    e?.preventDefault();
    if (!ready || loading) return;
    const clean = { ...options, ...(typeof options.text === 'string' ? { text: options.text.trim() } : {}) };
    if (tool.id === 'explain') {
      // Explaining an outline topic saves it to that topic (the link from Overview names the topic).
      const byTitle = topics.find((t) => t.title.toLowerCase() === clean.text.toLowerCase());
      clean.topicId = byTitle?.id || (preset?.topicId && clean.text === preset.text ? preset.topicId : undefined);
    }
    setLoading(true);
    setError(null);
    try {
      const res = await tool.run(projectId, documentId || null, clean);
      const entry = {
        id: `${Date.now()}`,
        type: tool.id,
        label: tool.label(clean),
        scope: documentId ? documents.find((d) => d._id === documentId)?.filename : 'Whole project',
        options: clean,
        documentId,
        data: res.data,
        createdAt: new Date().toISOString(),
      };
      setResult(entry);
      onResult(entry);
    } catch (err) {
      setError(errorMessage(err, 'Could not reach the model. Try again in a moment.'));
    } finally {
      setLoading(false);
    }
  };

  // "Learn it" links start generating straight away instead of waiting for a second click.
  const autoRan = useRef(false); // StrictMode runs effects twice in development
  useEffect(() => {
    if (autoRun && !initial && !autoRan.current) {
      autoRan.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(result.type, result.data));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: nothing to do */
    }
  };

  return (
    <Dialog open onClose={onClose} size={tool.size || 'lg'} icon={tool.icon} title={tool.name} description={tool.description}>
        <div>
          <form onSubmit={run} className="space-y-5 border-b border-zinc-200 p-5 dark:border-zinc-800">
            {documents.length > 1 && (
              <ScopePicker id="tool-scope" label="Use" documents={documents} value={documentId} onChange={setDocumentId} />
            )}
            <ToolFields tool={tool} options={options} setOptions={setOptions} topics={topics} />
            <div className="flex items-center justify-end gap-2">
              {result && !loading && <span className="muted mr-auto text-xs">Change the options and run it again any time.</span>}
              <button type="submit" disabled={!ready || loading} className="btn btn-primary">
                {loading ? <LoadingSpinner size="small" /> : result ? <RotateCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {loading ? 'Reading your documents…' : result ? 'Run again' : 'Generate'}
              </button>
            </div>
          </form>

          {error && (
            <div className="p-5">
              <div className="alert alert-danger">{error}</div>
            </div>
          )}

          {result && !loading && (
            <section className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">{result.label}</h3>
                  <p className="muted text-xs">{result.scope}</p>
                </div>
                <button type="button" onClick={copy} className="btn btn-secondary btn-sm flex-shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <Result type={result.type} data={result.data} projectId={projectId} />
            </section>
          )}

          {loading && (
            <div className="space-y-3 p-5" aria-hidden="true">
              {[90, 75, 82, 60].map((w) => (
                <div key={w} className="h-3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
        </div>
    </Dialog>
  );
};

// --------------------------------------------------------------------------- sidebar
/** A saved topic explanation in the shape the dialog reopens. */
const savedEntry = (row) => ({
  id: `saved-${row.topic_id}`,
  type: 'explain',
  label: row.topic_title || row.concept,
  scope: 'Saved to this topic',
  options: { text: row.concept, topicId: row.topic_id },
  documentId: '',
  data: row,
  createdAt: row.created_at,
});

/** Study tools for a project: the tools, saved topic explanations, and practice sets made this visit. */
const QuickActions = ({ projectId, documents }) => {
  const { topics } = useTopics(projectId);
  const [open, setOpen] = useState(null); // { toolId, entry?, preset?, autoRun? }
  const [recent, setRecent] = useState([]);
  const [saved, setSaved] = useState([]);
  const [params, setParams] = useSearchParams();

  const loadSaved = useCallback(() => {
    assistantAPI
      .explanations(projectId)
      .then((res) => setSaved((res.data.explanations || []).map(savedEntry)))
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  // Links like ?tool=explain&concept=Calvin%20cycle&topic=t3 (from Overview, the map or quiz results)
  // open the tool and, with a concept, start generating right away.
  useEffect(() => {
    const toolId = params.get('tool');
    if (!toolById[toolId]) return;
    const text = params.get('concept') || '';
    const topicId = params.get('topic') || undefined;
    setOpen({ toolId, preset: text ? { text, topicId } : {}, autoRun: Boolean(text) });
    setParams({}, { replace: true });
  }, [params, setParams]);

  const onResult = (entry) => {
    if (entry.type === 'explain' && entry.data.topic_id) loadSaved();
    else setRecent((prev) => [entry, ...prev].slice(0, 12));
  };

  const close = useCallback(() => setOpen(null), []);
  const openTool = open ? toolById[open.toolId] : null;

  return (
    <aside className="space-y-4">
      <section className="card">
        <div className="card-header py-3">
          <h2 className="card-title">Study tools</h2>
          <span className="muted text-xs">{documents.length === 1 ? '1 document' : `${documents.length} documents`}</span>
        </div>
        <ul className="space-y-1 p-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <li key={tool.id}>
                <button
                  type="button"
                  onClick={() => setOpen({ toolId: tool.id })}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors group-hover:border-primary-200 group-hover:text-primary-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:group-hover:border-primary-500/40 dark:group-hover:text-primary-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">{tool.name}</span>
                    <span className="muted block truncate text-xs">{tool.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 dark:text-zinc-600" />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {saved.length > 0 && (
        <section className="card">
          <div className="card-header py-3">
            <h2 className="card-title flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-zinc-400" />
              Saved explanations
            </h2>
          </div>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto p-2">
            {saved.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setOpen({ toolId: 'explain', entry })}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{entry.label}</span>
                    <span className="muted block truncate text-xs">Explained {timeAgo(entry.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="card">
          <div className="card-header py-3">
            <h2 className="card-title flex items-center gap-2">
              <History className="h-4 w-4 text-zinc-400" />
              Made this session
            </h2>
            <button type="button" onClick={() => setRecent([])} className="btn btn-ghost btn-sm -mr-2">Clear</button>
          </div>
          <ul className="max-h-72 space-y-0.5 overflow-y-auto p-2">
            {recent.map((entry) => {
              const tool = toolById[entry.type];
              const Icon = tool.icon;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setOpen({ toolId: entry.type, entry })}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0 text-zinc-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{entry.label}</span>
                      <span className="muted block truncate text-xs">
                        {tool.name} · {timeAgo(entry.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {openTool && (
        <StudyToolDialog
          key={open.entry?.id || open.toolId}
          tool={openTool}
          projectId={projectId}
          documents={documents}
          topics={topics}
          initial={open.entry}
          preset={open.preset}
          autoRun={open.autoRun}
          onClose={close}
          onResult={onResult}
        />
      )}
    </aside>
  );
};

export default QuickActions;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Layers, Lightbulb, ListChecks, MousePointerClick, Network, RefreshCw, Repeat } from 'lucide-react';
import { assistantAPI, errorMessage, mindmapAPI, projectAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import ProjectLayout from '../components/projects/ProjectLayout';
import ScopePicker from '../components/projects/ScopePicker';
import MindMapCanvas, { normaliseMap } from '../components/mindmap/MindMapCanvas';
import StaleNotice from '../components/projects/StaleNotice';
import EmptyState from '../components/ui/EmptyState';
import RichText from '../components/ui/RichText';
import LoadingSpinner, { PageLoader } from '../components/common/LoadingSpinner';
import { newerDocuments, timeAgo } from '../utils/time';
import { STATUS, topicRoutes } from '../utils/progress';

// --------------------------------------------------------------------------- detail panel
const Explain = ({ projectId, documentId, concept }) => {
  const [state, setState] = useState({ loading: false, data: null, error: null });

  useEffect(() => setState({ loading: false, data: null, error: null }), [concept]);

  const run = async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const res = await assistantAPI.explainConcept(projectId, documentId || null, concept);
      setState({ loading: false, data: res.data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: errorMessage(error) });
    }
  };

  if (state.data) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/60">
        <RichText text={state.data.explanation} legend={state.data.legend} className="text-sm text-zinc-700 dark:text-zinc-300" />
      </div>
    );
  }
  return (
    <div>
      {state.error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="button" onClick={run} disabled={state.loading} className="btn btn-primary btn-sm w-full">
        {state.loading ? <LoadingSpinner size="small" /> : <Lightbulb className="h-3.5 w-3.5" />}
        {state.loading ? 'Reading your documents…' : 'Explain this from my documents'}
      </button>
    </div>
  );
};

const TopicActions = ({ projectId, branch, progress }) => {
  if (!branch.topicId) {
    return (
      <Link to={`/projects/${projectId}/learn?tool=explain&concept=${encodeURIComponent(branch.topic)}`} className="btn btn-secondary btn-sm w-full">
        <BookOpen className="h-3.5 w-3.5" />
        Learn it with the tutor
      </Link>
    );
  }
  const routes = topicRoutes(projectId, { id: branch.topicId, title: branch.topic });
  const status = progress ? STATUS[progress.status] : null;
  return (
    <div className="space-y-3">
      {progress && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className={`badge ${status.badge}`}>{status.label}</span>
            <span className="font-medium tabular-nums">{progress.mastery == null ? 'Not started' : `${progress.mastery}% mastery`}</span>
          </div>
          <div className="progress-track">
            <div className={`h-full rounded-full ${status.bar}`} style={{ width: `${progress.mastery ?? 0}%` }} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Link to={routes.learn} className="btn btn-secondary btn-sm"><BookOpen className="h-3.5 w-3.5" />Learn</Link>
        <Link to={routes.practice} className="btn btn-secondary btn-sm"><Layers className="h-3.5 w-3.5" />Flashcards</Link>
        <Link to={routes.test} className="btn btn-secondary btn-sm"><ListChecks className="h-3.5 w-3.5" />Quiz</Link>
        <Link to={routes.review} className={`btn btn-secondary btn-sm ${progress?.cards?.due ? '' : 'pointer-events-none opacity-50'}`}>
          <Repeat className="h-3.5 w-3.5" />Review{progress?.cards?.due ? ` (${progress.cards.due})` : ''}
        </Link>
      </div>
    </div>
  );
};

const DetailPanel = ({ projectId, documentId, map, selected, onSelect, progressFor }) => {
  if (!selected) {
    return (
      <div className="p-5">
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <MousePointerClick className="h-4 w-4" />
        </div>
        <p className="text-sm font-semibold">Click any node</p>
        <p className="muted mt-1 text-sm">See what it means, how it connects, and jump straight to learning or testing it.</p>
        <p className="eyebrow mt-6">Topics</p>
        <ul className="mt-2 space-y-1">
          {map.branches.map((b) => {
            const progress = progressFor?.(b);
            return (
              <li key={b.id}>
                <button type="button" onClick={() => onSelect({ type: 'branch', branchId: b.id })} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${b.color.chip}`} />
                  <span className="min-w-0 flex-1 truncate">{b.topic}</span>
                  {progress?.mastery != null && <span className="muted text-xs tabular-nums">{progress.mastery}%</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (selected.type === 'center') {
    const concepts = map.branches.reduce((n, b) => n + b.concepts.length, 0);
    return (
      <div className="p-5">
        <p className="eyebrow">Central idea</p>
        <h3 className="mt-1 text-base font-semibold">{map.central}</h3>
        <p className="muted mt-1 text-sm">
          {map.branches.length} topics · {concepts} concepts{map.links.length ? ` · ${map.links.length} cross-links` : ''}
        </p>
        <div className="mt-4">
          <Explain projectId={projectId} documentId={documentId} concept={map.central} />
        </div>
      </div>
    );
  }

  const branch = map.branches.find((b) => b.id === selected.branchId);
  if (!branch) return null;

  if (selected.type === 'branch') {
    return (
      <div className="space-y-5 p-5">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${branch.color.chip}`} />Topic</p>
          <h3 className="mt-1 text-base font-semibold">{branch.topic}</h3>
          {branch.note && <p className="muted mt-1 text-sm">{branch.note}</p>}
        </div>
        <TopicActions projectId={projectId} branch={branch} progress={progressFor?.(branch)} />
        {branch.concepts.length > 0 && (
          <div>
            <p className="eyebrow">Concepts</p>
            <ul className="mt-2 space-y-1">
              {branch.concepts.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onSelect({ type: 'concept', branchId: branch.id, conceptId: c.id })} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <span className="block text-sm font-medium">{c.label}</span>
                    {c.note && <span className="muted block text-xs">{c.note}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const concept = branch.concepts.find((c) => c.id === selected.conceptId);
  if (!concept) return null;
  const related = map.links
    .filter((l) => l.from.id === concept.id || l.to.id === concept.id)
    .map((l) => ({ other: l.from.id === concept.id ? l.to : l.from, label: l.label, outgoing: l.from.id === concept.id }));

  return (
    <div className="space-y-5 p-5">
      <div>
        <button type="button" onClick={() => onSelect({ type: 'branch', branchId: branch.id })} className="eyebrow flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100">
          <span className={`h-2 w-2 rounded-full ${branch.color.chip}`} />
          {branch.topic}
        </button>
        <h3 className="mt-1 text-base font-semibold">{concept.label}</h3>
        {concept.note && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{concept.note}</p>}
      </div>
      <Explain projectId={projectId} documentId={documentId} concept={concept.label} />
      {related.length > 0 && (
        <div>
          <p className="eyebrow">Connected to</p>
          <ul className="mt-2 space-y-1">
            {related.map(({ other, label, outgoing }) => (
              <li key={other.id}>
                <button type="button" onClick={() => onSelect({ type: 'concept', branchId: other.branchId, conceptId: other.id })} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <span className="muted text-xs italic">{outgoing ? label : `${label} ←`}</span>
                  <ArrowRight className="h-3 w-3 text-zinc-400" />
                  <span className="truncate font-medium">{other.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="eyebrow mb-2">Study the topic</p>
        <TopicActions projectId={projectId} branch={branch} progress={progressFor?.(branch)} />
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------- page
const ConceptMap = ({ projectId, documents }) => {
  const { addNotification } = useApp();
  const [params, setParams] = useSearchParams();
  const wanted = params.get('document');
  const documentId = documents.some((d) => d._id === wanted) ? wanted : '';
  const [mindmap, setMindmap] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [topicProgress, setTopicProgress] = useState([]);
  const [hasOutline, setHasOutline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;
    projectAPI
      .overview(projectId)
      .then((res) => {
        if (!alive) return;
        setTopicProgress(res.data.topics || []);
        setHasOutline(Boolean(res.data.has_outline));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId]);

  const setDocumentId = (id) => setParams(id ? { document: id } : {}, { replace: true });

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    try {
      const res = await mindmapAPI.getMindmap(projectId, documentId || null);
      setMindmap(res.data.mindmap);
      setGeneratedAt(res.data.generated_at || null);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load concept map', message: errorMessage(error) });
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
      const res = await mindmapAPI.generate({ projectId, documentId: documentId || null });
      setMindmap(res.data.mindmap);
      setGeneratedAt(res.data.generated_at || new Date().toISOString());
      setSelected(null);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not generate concept map', message: errorMessage(error) });
    } finally {
      setGenerating(false);
    }
  };

  const map = useMemo(() => (mindmap ? normaliseMap(mindmap) : null), [mindmap]);

  // Branches made from the outline carry a topic id; older maps fall back to matching titles.
  const progressFor = useMemo(() => {
    if (!topicProgress.length) return null;
    const norm = (s = '') => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const byId = new Map(topicProgress.map((t) => [t.id, t]));
    return (branch) => {
      if (branch.topicId && byId.has(branch.topicId)) return byId.get(branch.topicId);
      const key = norm(branch.topic);
      if (!key) return null;
      return topicProgress.find((t) => norm(t.title) === key) || topicProgress.find((t) => norm(t.title).includes(key) || key.includes(norm(t.title))) || null;
    };
  }, [topicProgress]);

  const picker =
    documents.length > 1 ? (
      <div className="w-full max-w-xs">
        <ScopePicker id="map-scope" label="Map of" documents={documents} value={documentId} onChange={setDocumentId} />
      </div>
    ) : null;

  if (loading) return <PageLoader />;
  if (generating && !map) return <PageLoader label="Reading your documents and mapping the ideas…" />;

  if (!map) {
    return (
      <div className="space-y-6">
        {picker}
        <div className="card">
          <EmptyState
            icon={Network}
            title="No concept map yet"
            description={
              hasOutline || documentId
                ? 'See how the ideas in your documents connect: topics, their key concepts, and the links between them.'
                : 'Tip: build the topic outline first (Overview) so the map’s branches match your topics and show your progress.'
            }
            action={
              <button type="button" onClick={generate} disabled={generating} className="btn btn-primary">
                {generating ? <LoadingSpinner size="small" /> : <Network className="h-4 w-4" />}
                Build concept map
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const missing = documentId ? [] : newerDocuments(documents, generatedAt);
  const outdatedFormat = !documentId && hasOutline && !mindmap.branches?.some((b) => b.topic_id);

  return (
    <div className="space-y-4">
      {picker}
      {missing.length > 0 && <StaleNotice what="map" documents={missing} onRegenerate={generate} busy={generating} />}
      {outdatedFormat && missing.length === 0 && (
        <div className="alert alert-info items-center">
          <span className="flex-1">This map was made before your topic outline. Rebuild it so its branches match your topics and show progress.</span>
          <button type="button" onClick={generate} disabled={generating} className="btn btn-secondary btn-sm">Rebuild</button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card overflow-hidden">
          <div className="card-header py-3">
            <div className="min-w-0">
              <h2 className="card-title truncate">{map.central}</h2>
              <p className="muted text-xs">
                {map.branches.length} topics · {map.branches.reduce((n, b) => n + b.concepts.length, 0)} concepts
                {generatedAt ? ` · made ${timeAgo(generatedAt)}` : ''}
              </p>
            </div>
            <button type="button" onClick={generate} disabled={generating} className="btn btn-ghost btn-sm -mr-2">
              {generating ? <LoadingSpinner size="small" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {generating ? 'Rebuilding…' : 'Rebuild'}
            </button>
          </div>
          <MindMapCanvas map={map} progressFor={progressFor} selected={selected} onSelect={setSelected} />
        </section>

        <aside className="card xl:max-h-[720px] xl:overflow-y-auto">
          <DetailPanel projectId={projectId} documentId={documentId} map={map} selected={selected} onSelect={setSelected} progressFor={progressFor} />
        </aside>
      </div>
    </div>
  );
};

const MindMapPage = () => {
  const { projectId } = useParams();
  return <ProjectLayout>{({ documents }) => <ConceptMap projectId={projectId} documents={documents} />}</ProjectLayout>;
};

export default MindMapPage;

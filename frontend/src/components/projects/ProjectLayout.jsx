import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, FolderOpen, Plus, Radio, Upload } from 'lucide-react';
import { errorMessage, projectAPI } from '../../services/api';
import { projectStore } from '../../services/projectStore';
import EmptyState from '../ui/EmptyState';
import AddDocumentsDialog from '../document/AddDocumentsDialog';
import { SECTIONS, sectionFor } from './sections';

export const forgetProject = (projectId) => projectStore.forget(projectId);

/** Grey outline of the page header and content while the project loads. */
const LayoutSkeleton = () => (
  <div aria-busy="true" aria-label="Loading project">
    <div className="mb-6 space-y-2">
      <div className="skeleton h-3 w-40" />
      <div className="skeleton h-7 w-64" />
      <div className="skeleton h-4 w-96 max-w-full" />
    </div>
    <div className="card h-64" />
  </div>
);

/** Section tabs for small screens (on large screens the sidebar shows them). */
const MobileSections = ({ base, current }) => (
  <nav className="no-scrollbar -mx-4 mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 px-4 dark:border-zinc-800 lg:hidden" aria-label="Project sections">
    {SECTIONS.map((section) => {
      const Icon = section.icon;
      const active = current.key === section.key;
      return (
        <Link
          key={section.key}
          to={`${base}${section.path}`}
          aria-current={active ? 'page' : undefined}
          className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
            active ? 'border-primary-600 text-zinc-900 dark:border-primary-400 dark:text-zinc-50' : 'border-transparent text-zinc-500 dark:text-zinc-400'
          }`}
        >
          <Icon className="h-4 w-4" />
          {section.label}
        </Link>
      );
    })}
  </nav>
);

/**
 * The frame of every page inside a project: loads the project, shows the page header
 * (breadcrumb, title, description, actions) and the "Add documents" dialog.
 * `children` may be a node, or a function receiving
 * { project, documents, setDocuments, refresh, addDocuments }.
 * Study pages (needsDocuments) ask for a document first when the project is empty.
 */
const ProjectLayout = ({ children, needsDocuments = true, actions = null }) => {
  const { projectId } = useParams();
  const { pathname } = useLocation();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(() => projectStore.get(projectId));
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const save = useCallback(
    (next) => {
      projectStore.set(projectId, next);
      setData(next);
    },
    [projectId]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await projectAPI.get(projectId);
      save({ project: res.data.project, documents: res.data.documents || [] });
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not open this project'));
    }
  }, [projectId, save]);

  useEffect(() => {
    setData(projectStore.get(projectId));
    refresh();
  }, [projectId, refresh]);

  // The sidebar's "Add documents" links here with ?add=1.
  useEffect(() => {
    if (params.get('add') === '1') {
      setAdding(true);
      const next = new URLSearchParams(params);
      next.delete('add');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const setDocuments = useCallback(
    (update) => {
      setData((prev) => {
        if (!prev) return prev;
        const documents = typeof update === 'function' ? update(prev.documents) : update;
        const next = { project: { ...prev.project, document_count: documents.length }, documents };
        projectStore.set(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  const addDocuments = useCallback(() => setAdding(true), []);
  const closeAdding = useCallback(() => setAdding(false), []);
  const appendDocument = useCallback((doc) => setDocuments((prev) => [...prev, doc]), [setDocuments]);

  if (error && !data) {
    return (
      <div className="card">
        <EmptyState
          icon={FolderOpen}
          title="Project not found"
          description="It may have been deleted, or it belongs to another account."
          action={<Link to="/projects" className="btn btn-secondary">Back to projects</Link>}
        />
      </div>
    );
  }
  if (!data) return <LayoutSkeleton />;

  const { project, documents } = data;
  const base = `/projects/${projectId}`;
  const { section, page } = sectionFor(pathname.slice(base.length));
  const empty = needsDocuments && documents.length === 0;

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <nav className="muted mb-1.5 flex min-w-0 items-center gap-1 text-xs" aria-label="Breadcrumb">
            <Link to="/projects" className="hover:text-zinc-900 dark:hover:text-zinc-100">Projects</Link>
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
            <Link to={base} className="truncate hover:text-zinc-900 dark:hover:text-zinc-100" title={project.name}>{project.name}</Link>
            {page.title !== 'Overview' && (
              <>
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                {page.child || page.title !== section.title ? (
                  <>
                    <Link to={`${base}${section.path}`} className="hover:text-zinc-900 dark:hover:text-zinc-100">{section.label}</Link>
                    <ChevronRight className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{page.title}</span>
                  </>
                ) : (
                  <span className="truncate">{section.label}</span>
                )}
              </>
            )}
          </nav>
          <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {page.title === 'Overview' ? project.name : page.title}
          </h1>
          <p className="muted mt-1 max-w-2xl text-sm">
            {page.title === 'Overview' && project.description ? project.description : page.description}
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {actions}
          {/* Hosting belongs with practising: only on Home and the Practice pages. */}
          {documents.length > 0 && ((section.key === 'overview' && page.title === 'Overview') || page.child) && (
            <Link to={`${base}/live`} className="btn btn-secondary">
              <Radio className="h-4 w-4" />
              Host live quiz
            </Link>
          )}
        </div>
      </header>

      <MobileSections base={base} current={section} />

      {empty ? (
        <div className="card">
          <EmptyState
            icon={Upload}
            title="Add a document first"
            description="Upload notes, slides or a chapter to this project (or paste text), then study it here."
            action={
              <button type="button" onClick={addDocuments} className="btn btn-primary">
                <Plus className="h-4 w-4" />
                Add documents
              </button>
            }
          />
        </div>
      ) : typeof children === 'function' ? (
        children({ project, documents, setDocuments, refresh, addDocuments })
      ) : (
        children
      )}

      <AddDocumentsDialog
        open={adding}
        projectId={projectId}
        title={`Add documents to ${project.name}`}
        onUpload={appendDocument}
        onClose={closeAdding}
      />
    </div>
  );
};

export default ProjectLayout;

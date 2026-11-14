import React, { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { ChevronLeft, FileText, FolderOpen, Layers, ListChecks, ListTree, MessageSquareText, Network, Plus, Radio, Upload } from 'lucide-react';
import { errorMessage, projectAPI } from '../../services/api';
import { colorFor } from '../ui/Avatar';
import EmptyState from '../ui/EmptyState';
import { PageLoader } from '../common/LoadingSpinner';
import AddDocumentsDialog from '../document/AddDocumentsDialog';

const TABS = [
  { path: '', label: 'Documents', icon: FileText, end: true },
  { path: '/topics', label: 'Topics', icon: ListTree },
  { path: '/tutor', label: 'Tutor', icon: MessageSquareText },
  { path: '/quiz', label: 'Quiz', icon: ListChecks },
  { path: '/flashcards', label: 'Flashcards', icon: Layers },
  { path: '/map', label: 'Concept map', icon: Network },
];

// Small in-memory cache so switching tabs doesn't refetch the project.
const cache = new Map();

export const forgetProject = (projectId) => cache.delete(projectId);

/**
 * Header and tabs for every page inside a project.
 * `children` may be a node, or a function receiving
 * { project, documents, setDocuments, refresh, addDocuments } (addDocuments opens the upload dialog).
 * Study tabs (needsDocuments) show a prompt to upload first when the project is empty.
 */
const ProjectLayout = ({ children, needsDocuments = true }) => {
  const { projectId } = useParams();
  const [data, setData] = useState(() => cache.get(projectId) || null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await projectAPI.get(projectId);
      const next = { project: res.data.project, documents: res.data.documents || [] };
      cache.set(projectId, next);
      setData(next);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, 'Could not open this project'));
    }
  }, [projectId]);

  useEffect(() => {
    setData(cache.get(projectId) || null);
    refresh();
  }, [projectId, refresh]);

  const setDocuments = useCallback(
    (update) => {
      setData((prev) => {
        if (!prev) return prev;
        const documents = typeof update === 'function' ? update(prev.documents) : update;
        const next = { project: { ...prev.project, document_count: documents.length }, documents };
        cache.set(projectId, next);
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
  if (!data) return <PageLoader />;

  const { project, documents } = data;
  const base = `/projects/${projectId}`;
  const empty = needsDocuments && documents.length === 0;

  return (
    <div>
      <Link to="/projects" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:text-zinc-900 dark:hover:text-zinc-100">
        <ChevronLeft className="h-4 w-4" />
        Projects
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg text-base font-semibold text-white ${colorFor(project.color, project.name)}`}>
            {project.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight" title={project.name}>{project.name}</h1>
            <p className="muted mt-0.5 truncate text-sm">
              {documents.length} {documents.length === 1 ? 'document' : 'documents'}
              {project.description ? ` · ${project.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {documents.length > 0 && (
            <Link to={`/create-quiz-room?project=${projectId}`} className="btn btn-secondary">
              <Radio className="h-4 w-4" />
              Host live quiz
            </Link>
          )}
          <button type="button" onClick={addDocuments} className="btn btn-primary">
            <Plus className="h-4 w-4" />
            Add documents
          </button>
        </div>
      </div>

      <nav className="no-scrollbar -mx-1 mt-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 dark:border-zinc-800" aria-label="Project sections">
        {TABS.map(({ path, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={`${base}${path}`}
            end={end}
            className={({ isActive }) =>
              `-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-primary-600 text-zinc-900 dark:border-primary-400 dark:text-zinc-50'
                  : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="pt-6">
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
      </div>

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

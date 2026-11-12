import React, { useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { ChevronLeft, FileText, Layers, ListChecks, MessageSquareText, Network, Radio } from 'lucide-react';
import { documentAPI, errorMessage } from '../../services/api';
import { PageLoader } from '../common/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

const TABS = [
  { path: 'chat', label: 'Tutor', icon: MessageSquareText },
  { path: 'quiz', label: 'Quiz', icon: ListChecks },
  { path: 'flashcards', label: 'Flashcards', icon: Layers },
  { path: 'mindmap', label: 'Concept map', icon: Network },
];

// Small in-memory cache so switching tabs does not refetch the document.
const cache = new Map();

const formatSize = (bytes) => {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
};

/**
 * Shared header and tab bar for every per-document page.
 * `children` may be a node or a function receiving the loaded document.
 */
const DocumentLayout = ({ children }) => {
  const params = useParams();
  const documentId = params.documentId || params.id;
  const [document, setDocument] = useState(() => cache.get(documentId) || null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(documentId)) {
      setDocument(cache.get(documentId));
      return undefined;
    }
    documentAPI
      .getDocument(documentId)
      .then((res) => {
        if (cancelled) return;
        const { extracted_text: _text, ...meta } = res.data.document;
        cache.set(documentId, meta);
        setDocument(meta);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Could not load this document')));
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (error) {
    return (
      <div className="card">
        <EmptyState
          icon={FileText}
          title="Document unavailable"
          description={error}
          action={<Link to="/dashboard" className="btn btn-secondary">Back to library</Link>}
        />
      </div>
    );
  }
  if (!document) return <PageLoader />;

  const meta = [
    document.file_type?.toUpperCase(),
    document.page_count ? `${document.page_count} ${document.page_count === 1 ? 'page' : 'pages'}` : null,
    formatSize(document.file_size),
  ].filter(Boolean);

  return (
    <div>
      <Link to="/dashboard" className="muted mb-4 inline-flex items-center gap-1 text-sm hover:text-zinc-900 dark:hover:text-zinc-100">
        <ChevronLeft className="h-4 w-4" />
        Library
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <FileText className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight" title={document.filename}>
              {document.filename}
            </h1>
            <p className="muted mt-0.5 text-sm">{meta.join(' · ')}</p>
          </div>
        </div>
        <Link to={`/create-quiz-room?document=${documentId}`} className="btn btn-secondary flex-shrink-0">
          <Radio className="h-4 w-4" />
          Host live quiz
        </Link>
      </div>

      <nav className="-mx-1 mt-6 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800" aria-label="Study modes">
        {TABS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={`/document/${documentId}/${path}`}
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

      <div className="pt-6">{typeof children === 'function' ? children(document) : children}</div>
    </div>
  );
};

export const forgetDocument = (documentId) => cache.delete(documentId);

export default DocumentLayout;

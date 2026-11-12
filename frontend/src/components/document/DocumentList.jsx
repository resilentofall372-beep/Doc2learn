import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Layers, ListChecks, MessageSquareText, Network, Trash2 } from 'lucide-react';

const formatSize = (bytes) => {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const ACTIONS = [
  { path: 'quiz', label: 'Quiz', icon: ListChecks },
  { path: 'flashcards', label: 'Flashcards', icon: Layers },
  { path: 'mindmap', label: 'Concept map', icon: Network },
];

const DocumentList = ({ documents, onDelete }) => (
  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
    {documents.map((doc) => {
      const meta = [
        doc.file_type?.toUpperCase(),
        doc.page_count ? `${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}` : null,
        formatSize(doc.file_size),
        formatDate(doc.uploaded_on),
      ].filter(Boolean);
      return (
        <li key={doc._id} className="group flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <Link to={`/document/${doc._id}/chat`} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 group-hover:text-primary-600 dark:text-zinc-100 dark:group-hover:text-primary-400" title={doc.filename}>
                {doc.filename}
              </p>
              <p className="muted mt-0.5 truncate text-xs">
                {meta.join(' · ')}
                {doc.quiz_count > 0 && ` · ${doc.quiz_count} ${doc.quiz_count === 1 ? 'quiz' : 'quizzes'}`}
              </p>
            </div>
          </Link>

          <div className="flex flex-shrink-0 items-center gap-1 pl-12 sm:pl-0">
            <Link to={`/document/${doc._id}/chat`} className="btn btn-secondary btn-sm">
              <MessageSquareText className="h-3.5 w-3.5" />
              Study
            </Link>
            {ACTIONS.map(({ path, label, icon: Icon }) => (
              <Link key={path} to={`/document/${doc._id}/${path}`} className="btn btn-ghost btn-icon" title={label} aria-label={`${label} for ${doc.filename}`}>
                <Icon className="h-4 w-4" />
              </Link>
            ))}
            {onDelete && (
              <button type="button" onClick={() => onDelete(doc)} className="btn btn-danger btn-icon" title="Delete" aria-label={`Delete ${doc.filename}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </li>
      );
    })}
  </ul>
);

export default DocumentList;

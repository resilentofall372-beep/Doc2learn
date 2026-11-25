import { Link } from 'react-router-dom';
import { FileText, Layers, ListChecks, Network, Trash2 } from 'lucide-react';

const formatSize = (bytes) => {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const ACTIONS = [
  { path: 'quiz', label: 'Quiz on this document', icon: ListChecks },
  { path: 'flashcards', label: 'Flashcards for this document', icon: Layers },
  { path: 'map', label: 'Concept map of this document', icon: Network },
];

/** Documents in a project. Actions open a study tab narrowed to that one document. */
const DocumentList = ({ projectId, documents, onDelete }) => (
  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
    {documents.map((doc) => {
      const meta = [
        doc.file_type?.toUpperCase(),
        doc.page_count ? `${doc.page_count} ${doc.page_count === 1 ? 'page' : 'pages'}` : null,
        formatSize(doc.file_size),
        formatDate(doc.uploaded_on),
      ].filter(Boolean);
      return (
        <li key={doc._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100" title={doc.filename}>
                {doc.number ? <span className="muted mr-1.5 font-normal">Doc {doc.number}</span> : null}
                {doc.filename}
              </p>
              <p className="muted mt-0.5 truncate text-xs">
                {meta.join(' · ')}
                {doc.quiz_count > 0 && ` · ${doc.quiz_count} ${doc.quiz_count === 1 ? 'quiz' : 'quizzes'}`}
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-1 pl-12 sm:pl-0">
            {ACTIONS.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={`/projects/${projectId}/${path}?document=${doc._id}`}
                className="btn btn-ghost btn-icon"
                title={label}
                aria-label={`${label}: ${doc.filename}`}
              >
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

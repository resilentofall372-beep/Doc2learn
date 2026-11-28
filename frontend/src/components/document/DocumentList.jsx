import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpenText, FileText, Layers, ListChecks, MoreHorizontal, Network, Trash2 } from 'lucide-react';
import { openSource } from '../ui/RichText';

const formatSize = (bytes) => {
  if (!bytes) return null;
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const ACTIONS = [
  { path: 'quiz', label: 'Quiz', title: 'Quiz on this document', icon: ListChecks },
  { path: 'flashcards', label: 'Flashcards', title: 'Flashcards for this document', icon: Layers },
  { path: 'map', label: 'Map', title: 'Concept map of this document', icon: Network },
];

// Word, Markdown and text files are split at their headings into sections rather than pages.
const SECTIONED = new Set(['docx', 'txt', 'md']);

/** "⋯" menu holding the destructive action, so Delete isn't one slip away from Quiz. */
const MoreMenu = ({ doc, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-icon" aria-label={`More for ${doc.filename}`} aria-expanded={open}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="card absolute right-0 top-9 z-10 w-36 p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete(doc);
            }}
            className="btn btn-danger btn-sm w-full justify-start"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

/** Documents in a project. Actions open a study tab narrowed to that one document. */
const DocumentList = ({ projectId, documents, onDelete }) => (
  <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
    {documents.map((doc) => {
      const meta = [
        doc.file_type?.toUpperCase(),
        doc.page_count > 1 || !SECTIONED.has(doc.file_type)
          ? doc.page_count
            ? `${doc.page_count} ${SECTIONED.has(doc.file_type) ? (doc.page_count === 1 ? 'section' : 'sections') : doc.page_count === 1 ? 'page' : 'pages'}`
            : null
          : null,
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

          <div className="flex flex-shrink-0 flex-wrap items-center gap-1 pl-12 sm:pl-0">
            <button
              type="button"
              onClick={() => openSource({ documentId: doc._id, filename: doc.filename })}
              className="btn btn-ghost btn-sm"
              aria-label={`Read ${doc.filename}`}
            >
              <BookOpenText className="h-3.5 w-3.5" />
              Read
            </button>
            {ACTIONS.map(({ path, label, title, icon: Icon }) => (
              <Link
                key={path}
                to={`/projects/${projectId}/${path}?document=${doc._id}`}
                className="btn btn-ghost btn-sm"
                title={title}
                aria-label={`${title}: ${doc.filename}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
            {onDelete && <MoreMenu doc={doc} onDelete={onDelete} />}
          </div>
        </li>
      );
    })}
  </ul>
);

export default DocumentList;

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import DocumentUpload from './DocumentUpload';

/**
 * Modal for adding files or pasted text to a project.
 * It can't be closed while something is still uploading (the queue lives in here).
 */
const AddDocumentsDialog = ({
  open,
  projectId,
  onClose,
  onUpload,
  title = 'Add documents',
  description = 'New documents are indexed straight away. The tutor, quizzes and flashcards use them as soon as they are ready.',
  doneLabel = 'Done',
  skipLabel = null,
}) => {
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  useEffect(() => {
    if (open) setAdded(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !busy && onClose({ added });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, added, onClose]);

  if (!open) return null;

  const close = () => !busy && onClose({ added });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="add-docs-title">
      <div className="absolute inset-0 bg-zinc-950/40" onClick={close} />
      <div className="card relative flex max-h-[90vh] w-full max-w-lg animate-fade-in flex-col shadow-xl">
        <div className="card-header">
          <div className="min-w-0">
            <h2 id="add-docs-title" className="card-title truncate">{title}</h2>
            <p className="muted mt-0.5 text-xs">{description}</p>
          </div>
          <button type="button" onClick={close} className="btn btn-ghost btn-icon -mr-2 flex-shrink-0" aria-label="Close" disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <DocumentUpload
            projectId={projectId}
            onBusyChange={setBusy}
            onUpload={(doc) => {
              setAdded((n) => n + 1);
              onUpload?.(doc);
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="muted text-xs">
            {busy ? 'Keep this open until uploads finish.' : added > 0 ? `${added} added` : ''}
          </span>
          <div className="flex gap-2">
            {skipLabel && added === 0 && (
              <button type="button" onClick={close} className="btn btn-ghost" disabled={busy}>
                {skipLabel}
              </button>
            )}
            <button type="button" onClick={close} className="btn btn-primary" disabled={busy || (skipLabel && added === 0)}>
              {doneLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddDocumentsDialog;

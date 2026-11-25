import { useEffect, useState } from 'react';
import { FilePlus } from 'lucide-react';
import Dialog from '../ui/Dialog';
import DocumentUpload from './DocumentUpload';

/**
 * Add files or pasted text to a project.
 * It can't be closed while something is still uploading (the upload queue lives in here).
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

  const close = () => !busy && onClose({ added });

  return (
    <Dialog
      open={open}
      onClose={close}
      locked={busy}
      icon={FilePlus}
      title={title}
      description={description}
      footer={
        <>
          <span className="muted mr-auto text-xs">{busy ? 'Keep this open until uploads finish.' : added > 0 ? `${added} added` : ''}</span>
          {skipLabel && added === 0 && (
            <button type="button" onClick={close} className="btn btn-ghost" disabled={busy}>
              {skipLabel}
            </button>
          )}
          <button type="button" onClick={close} className="btn btn-primary" disabled={busy || Boolean(skipLabel && added === 0)}>
            {doneLabel}
          </button>
        </>
      }
    >
      <div className="p-5">
        <DocumentUpload
          projectId={projectId}
          onBusyChange={setBusy}
          onUpload={(doc) => {
            setAdded((n) => n + 1);
            onUpload?.(doc);
          }}
        />
      </div>
    </Dialog>
  );
};

export default AddDocumentsDialog;

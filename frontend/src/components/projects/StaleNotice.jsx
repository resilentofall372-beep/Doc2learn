import React from 'react';
import { FilePlus, RefreshCw } from 'lucide-react';

/** "New documents were added after this <what> was made" with a regenerate button. */
const StaleNotice = ({ what, documents, onRegenerate, busy = false }) => (
  <div className="alert alert-info flex-col sm:flex-row sm:items-center">
    <FilePlus className="mt-0.5 h-4 w-4 flex-shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">
        {documents.length === 1 ? 'A document was' : `${documents.length} documents were`} added after this {what} was made
      </p>
      <p className="muted mt-0.5 truncate text-xs">{documents.map((d) => d.filename).join(', ')}</p>
    </div>
    <button type="button" onClick={onRegenerate} disabled={busy} className="btn btn-secondary btn-sm flex-shrink-0">
      <RefreshCw className="h-3.5 w-3.5" />
      Regenerate to include {documents.length === 1 ? 'it' : 'them'}
    </button>
  </div>
);

export default StaleNotice;

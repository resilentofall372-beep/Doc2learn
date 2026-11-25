import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, ClipboardPaste, FileText, RotateCw, UploadCloud, X } from 'lucide-react';
import { documentAPI, errorMessage } from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { UPLOAD_CONFIG } from '../../utils/constants';
import LoadingSpinner from '../common/LoadingSpinner';

const extensionOf = (name) => `.${(name.split('.').pop() || '').toLowerCase()}`;

const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

/** Why a file can't be uploaded, or null if it's fine. */
const problemWith = (file) => {
  if (!UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) return 'Unsupported type. Use PDF, DOCX, PPTX, TXT, MD, PNG or JPG.';
  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) return 'Larger than 16 MB.';
  return null;
};

let nextKey = 0;

const STATUS = {
  waiting: { label: 'Waiting', className: 'muted' },
  uploading: { label: 'Reading and indexing…', className: 'text-primary-600 dark:text-primary-400' },
  done: { label: 'Ready', className: 'text-emerald-600 dark:text-emerald-400' },
  error: { label: 'Failed', className: 'text-red-600 dark:text-red-400' },
};

const QueueRow = ({ item, onRetry, onRemove }) => {
  const status = STATUS[item.status];
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex-shrink-0">
        {item.status === 'uploading' ? (
          <LoadingSpinner size="small" />
        ) : item.status === 'done' ? (
          <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : item.status === 'error' ? (
          <CircleAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <FileText className="h-4 w-4 text-zinc-400" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-900 dark:text-zinc-100" title={item.name}>{item.name}</p>
        <p className={`truncate text-xs ${status.className}`}>
          {item.status === 'error' && item.error ? item.error : status.label}
          {item.status !== 'error' && item.size ? <span className="muted"> · {formatSize(item.size)}</span> : null}
        </p>
      </div>
      {item.status === 'error' && item.retriable && (
        <button type="button" onClick={() => onRetry(item.key)} className="btn btn-ghost btn-sm" aria-label={`Retry ${item.name}`}>
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
      {item.status !== 'uploading' && (
        <button type="button" onClick={() => onRemove(item.key)} className="btn btn-ghost btn-icon" aria-label={`Remove ${item.name} from the list`}>
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
};

const PasteForm = ({ projectId, onAdded, onBusyChange }) => {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { addNotification } = useApp();

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return setError('Give the text a title.');
    if (text.trim().length < 20) return setError('Paste at least a few sentences.');
    setSaving(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const res = await documentAPI.paste(projectId, title.trim(), text);
      addNotification({ type: 'success', title: 'Text added', message: `${res.data.document.filename} is ready to study.` });
      onAdded?.(res.data.document);
      setTitle('');
      setText('');
    } catch (err) {
      setError(errorMessage(err, 'Could not add the text'));
    } finally {
      setSaving(false);
      onBusyChange?.(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="alert alert-danger">{error}</div>}
      <div>
        <label htmlFor="paste-title" className="label">Title</label>
        <input id="paste-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Week 3 lecture notes" className="input" />
      </div>
      <div>
        <label htmlFor="paste-text" className="label">Text</label>
        <textarea
          id="paste-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="Paste notes, an article or a transcript…"
          className="input resize-y"
        />
        <p className="hint">{text.length.toLocaleString()} characters</p>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving && <LoadingSpinner size="small" />}
          Add as document
        </button>
      </div>
    </form>
  );
};

/**
 * Add documents to a project: drop or pick several files (uploaded one after another,
 * each with its own status), or paste text. `onUpload(document)` runs for each new one;
 * `onBusyChange(busy)` reports whether anything is still uploading.
 */
const DocumentUpload = ({ projectId, onUpload, onBusyChange, compact = false, allowPaste = true }) => {
  const [mode, setMode] = useState('files'); // files | paste
  const [items, setItems] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [pasting, setPasting] = useState(false);
  const inputRef = useRef(null);
  const busyRef = useRef(false);
  const onUploadRef = useRef(onUpload);
  const { addNotification } = useApp();

  useEffect(() => {
    onUploadRef.current = onUpload;
  }, [onUpload]);

  const update = (key, patch) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const pending = items.filter((i) => i.status === 'waiting' || i.status === 'uploading').length;
  const busy = pending > 0 || pasting;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  // Upload waiting files one at a time, so large batches don't overwhelm the server.
  useEffect(() => {
    if (busyRef.current) return;
    const next = items.find((i) => i.status === 'waiting');
    if (!next) return;
    busyRef.current = true;
    update(next.key, { status: 'uploading', error: null });
    documentAPI
      .upload(projectId, next.file)
      .then((res) => {
        const { document, warnings } = res.data;
        update(next.key, { status: 'done' });
        (warnings || []).forEach((w) => addNotification({ type: 'info', title: document.filename, message: w }));
        onUploadRef.current?.(document);
      })
      .catch((error) => {
        // Server-side rejections (bad file) won't succeed on retry; network errors might.
        const status = error?.response?.status;
        update(next.key, { status: 'error', error: errorMessage(error, 'Upload failed'), retriable: !status || status >= 500 || status === 429 });
      })
      .finally(() => {
        busyRef.current = false;
        setItems((prev) => [...prev]); // wake the effect for the next file
      });
  }, [items, projectId, addNotification]);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setItems((prev) => [
      ...prev,
      ...files.map((file) => {
        const problem = problemWith(file);
        return {
          key: ++nextKey,
          file,
          name: file.name,
          size: file.size,
          status: problem ? 'error' : 'waiting',
          error: problem,
          retriable: false,
        };
      }),
    ]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const finished = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-3">
      {allowPaste && (
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800/70" role="tablist" aria-label="How to add">
          {[
            { id: 'files', label: 'Upload files', icon: UploadCloud },
            { id: 'paste', label: 'Paste text', icon: ClipboardPaste },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors ${
                mode === id
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}

      {mode === 'paste' && allowPaste ? (
        <PasteForm projectId={projectId} onAdded={(doc) => onUploadRef.current?.(doc)} onBusyChange={setPasting} />
      ) : (
        <>
          <div
            onDragEnter={onDrag}
            onDragOver={onDrag}
            onDragLeave={onDrag}
            onDrop={(e) => {
              onDrag(e);
              setDragActive(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors ${
              compact ? 'px-6 py-6' : 'px-6 py-10'
            } ${
              dragActive
                ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-500/10'
                : 'border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
            }`}
          >
            <div className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm">
              <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400">
                Choose files
              </button>
              <span className="muted"> or drag them here</span>
            </p>
            <p className="muted mt-1 text-xs">PDF, DOCX, PPTX, TXT, MD, PNG or JPG · up to 16 MB each · as many as you like</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              accept={UPLOAD_CONFIG.ALLOWED_EXTENSIONS.join(',')}
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {items.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                <span className="muted">
                  {pending > 0 ? `Adding ${pending} ${pending === 1 ? 'file' : 'files'}… ` : ''}
                  {finished} of {items.length} ready
                </span>
                {pending === 0 && (
                  <button type="button" onClick={() => setItems([])} className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                    Clear list
                  </button>
                )}
              </div>
              <ul className="max-h-64 divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
                {items.map((item) => (
                  <QueueRow
                    key={item.key}
                    item={item}
                    onRetry={(key) => update(key, { status: 'waiting', error: null })}
                    onRemove={(key) => setItems((prev) => prev.filter((i) => i.key !== key))}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DocumentUpload;

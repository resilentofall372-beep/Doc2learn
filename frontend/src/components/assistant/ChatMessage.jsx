import { AlertCircle, BookOpen } from 'lucide-react';
import RichText, { sourceLabel } from '../ui/RichText';

const CONFIDENCE = {
  high: { label: 'Grounded in your documents', className: 'badge-success' },
  medium: { label: 'Partly grounded', className: 'badge-warning' },
  low: { label: 'Not covered by your documents', className: 'badge-neutral' },
};

const formatTime = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

const ChatMessage = ({ message }) => {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-600 px-4 py-2.5 text-sm text-white shadow-sm">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  // Older messages stored sources as plain page numbers; newer ones as {filename, page}.
  const confidence = CONFIDENCE[message.metadata?.confidence];
  // An answer the documents don't cover has no real sources, only the excerpts that were searched.
  const sources =
    message.metadata?.confidence === 'low'
      ? []
      : (message.metadata?.sources || []).map((s) => (typeof s === 'number' ? { page: s } : s));

  return (
    <div className="flex gap-3">
      <div
        className={`mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-full ${
          message.isError
            ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
        }`}
      >
        {message.isError ? <AlertCircle className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <RichText
          text={message.content}
          legend={message.metadata?.legend}
          className={`text-sm ${message.isError ? 'text-red-700 dark:text-red-300' : 'text-zinc-700 dark:text-zinc-300'}`}
        />
        {(sources.length > 0 || confidence) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {confidence && <span className={`badge ${confidence.className}`}>{confidence.label}</span>}
            {sources.length > 0 && <span className="muted text-xs">Sources: {sources.map(sourceLabel).join('; ')}</span>}
          </div>
        )}
        {message.timestamp && <p className="mt-2 text-[11px] text-zinc-400">{formatTime(message.timestamp)}</p>}
      </div>
    </div>
  );
};

export default ChatMessage;

import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

const STYLES = {
  success: { Icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' },
  error: { Icon: AlertCircle, tone: 'text-red-600 dark:text-red-400' },
  info: { Icon: Info, tone: 'text-primary-600 dark:text-primary-400' },
};

const Notification = () => {
  const { notifications, removeNotification } = useApp();
  if (notifications.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" aria-live="polite">
      {notifications.map((n) => {
        const { Icon, tone } = STYLES[n.type] || STYLES.info;
        return (
          <div key={n.id} className="card pointer-events-auto flex animate-fade-in items-start gap-3 p-4 shadow-lg">
            <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone}`} />
            <div className="min-w-0 flex-1">
              {n.title && <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>}
              {n.message && <p className="muted mt-0.5 break-words text-sm">{n.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeNotification(n.id)}
              className="-m-1 rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Notification;

import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl' };

/**
 * The one modal used across the app: backdrop, header (icon, title, description, close),
 * scrolling body and an optional footer. Escape and a click on the backdrop close it
 * unless `locked` (e.g. while saving or uploading).
 */
const Dialog = ({ open, onClose, title, description, icon: Icon, footer, children, size = 'md', locked = false, as: Tag = 'div', onSubmit }) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !locked && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, locked, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[2px]" onClick={() => !locked && onClose()} />
      <Tag onSubmit={onSubmit} className={`card relative flex max-h-[92vh] w-full ${WIDTHS[size]} animate-fade-in flex-col shadow-2xl`}>
        <div className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {Icon && (
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
            {description && <p className="muted mt-0.5 text-xs">{description}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={locked} className="btn btn-ghost btn-icon -mr-2 -mt-1 flex-shrink-0" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-5 py-3.5 dark:border-zinc-800">{footer}</div>}
      </Tag>
    </div>
  );
};

export default Dialog;

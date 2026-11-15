import React from 'react';

/**
 * A titled card: the building block of every page.
 * Header: optional icon, title, description and actions. `flush` drops body padding (lists, tables).
 */
const Section = ({ title, description, icon: Icon, actions, children, flush = false, className = '', bodyClassName = '' }) => (
  <section className={`card ${className}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3.5 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-zinc-400" />}
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>}
            {description && <p className="muted mt-0.5 text-xs">{description}</p>}
          </div>
        </div>
        {actions && <div className="-mr-1 flex flex-shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
      </header>
    )}
    <div className={`${flush ? '' : 'p-5'} ${bodyClassName}`}>{children}</div>
  </section>
);

export default Section;

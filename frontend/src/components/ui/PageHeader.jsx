import React from 'react';

const PageHeader = ({ title, description, actions, eyebrow }) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
      <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
      {description && <p className="muted mt-1.5 max-w-2xl text-sm">{description}</p>}
    </div>
    {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;

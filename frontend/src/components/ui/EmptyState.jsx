
const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center px-6 py-14 text-center ${className}`}>
    {Icon && (
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
    )}
    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
    {description && <p className="muted mt-1 max-w-sm text-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;


const TONES = {
  neutral: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
};

/** A single number with a label: used in rows of four at the top of a page. */
const StatsCard = ({ title, value, icon: Icon, hint, tone = 'neutral' }) => (
  <div className="card flex items-start gap-3.5 p-4">
    {Icon && (
      <span className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg ${TONES[tone] || TONES.neutral}`}>
        <Icon className="h-4 w-4" />
      </span>
    )}
    <div className="min-w-0">
      <p className="muted truncate text-xs font-medium">{title}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
      {hint && <p className="muted mt-0.5 truncate text-xs">{hint}</p>}
    </div>
  </div>
);

export default StatsCard;

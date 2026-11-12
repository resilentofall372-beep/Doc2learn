import React from 'react';

const StatsCard = ({ title, value, icon: Icon, hint }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between">
      <p className="muted text-sm font-medium">{title}</p>
      {Icon && <Icon className="h-4 w-4 text-zinc-400" />}
    </div>
    <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    {hint && <p className="muted mt-1 text-xs">{hint}</p>}
  </div>
);

export default StatsCard;

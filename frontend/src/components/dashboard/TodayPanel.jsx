import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Repeat, Sun, Target } from 'lucide-react';
import { statsAPI } from '../../services/api';
import { colorFor } from '../ui/Avatar';
import { nextStepActions } from '../../utils/progress';

/** One project's line in Today: its next step, today's plan item, cards due and weakest topic. */
const ProjectRow = ({ row }) => {
  const [primary] = nextStepActions(row._id, row.next_step);
  // "Add documents" opens a dialog inside the project, so here it just opens the project.
  const to = primary.to || `/projects/${row._id}`;
  const facts = [
    row.due_cards ? { icon: Repeat, text: `${row.due_cards} ${row.due_cards === 1 ? 'card' : 'cards'} due`, tone: 'text-amber-600 dark:text-amber-400' } : null,
    row.weakest_topic ? { icon: Target, text: `Weakest: ${row.weakest_topic.title} (${row.weakest_topic.mastery}%)` } : null,
    row.plan_today ? { icon: CalendarDays, text: `Plan day ${row.plan_today.day}: ${row.plan_today.topic}${row.plan_today.done ? ' ✓' : ''}` } : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-xs font-semibold text-white ${colorFor(row.color, row.name)}`}>
          {row.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm">
            <Link to={`/projects/${row._id}`} className="font-semibold text-zinc-900 hover:text-primary-600 dark:text-zinc-100 dark:hover:text-primary-400">
              {row.name}
            </Link>
            <span className="muted"> · {row.next_step.title}</span>
          </p>
          {facts.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {facts.map(({ icon: Icon, text, tone }) => (
                <span key={text} className={`inline-flex min-w-0 items-center gap-1 ${tone || 'muted'}`}>
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{text}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <Link to={to} className="btn btn-secondary btn-sm flex-shrink-0 self-start sm:self-center">
        {primary.label}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </li>
  );
};

/** "What to do today" across every project. Hidden until there is something to show. */
const TodayPanel = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    statsAPI
      .today()
      .then((res) => alive && setData(res.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.projects.length) return null;
  const rows = data.projects.slice(0, 4);

  return (
    <section className="card mb-8">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
            <Sun className="h-4 w-4" />
          </span>
          <div>
            <h2 className="card-title">Today</h2>
            <p className="muted text-xs">
              {data.due_cards
                ? `${data.due_cards} flashcards are due across your projects.`
                : 'No flashcards due. Pick up where you left off.'}
            </p>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <ProjectRow key={row._id} row={row} />
        ))}
      </ul>
    </section>
  );
};

export default TodayPanel;

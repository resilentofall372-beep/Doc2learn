import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layers, ListChecks, Repeat } from 'lucide-react';
import { flashcardsAPI } from '../../services/api';

const ITEMS = [
  { path: 'quiz', label: 'Quiz', icon: ListChecks },
  { path: 'flashcards', label: 'Flashcards', icon: Layers },
  { path: 'review', label: 'Review', icon: Repeat },
];

/** Switch between the three ways to practise. `refreshKey` re-counts due cards after a rating. */
const PracticeNav = ({ projectId, refreshKey = 0 }) => {
  const { pathname } = useLocation();
  const [due, setDue] = useState(0);

  useEffect(() => {
    let alive = true;
    flashcardsAPI
      .due(projectId, null, 1)
      .then((res) => alive && setDue(res.data.total || 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projectId, refreshKey]);

  return (
    <nav className="mx-auto mb-6 flex max-w-md gap-1 rounded-lg bg-zinc-100 p-1 text-sm dark:bg-zinc-800/70" aria-label="Practice">
      {ITEMS.map(({ path, label, icon: Icon }) => {
        const active = pathname.endsWith(`/${path}`);
        return (
          <Link
            key={path}
            to={`/projects/${projectId}/${path}`}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 font-medium transition-colors ${
              active
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {path === 'review' && due > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold leading-5 text-white">{due}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export default PracticeNav;

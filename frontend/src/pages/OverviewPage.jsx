import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CircleCheck,
  Clock,
  Layers,
  ListChecks,
  ListTree,
  Pencil,
  Repeat,
  Sparkles,
  Target,
} from 'lucide-react';
import { assistantAPI, errorMessage, projectAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import ProjectLayout from '../components/projects/ProjectLayout';
import StatsCard from '../components/dashboard/StatsCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner, { PageLoader } from '../components/common/LoadingSpinner';
import { STATUS, nextStepActions, topicRoutes } from '../utils/progress';
import { timeAgo } from '../utils/time';

// --------------------------------------------------------------------------- next step
const NextStep = ({ projectId, step, onAddDocuments }) => {
  const actions = nextStepActions(projectId, step);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-col gap-4 border-l-4 border-primary-600 p-5 sm:flex-row sm:items-center dark:border-primary-400">
        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300">
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Next step</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{step.title}</h2>
          {step.detail && <p className="muted mt-0.5 text-sm">{step.detail}</p>}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {actions.map((action, i) =>
            action.action === 'add_documents' ? (
              <button key={action.label} type="button" onClick={onAddDocuments} className="btn btn-primary">
                {action.label}
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link key={action.label} to={action.to} className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'}`}>
                {action.label}
                {i === 0 && <ArrowRight className="h-4 w-4" />}
              </Link>
            )
          )}
        </div>
      </div>
    </section>
  );
};

// --------------------------------------------------------------------------- topics
const Step = ({ to, icon: Icon, label, done, badge, disabled }) => {
  const className = `inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
    disabled
      ? 'pointer-events-none border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600'
      : done
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
  }`;
  return (
    <Link to={to} className={className} aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined}>
      {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
      {label}
      {badge ? <span className="rounded-full bg-amber-500 px-1.5 text-[10px] leading-4 text-white">{badge}</span> : null}
    </Link>
  );
};

const TopicProgress = ({ topic, index, projectId }) => {
  const status = STATUS[topic.status] || STATUS.not_started;
  const routes = topicRoutes(projectId, topic);
  const { quiz, cards } = topic;
  const facts = [
    quiz.answered ? `${quiz.correct}/${quiz.answered} quiz answers right` : null,
    cards.reviewed ? `${cards.known}/${cards.reviewed} cards known` : null,
  ].filter(Boolean);

  return (
    <li className="px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-zinc-100 text-[11px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{topic.title}</h3>
            <span className={`badge ${status.badge}`}>{status.label}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="progress-track flex-1">
              <div className={`h-full rounded-full transition-[width] duration-500 ${status.bar}`} style={{ width: `${topic.mastery ?? 0}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-medium tabular-nums">{topic.mastery == null ? '—' : `${topic.mastery}%`}</span>
          </div>
          <p className="muted mt-1 text-xs">{facts.length ? facts.join(' · ') : 'No quiz answers or card ratings yet'}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Step to={routes.learn} icon={BookOpen} label="Learn" />
            <ArrowRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
            <Step to={routes.practice} icon={Layers} label="Practice" done={cards.reviewed > 0} />
            <ArrowRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
            <Step to={routes.review} icon={Repeat} label="Review" badge={cards.due} disabled={!cards.due} />
            <ArrowRight className="h-3 w-3 text-zinc-300 dark:text-zinc-600" />
            <Step to={routes.test} icon={ListChecks} label="Test" done={quiz.answered > 0} />
          </div>
        </div>
      </div>
    </li>
  );
};

// --------------------------------------------------------------------------- study plan
const StudyPlan = ({ projectId, plan, hasOutline, onChange }) => {
  const { addNotification } = useApp();
  const [days, setDays] = useState(7);
  const [working, setWorking] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const make = async () => {
    setWorking(true);
    try {
      const res = await assistantAPI.createStudyPlan(projectId, null, [], days);
      onChange(res.data.saved_plan);
      addNotification({ type: 'success', title: 'Study plan ready', message: `${days} days, built around your progress.` });
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not make a plan', message: errorMessage(error) });
    } finally {
      setWorking(false);
    }
  };

  const toggleDay = async (day, done) => {
    try {
      const res = await assistantAPI.markPlanDay(projectId, day, done);
      onChange(res.data.saved_plan);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not update the plan', message: errorMessage(error) });
    }
  };

  const maker = (
    <div className="flex items-center gap-2">
      <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input w-auto py-1.5" aria-label="Plan length" disabled={working}>
        {[3, 7, 14].map((n) => (
          <option key={n} value={n}>{n} days</option>
        ))}
      </select>
      <button type="button" onClick={make} disabled={working} className={`btn btn-sm ${plan ? 'btn-ghost' : 'btn-primary'}`}>
        {working ? <LoadingSpinner size="small" /> : <Sparkles className="h-3.5 w-3.5" />}
        {working ? 'Planning…' : plan ? 'New plan' : 'Make my plan'}
      </button>
    </div>
  );

  if (!plan) {
    return (
      <section className="card">
        <div className="card-header py-3">
          <h2 className="card-title flex items-center gap-2"><CalendarDays className="h-4 w-4 text-zinc-400" />Study plan</h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="muted text-sm">
            {hasOutline
              ? 'A day-by-day plan that follows your topics, spends longer on weak ones and slots in flashcard reviews.'
              : 'Build the topic outline first for a plan that follows your topics. Without it, the plan is based on the documents alone.'}
          </p>
          {maker}
        </div>
      </section>
    );
  }

  const index = Math.min(plan.today, plan.plan.length) - 1;
  const today = plan.plan[index];
  const doneSet = new Set(plan.done || []);
  return (
    <section className="card">
      <div className="card-header flex-wrap py-3">
        <div>
          <h2 className="card-title flex items-center gap-2"><CalendarDays className="h-4 w-4 text-zinc-400" />Study plan</h2>
          <p className="muted mt-0.5 text-xs">
            {plan.finished ? `Finished · made ${timeAgo(plan.created_at)}` : `Day ${plan.today} of ${plan.plan.length} · ${doneSet.size} done`}
          </p>
        </div>
        {maker}
      </div>
      {plan.finished ? (
        <div className="p-5">
          <p className="text-sm">You reached the end of this plan. Make a new one: it will use your latest progress.</p>
        </div>
      ) : (
        today && (
          <div className="p-5">
            <p className="eyebrow">Today</p>
            <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{today.topic}</p>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
              {today.activities.map((a) => (
                <li key={a} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-zinc-400" />
                  {a}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => toggleDay(today.day, !doneSet.has(today.day))}
              className={`btn btn-sm mt-4 ${doneSet.has(today.day) ? 'btn-secondary' : 'btn-primary'}`}
            >
              {doneSet.has(today.day) ? <CircleCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
              {doneSet.has(today.day) ? 'Done for today' : 'Mark today done'}
            </button>
          </div>
        )
      )}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full px-5 py-2.5 text-left text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          {showAll ? 'Hide the full plan' : `Show all ${plan.plan.length} days`}
        </button>
        {showAll && (
          <ol className="space-y-2 px-5 pb-4">
            {plan.plan.map((day) => (
              <li key={day.day} className="flex items-start gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => toggleDay(day.day, !doneSet.has(day.day))}
                  aria-label={`Day ${day.day} ${doneSet.has(day.day) ? 'done' : 'not done'}`}
                  className={`mt-0.5 grid h-5 w-5 flex-shrink-0 place-items-center rounded border ${
                    doneSet.has(day.day) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600'
                  }`}
                >
                  {doneSet.has(day.day) && <Check className="h-3 w-3" />}
                </button>
                <span className={day.day === plan.today && !plan.finished ? 'font-semibold' : ''}>
                  Day {day.day} · {day.topic}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

// --------------------------------------------------------------------------- page
const Overview = ({ projectId, documents, addDocuments }) => {
  const { addNotification } = useApp();
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await projectAPI.overview(projectId);
      setData(res.data);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load your progress', message: errorMessage(error) });
    }
  }, [projectId, addNotification]);

  // Documents added from the header change the next step, so reload with them.
  useEffect(() => {
    load();
  }, [load, documents.length]);

  if (!data) return <PageLoader />;

  const { summary, stats, topics } = data;
  return (
    <div className="space-y-6">
      <NextStep projectId={projectId} step={data.next_step} onAddDocuments={addDocuments} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Topics mastered"
          value={summary.topics ? `${summary.mastered} / ${summary.topics}` : '—'}
          icon={CircleCheck}
          hint={summary.topics ? `${summary.started} started` : 'Build the outline to track topics'}
        />
        <StatsCard
          title="Average mastery"
          value={summary.average_mastery == null ? '—' : `${summary.average_mastery}%`}
          icon={Target}
          hint={summary.average_mastery == null ? 'Quizzes and card ratings count' : 'Across started topics'}
        />
        <StatsCard title="Cards due" value={data.due_cards} icon={Repeat} hint={data.due_cards ? 'Review them today' : 'All caught up'} />
        <StatsCard
          title="Quiz average"
          value={stats.quizzes_taken ? `${stats.average_score}%` : '—'}
          icon={Clock}
          hint={stats.quizzes_taken ? `${stats.quizzes_taken} quizzes · ${stats.study_time_label}` : 'No quizzes yet'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card">
          <div className="card-header py-3">
            <div>
              <h2 className="card-title">Topics</h2>
              <p className="muted mt-0.5 text-xs">Work through each one: learn it, practise with flashcards, review when due, then test yourself.</p>
            </div>
            {data.has_outline && (
              <Link to={`/projects/${projectId}/topics`} className="btn btn-ghost btn-sm -mr-2 flex-shrink-0">
                <Pencil className="h-3.5 w-3.5" />
                Edit outline
              </Link>
            )}
          </div>
          {!data.has_outline ? (
            <EmptyState
              icon={ListTree}
              title="No topic outline yet"
              description={
                data.document_count
                  ? 'Split your documents into topics to see progress for each one.'
                  : 'Add documents first, then build an outline from them.'
              }
              action={
                data.document_count ? (
                  <Link to={`/projects/${projectId}/topics`} className="btn btn-primary">
                    <Sparkles className="h-4 w-4" />
                    Build outline
                  </Link>
                ) : (
                  <button type="button" onClick={addDocuments} className="btn btn-primary">Add documents</button>
                )
              }
            />
          ) : topics.length === 0 ? (
            <EmptyState icon={ListTree} title="The outline is empty" description="Add topics by hand or rebuild it from your documents." />
          ) : (
            <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {topics.map((topic, i) => (
                <TopicProgress key={topic.id} topic={topic} index={i} projectId={projectId} />
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <StudyPlan
            projectId={projectId}
            plan={data.saved_plan}
            hasOutline={data.has_outline && topics.length > 0}
            onChange={(saved) => setData((prev) => ({ ...prev, saved_plan: saved }))}
          />

          {stats.recent_attempts?.length > 0 && (
            <section className="card">
              <div className="card-header py-3">
                <h2 className="card-title">Recent quizzes</h2>
                <Link to={`/projects/${projectId}/quiz`} className="btn btn-ghost btn-sm -mr-2">New quiz</Link>
              </div>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {stats.recent_attempts.map((a) => (
                  <li key={a._id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span className="muted text-xs">{timeAgo(a.submitted_at)}{a.difficulty ? ` · ${a.difficulty}` : ''}</span>
                    <span className={`font-medium tabular-nums ${a.percentage >= 75 ? 'text-emerald-600 dark:text-emerald-400' : a.percentage >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                      {a.score}/{a.total} · {a.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

const OverviewPage = () => {
  const { projectId } = useParams();
  return (
    <ProjectLayout needsDocuments={false}>
      {({ documents, addDocuments }) => <Overview projectId={projectId} documents={documents} addDocuments={addDocuments} />}
    </ProjectLayout>
  );
};

export default OverviewPage;

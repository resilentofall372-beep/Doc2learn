import React, { useState } from 'react';
import { CalendarDays, ChevronRight, FileText, Lightbulb, PenLine, X } from 'lucide-react';
import { assistantAPI, errorMessage } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import RichText from '../ui/RichText';

const TOOLS = [
  { id: 'summarize', name: 'Summary', description: 'Overview and key points', icon: FileText },
  { id: 'explain', name: 'Explain a concept', description: 'Definition, example, common mistake', icon: Lightbulb, prompt: 'Concept to explain', placeholder: 'e.g. photosynthesis' },
  { id: 'practice', name: 'Practice problems', description: 'Open questions with hints', icon: PenLine, prompt: 'Topic', placeholder: 'e.g. chapter 2, or leave blank' , optional: true },
  { id: 'study-plan', name: 'Study plan', description: 'Seven days, weighted to weak spots', icon: CalendarDays, prompt: 'Topics you find hard', placeholder: 'Comma separated, optional', optional: true },
];

const Sources = ({ pages }) =>
  pages?.length ? <p className="muted mt-3 text-xs">Sources: {pages.map((p) => `p. ${p}`).join(', ')}</p> : null;

const Result = ({ result }) => {
  if (result.type === 'summarize') {
    return (
      <>
        <RichText text={result.data.summary} className="text-sm text-zinc-700 dark:text-zinc-300" />
        {result.data.key_points?.length > 0 && (
          <>
            <p className="eyebrow mt-4">Key points</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 marker:text-zinc-400 dark:text-zinc-300">
              {result.data.key_points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </>
        )}
      </>
    );
  }
  if (result.type === 'explain') {
    return (
      <>
        <RichText text={result.data.explanation} className="text-sm text-zinc-700 dark:text-zinc-300" />
        <Sources pages={result.data.sources} />
      </>
    );
  }
  if (result.type === 'practice') {
    return (
      <ol className="space-y-4">
        {result.data.problems.map((problem, idx) => (
          <li key={problem.question} className="text-sm">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{idx + 1}. {problem.question}</p>
            <details className="group mt-2">
              <summary className="muted cursor-pointer text-xs hover:text-zinc-900 dark:hover:text-zinc-100">Hint</summary>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{problem.hint}</p>
            </details>
            <details className="mt-1">
              <summary className="muted cursor-pointer text-xs hover:text-zinc-900 dark:hover:text-zinc-100">Model answer</summary>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{problem.answer}</p>
            </details>
          </li>
        ))}
      </ol>
    );
  }
  if (result.type === 'study-plan') {
    return (
      <ol className="space-y-3">
        {result.data.plan.map((day) => (
          <li key={day.day} className="flex gap-3">
            <span className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-md bg-zinc-100 text-xs font-semibold tabular-nums dark:bg-zinc-800">{day.day}</span>
            <div className="text-sm">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{day.topic}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-600 marker:text-zinc-400 dark:text-zinc-400">
                {day.activities.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  return null;
};

const QuickActions = ({ documentId }) => {
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async (tool, value = '') => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let res;
      if (tool.id === 'summarize') res = await assistantAPI.summarizeDocument(documentId, 'brief');
      if (tool.id === 'explain') res = await assistantAPI.explainConcept(documentId, value);
      if (tool.id === 'practice') res = await assistantAPI.generatePractice(documentId, value || 'general', 5);
      if (tool.id === 'study-plan') {
        res = await assistantAPI.createStudyPlan(documentId, value.split(',').map((a) => a.trim()).filter(Boolean), 7);
      }
      setResult({ type: tool.id, title: tool.name, data: res.data });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setActive(null);
      setDraft('');
    }
  };

  const activeTool = TOOLS.find((t) => t.id === active);

  return (
    <aside className="space-y-4">
      <section className="card">
        <div className="card-header py-3">
          <h2 className="card-title">Study tools</h2>
        </div>
        <ul className="p-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <li key={tool.id}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError(null);
                    if (tool.prompt) {
                      setActive(active === tool.id ? null : tool.id);
                      setDraft('');
                    } else {
                      run(tool);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800 ${
                    active === tool.id ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{tool.name}</span>
                    <span className="muted block text-xs">{tool.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />
                </button>
                {activeTool?.id === tool.id && (
                  <form
                    className="flex gap-2 px-3 pb-3 pt-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (draft.trim() || tool.optional) run(tool, draft.trim());
                    }}
                  >
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={tool.placeholder}
                      aria-label={tool.prompt}
                      maxLength={200}
                      className="input py-1.5"
                    />
                    <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.trim() && !tool.optional}>Go</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {(loading || result || error) && (
        <section className="card animate-fade-in">
          <div className="card-header py-3">
            <h2 className="card-title">{loading ? 'Working…' : error ? 'Something went wrong' : result.title}</h2>
            {!loading && (
              <button type="button" className="btn btn-ghost btn-icon -mr-2" onClick={() => { setResult(null); setError(null); }} aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="max-h-[28rem] overflow-y-auto p-5">
            {loading && <LoadingSpinner size="small" label="Reading your document" className="justify-start" />}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {result && <Result result={result} />}
          </div>
        </section>
      )}
    </aside>
  );
};

export default QuickActions;

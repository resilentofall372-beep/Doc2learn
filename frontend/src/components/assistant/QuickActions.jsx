import React, { useState } from 'react';
import { assistantAPI, errorMessage } from '../../services/api';

const ACTIONS = [
  { id: 'summarize', name: 'Summarize', icon: '📝', description: 'Brief overview and key points', color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200' },
  { id: 'explain', name: 'Explain a concept', icon: '💡', description: 'Definition, example, misconception', color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200', input: 'Which concept?' },
  { id: 'practice', name: 'Practice problems', icon: '✍️', description: 'Open questions with hints', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200', input: 'Topic (or "general")' },
  { id: 'study-plan', name: 'Study plan', icon: '📅', description: 'A week, weighted to weak spots', color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200', input: 'Weak areas, comma separated' },
];

const Pages = ({ pages }) =>
  pages?.length ? <p className="mt-2 text-xs opacity-70">Sources: {pages.map((p) => `p. ${p}`).join(', ')}</p> : null;

const QuickActions = ({ documentId }) => {
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (actionId, value) => {
    setLoading(true);
    setResult(null);
    try {
      let res;
      if (actionId === 'summarize') res = await assistantAPI.summarizeDocument(documentId, 'brief');
      if (actionId === 'explain') res = await assistantAPI.explainConcept(documentId, value);
      if (actionId === 'practice') res = await assistantAPI.generatePractice(documentId, value || 'general', 5);
      if (actionId === 'study-plan') {
        const areas = value.split(',').map((a) => a.trim()).filter(Boolean);
        res = await assistantAPI.createStudyPlan(documentId, areas, 7);
      }
      setResult({ type: actionId, data: res.data });
    } catch (error) {
      setResult({ type: 'error', message: errorMessage(error) });
    } finally {
      setLoading(false);
      setActive(null);
      setDraft('');
    }
  };

  const onPick = (action) => {
    setResult(null);
    if (action.input) {
      setActive(action.id);
      setDraft('');
    } else {
      run(action.id);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    if (result.type === 'error') {
      return <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">{result.message}</div>;
    }
    if (result.type === 'summarize') {
      return (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">Summary</h4>
          <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap">{result.data.summary}</p>
          {result.data.key_points?.length > 0 && (
            <ul className="mt-3 text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              {result.data.key_points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          )}
        </div>
      );
    }
    if (result.type === 'explain') {
      return (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">{result.data.concept}</h4>
          <div className="text-sm text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap">{result.data.explanation}</div>
          <Pages pages={result.data.sources} />
        </div>
      );
    }
    if (result.type === 'practice') {
      return (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg max-h-96 overflow-y-auto">
          <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">Practice: {result.data.topic}</h4>
          <div className="space-y-3">
            {result.data.problems.map((problem, idx) => (
              <div key={problem.question} className="p-3 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">Question {idx + 1}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{problem.question}</p>
                <details className="mt-2"><summary className="text-xs text-green-600 dark:text-green-400 cursor-pointer">Hint</summary><p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{problem.hint}</p></details>
                <details className="mt-1"><summary className="text-xs text-green-600 dark:text-green-400 cursor-pointer">Answer</summary><p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{problem.answer}</p></details>
              </div>
            ))}
          </div>
        </div>
      );
    }
    if (result.type === 'study-plan') {
      return (
        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg max-h-96 overflow-y-auto">
          <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">{result.data.duration_days}-day plan</h4>
          <div className="space-y-2">
            {result.data.plan.map((day) => (
              <div key={day.day} className="p-3 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700">
                <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">Day {day.day}: {day.topic}</p>
                <ul className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-0.5 list-disc list-inside">
                  {day.activities.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const activeAction = ACTIONS.find((a) => a.id === active);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Quick actions</h3>
        <div className="space-y-2">
          {ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onPick(action)}
              disabled={loading}
              className={`w-full text-left p-3 rounded-lg transition ${action.color} hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${active === action.id ? 'ring-2 ring-indigo-400' : ''}`}
            >
              <div className="flex items-start space-x-2">
                <span className="text-2xl">{action.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{action.name}</p>
                  <p className="text-xs opacity-75">{action.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {activeAction && (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) run(activeAction.id, draft.trim());
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={activeAction.input}
              maxLength={200}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <button type="submit" className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Go</button>
          </form>
        )}

        {loading && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Working…</p>
          </div>
        )}
        {renderResult()}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">How the tutor works</h3>
        <p>It retrieves the most relevant passages from your document and answers only from those.</p>
        <p>Page numbers in square brackets show where an answer came from, so you can check it.</p>
        <p>If the document does not cover something, it says so rather than guessing.</p>
      </div>
    </div>
  );
};

export default QuickActions;

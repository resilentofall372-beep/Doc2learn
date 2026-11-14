import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { documentAPI, errorMessage, quizAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { QUIZ_PREFERENCES } from '../utils/constants';
import ProjectLayout from '../components/projects/ProjectLayout';
import ScopePicker from '../components/projects/ScopePicker';
import TopicPicker, { useTopics } from '../components/projects/TopicPicker';
import QuizQuestion from '../components/quiz/QuizQuestion';
import QuizProgress from '../components/quiz/QuizProgress';
import QuizResults from '../components/quiz/QuizResults';
import Segmented from '../components/ui/Segmented';
import { sourceLabel } from '../components/ui/RichText';
import { PageLoader } from '../components/common/LoadingSpinner';

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy', hint: 'Recall' },
  { value: 'medium', label: 'Medium', hint: 'Understanding' },
  { value: 'hard', label: 'Hard', hint: 'Analysis' },
];

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const sourceOf = (item) =>
  item.source_document ? { filename: item.source_document.filename, page: item.source_page } : item.source_page ? { page: item.source_page } : null;

const Quiz = ({ projectId, documents }) => {
  const { addNotification } = useApp();
  const [params] = useSearchParams();

  const [phase, setPhase] = useState('settings'); // settings | generating | quiz | submitting | results
  const [documentId, setDocumentId] = useState(() => {
    const wanted = params.get('document');
    return documents.some((d) => d._id === wanted) ? wanted : '';
  });
  const { topics, titles: topicTitles, loaded: topicsLoaded } = useTopics(projectId);
  const [topicId, setTopicId] = useState(() => params.get('topic') || '');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [focus, setFocus] = useState('');
  const [quizId, setQuizId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  // Drop a ?topic= that isn't in the outline (e.g. after a rebuild).
  useEffect(() => {
    if (topicsLoaded && topicId && !topicTitles[topicId]) setTopicId('');
  }, [topicsLoaded, topicId, topicTitles]);

  const startTimer = () => {
    clearInterval(timer.current);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const generate = async () => {
    setPhase('generating');
    setError(null);
    try {
      const res = await documentAPI.generateQuiz({
        projectId,
        documentId: documentId || null,
        topicId: topicId || null,
        num_questions: numQuestions,
        difficulty,
        focus: topicId ? undefined : focus.trim() || undefined,
      });
      setQuizId(res.data.quiz_id);
      setQuestions(res.data.questions);
      setAnswers({});
      setCurrent(0);
      setElapsed(0);
      setPhase('quiz');
      startTimer();
    } catch (err) {
      setError(errorMessage(err, 'Could not generate a quiz'));
      setPhase('settings');
    }
  };

  const submit = async () => {
    clearInterval(timer.current);
    setPhase('submitting');
    try {
      const res = await quizAPI.submitQuiz({ quiz_id: quizId, answers, time_spent_seconds: elapsed });
      const { score, total, percentage, results: graded } = res.data;
      setResults({
        score,
        total,
        percentage,
        timeSpent: formatTime(elapsed),
        questions: graded.map((r) => ({
          question: r.question,
          options: r.options,
          answer: r.correct_answer,
          userAnswer: r.user_answer,
          isCorrect: r.is_correct,
          explanation: r.explanation,
          source: sourceOf(r),
          topic: topicTitles[r.topic_id] || null,
        })),
      });
      setPhase('results');
    } catch (err) {
      addNotification({ type: 'error', title: 'Could not save results', message: errorMessage(err) });
      setPhase('quiz');
      startTimer();
    }
  };

  const restart = () => {
    setPhase('settings');
    setQuestions([]);
    setResults(null);
    setAnswers({});
    setQuizId(null);
  };

  if (phase === 'generating') return <PageLoader label="Writing questions from your documents…" />;
  if (phase === 'submitting') return <PageLoader label="Grading…" />;
  if (phase === 'results' && results) return <QuizResults results={results} onRestart={restart} projectId={projectId} />;

  if (phase === 'settings') {
    return (
      <section className="card mx-auto max-w-xl">
        <div className="card-header">
          <div>
            <h2 className="card-title">New quiz</h2>
            <p className="muted mt-0.5 text-xs">Every question comes from your documents and notes which file and page it&apos;s from.</p>
          </div>
        </div>
        <div className="space-y-6 p-5">
          {error && <div className="alert alert-danger">{error}</div>}
          {topicsLoaded && <TopicPicker id="quiz-topic" label="Topic" projectId={projectId} topics={topics} value={topicId} onChange={setTopicId} />}
          {documents.length > 1 && <ScopePicker id="quiz-scope" label="Questions from" documents={documents} value={documentId} onChange={setDocumentId} />}
          <Segmented
            id="count-label"
            label="Questions"
            value={numQuestions}
            onChange={setNumQuestions}
            options={QUIZ_PREFERENCES.QUESTION_COUNTS.map((n) => ({ value: n, label: String(n) }))}
          />
          <Segmented id="difficulty-label" label="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTIONS} />
          {!topicId && <div>
            <label htmlFor="focus" className="label">
              Focus <span className="font-normal text-zinc-400">(optional)</span>
            </label>
            <input
              id="focus"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              maxLength={200}
              placeholder="A topic or chapter, e.g. the Calvin cycle"
              className="input"
            />
          </div>}
        </div>
        <div className="flex justify-end border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={generate} className="btn btn-primary">
            Start quiz
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  const question = questions[current];
  const isLast = current === questions.length - 1;
  const answeredCount = Object.keys(answers).length;
  const source = sourceOf(question);
  return (
    <section className="card mx-auto max-w-2xl">
      <div className="space-y-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Question {current + 1} <span className="muted font-normal">of {questions.length}</span>
          </span>
          <span className="muted inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(elapsed)}
          </span>
        </div>
        <QuizProgress current={answeredCount} total={questions.length} />
      </div>
      <div className="px-6 py-6">
        {topicTitles[question.topic_id] && <p className="eyebrow mb-2">{topicTitles[question.topic_id]}</p>}
        <QuizQuestion
          question={question}
          selectedAnswer={answers[current]}
          onAnswerSelect={(answer) => setAnswers((prev) => ({ ...prev, [current]: answer }))}
        />
        {source && <p className="mt-4 text-xs text-zinc-400">Based on {sourceLabel(source)}</p>}
      </div>
      <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <button type="button" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0} className="btn btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => (isLast ? submit() : setCurrent((c) => c + 1))}
          disabled={!answers[current]}
          className="btn btn-primary"
        >
          {isLast ? 'Submit answers' : 'Next'}
          {!isLast && <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
};

const QuizPage = () => {
  const { projectId } = useParams();
  return <ProjectLayout>{({ documents }) => <Quiz projectId={projectId} documents={documents} />}</ProjectLayout>;
};

export default QuizPage;

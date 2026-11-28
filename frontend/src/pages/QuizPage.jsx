import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { documentAPI, errorMessage, quizAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { DIFFICULTY_OPTIONS, QUIZ_PREFERENCES } from '../utils/constants';
import ProjectLayout from '../components/projects/ProjectLayout';
import ScopePicker from '../components/projects/ScopePicker';
import TopicPicker from '../components/projects/TopicPicker';
import { useTopics } from '../hooks/useTopics';
import PracticeNav from '../components/projects/PracticeNav';
import QuizQuestion from '../components/quiz/QuizQuestion';
import QuizProgress from '../components/quiz/QuizProgress';
import QuizResults from '../components/quiz/QuizResults';
import Segmented from '../components/ui/Segmented';
import { SourceChips } from '../components/ui/RichText';
import LoadingSpinner, { PageLoader } from '../components/common/LoadingSpinner';
import { itemSource } from '../utils/progress';

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const sourceOf = itemSource;

/** Outline of a question card while the first question is being written. */
const QuestionSkeleton = () => (
  <section className="card mx-auto max-w-2xl" aria-busy="true">
    <div className="space-y-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <div className="flex justify-between">
        <div className="skeleton h-4 w-28" />
        <div className="skeleton h-4 w-12" />
      </div>
      <div className="skeleton h-1.5 w-full" />
    </div>
    <div className="space-y-3 px-6 py-6">
      <div className="skeleton h-5 w-11/12" />
      <div className="skeleton h-5 w-2/3" />
      <div className="space-y-2.5 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-11 w-full rounded-lg" />
        ))}
      </div>
      <p className="muted pt-2 text-center text-sm">Writing the first question from your documents…</p>
    </div>
  </section>
);

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
  const [difficulty, setDifficulty] = useState(() =>
    ['easy', 'medium', 'hard'].includes(params.get('difficulty')) ? params.get('difficulty') : 'medium'
  );
  const [quizId, setQuizId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [pending, setPending] = useState(0); // questions still being written in the background
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);
  const activeQuiz = useRef(null); // questions written in the background only join the quiz they were for

  useEffect(() => () => clearInterval(timer.current), []);

  // Drop a ?topic= that isn't in the outline (e.g. after a rebuild).
  useEffect(() => {
    if (topicsLoaded && topicId && !topicTitles[topicId]) setTopicId('');
  }, [topicsLoaded, topicId, topicTitles]);

  const startTimer = () => {
    clearInterval(timer.current);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  // The first question is written on its own so the learner can start in a few seconds;
  // the rest are added to the same quiz in the background.
  const generate = async () => {
    setPhase('generating');
    setError(null);
    try {
      const res = await documentAPI.generateQuiz({
        projectId,
        documentId: documentId || null,
        topicId: topicId || null,
        num_questions: 1,
        difficulty,
      });
      const id = res.data.quiz_id;
      activeQuiz.current = id;
      const rest = Math.max(0, numQuestions - res.data.questions.length);
      setQuizId(id);
      setQuestions(res.data.questions);
      setPending(rest);
      setAnswers({});
      setCurrent(0);
      setElapsed(0);
      setPhase('quiz');
      startTimer();
      if (rest) {
        documentAPI
          .extendQuiz(id, rest)
          .then((more) => {
            if (activeQuiz.current !== id) return;
            const added = more.data.questions || [];
            setQuestions((prev) => [...prev, ...added]);
            if (added.length < rest) {
              addNotification({ type: 'info', title: 'Shorter quiz', message: `Only ${1 + added.length} questions could be written this time.` });
            }
          })
          .catch(() => {
            if (activeQuiz.current === id) {
              addNotification({ type: 'info', title: 'Shorter quiz', message: 'The other questions could not be written. You can still submit this one.' });
            }
          })
          .finally(() => activeQuiz.current === id && setPending(0));
      }
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
    activeQuiz.current = null;
    setPending(0);
    setPhase('settings');
    setQuestions([]);
    setResults(null);
    setAnswers({});
    setQuizId(null);
  };

  if (phase === 'generating') return <QuestionSkeleton />;
  if (phase === 'submitting') return <PageLoader label="Grading…" />;
  if (phase === 'results' && results) return <QuizResults results={results} onRestart={restart} projectId={projectId} />;

  if (phase === 'settings') {
    return (
      <>
      <PracticeNav projectId={projectId} />
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
        </div>
        <div className="flex justify-end border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={generate} className="btn btn-primary">
            Start quiz
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
      </>
    );
  }

  const question = questions[current];
  const total = questions.length + pending;
  const waitingForNext = current === questions.length - 1 && pending > 0;
  const isLast = current === questions.length - 1 && pending === 0;
  const answeredCount = Object.keys(answers).length;
  const source = sourceOf(question);
  return (
    <section className="card mx-auto max-w-2xl">
      <div className="space-y-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Question {current + 1} <span className="muted font-normal">of {total}</span>
          </span>
          <span className="muted inline-flex items-center gap-1.5 tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(elapsed)}
          </span>
        </div>
        <QuizProgress current={answeredCount} total={total} />
      </div>
      <div className="px-6 py-6">
        {topicTitles[question.topic_id] && <p className="eyebrow mb-2">{topicTitles[question.topic_id]}</p>}
        <QuizQuestion
          question={question}
          selectedAnswer={answers[current]}
          onAnswerSelect={(answer) => setAnswers((prev) => ({ ...prev, [current]: answer }))}
        />
        {source && <SourceChips sources={[source]} label="Based on" className="mt-4" />}
      </div>
      <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <button type="button" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0} className="btn btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => (isLast ? submit() : setCurrent((c) => c + 1))}
          disabled={!answers[current] || waitingForNext}
          className="btn btn-primary"
        >
          {waitingForNext ? (
            <>
              <LoadingSpinner size="small" />
              Writing the next question…
            </>
          ) : (
            <>
              {isLast ? 'Submit answers' : 'Next'}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </>
          )}
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

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { documentAPI, errorMessage, quizAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { QUIZ_PREFERENCES } from '../utils/constants';
import QuizQuestion from '../components/quiz/QuizQuestion';
import QuizProgress from '../components/quiz/QuizProgress';
import QuizResults from '../components/quiz/QuizResults';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DIFFICULTY_STYLES = {
  easy: { label: 'Easy', icon: '😊', active: 'border-green-600 bg-green-50 text-green-700' },
  medium: { label: 'Medium', icon: '🤔', active: 'border-yellow-600 bg-yellow-50 text-yellow-700' },
  hard: { label: 'Hard', icon: '🔥', active: 'border-red-600 bg-red-50 text-red-700' },
};

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const QuizPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useApp();

  const [phase, setPhase] = useState('settings'); // settings | generating | quiz | submitting | results
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

  const startTimer = () => {
    clearInterval(timer.current);
    setElapsed(0);
    timer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const generate = async () => {
    setPhase('generating');
    setError(null);
    try {
      const res = await documentAPI.generateQuiz({
        document_id: documentId,
        num_questions: numQuestions,
        difficulty,
        focus: focus.trim() || undefined,
      });
      setQuizId(res.data.quiz_id);
      setQuestions(res.data.questions);
      setAnswers({});
      setCurrent(0);
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
          sourcePage: r.source_page,
        })),
      });
      setPhase('results');
      addNotification({ type: 'success', title: 'Quiz complete', message: `You scored ${score}/${total} (${percentage}%)` });
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

  if (phase === 'generating' || phase === 'submitting') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
        <span className="ml-4 text-gray-600">
          {phase === 'generating' ? 'Writing questions from your document…' : 'Grading…'}
        </span>
      </div>
    );
  }

  if (phase === 'results' && results) {
    return <QuizResults results={results} onRestart={restart} onDashboard={() => navigate('/dashboard')} />;
  }

  if (phase === 'settings') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg border p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Set up your quiz</h2>
            <p className="text-gray-600">Questions are written from your document and cite the page they come from.</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">{error}</div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of questions</label>
              <div className="grid grid-cols-5 gap-3">
                {QUIZ_PREFERENCES.QUESTION_COUNTS.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNumQuestions(num)}
                    className={`py-3 px-4 rounded-lg border-2 transition-all ${
                      numQuestions === num
                        ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <div className="grid grid-cols-3 gap-3">
                {QUIZ_PREFERENCES.DIFFICULTY_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level)}
                    className={`py-4 px-4 rounded-lg border-2 transition-all ${
                      difficulty === level ? DIFFICULTY_STYLES[level].active : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    <div className="text-2xl mb-1">{DIFFICULTY_STYLES[level].icon}</div>
                    <div className="font-semibold">{DIFFICULTY_STYLES[level].label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="focus" className="block text-sm font-medium text-gray-700 mb-2">
                Focus on a topic <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                id="focus"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                maxLength={200}
                placeholder="e.g. the Calvin cycle, chapter 3, sorting algorithms"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="mt-8 flex space-x-4">
            <button
              type="button"
              onClick={generate}
              className="flex-1 bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 transition-colors font-semibold"
            >
              Start quiz
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = questions[current];
  const isLast = current === questions.length - 1;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Quiz</h1>
          <div className="text-sm text-gray-600">Time: {formatTime(elapsed)}</div>
        </div>
        <QuizProgress current={current + 1} total={questions.length} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <QuizQuestion
          question={question}
          questionNumber={current + 1}
          selectedAnswer={answers[current]}
          onAnswerSelect={(answer) => setAnswers((prev) => ({ ...prev, [current]: answer }))}
        />
        {question.source_page && (
          <p className="mt-4 text-xs text-gray-400">Based on page {question.source_page}</p>
        )}

        <div className="flex justify-between mt-8">
          <button
            type="button"
            onClick={() => setCurrent((c) => c - 1)}
            disabled={current === 0}
            className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => (isLast ? submit() : setCurrent((c) => c + 1))}
            disabled={!answers[current]}
            className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLast ? 'Submit quiz' : 'Next question'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;

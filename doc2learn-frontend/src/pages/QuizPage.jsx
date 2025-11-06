import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentAPI, quizAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../hooks/useAuth';
import QuizQuestion from '../components/quiz/QuizQuestion';
import QuizProgress from '../components/quiz/QuizProgress';
import QuizResults from '../components/quiz/QuizResults';
import LoadingSpinner from '../components/common/LoadingSpinner';

const QuizPage = () => {
  const { id: documentId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [results, setResults] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);
  const { addNotification } = useApp();
  const { user } = useAuth();
  
  // Quiz settings
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');

  useEffect(() => {
    setLoading(false);
    // Don't auto-generate - wait for user to configure and start
  }, [documentId]);

  const generateQuiz = async () => {
    try {
      setGenerating(true);
      setShowSettings(false);
      
      // First, get the document text
      const docResponse = await documentAPI.getDocument(documentId);
      const document = docResponse.data.document || docResponse.data;
      const documentText = document.extracted_text || document.text || 'Sample document text for quiz generation';
      
      console.log('📄 Document data:', document);
      console.log('📝 Document text length:', documentText.length);
      console.log('🎯 Quiz Settings:', { numQuestions, difficulty });
      
      // Generate quiz questions with user-selected settings
      const quizResponse = await documentAPI.generateQuiz({
        text: documentText,
        document_id: documentId,
        num_questions: numQuestions,
        difficulty: difficulty
      });
      
      console.log('✅ Received questions:', quizResponse.data.questions?.length);
      
      setQuestions(quizResponse.data.questions || []);
      
      // Start timer after quiz is generated
      const interval = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);
      
      // Store interval ID to clear later
      window.quizTimer = interval;
      
    } catch (error) {
      console.error('Error generating quiz:', error);
      addNotification({
        type: 'error',
        title: 'Quiz Generation Failed',
        message: 'Could not generate quiz questions. Using sample questions.'
      });
      
      // Fallback sample questions
      setQuestions([
        {
          question: "What is the main topic of this document?",
          options: {
            A: "Introduction to Programming",
            B: "Machine Learning Basics",
            C: "Data Structures",
            D: "Web Development"
          },
          answer: "A",
          explanation: "The document focuses on programming fundamentals."
        },
        {
          question: "Which concept is most important for beginners?",
          options: {
            A: "Advanced Algorithms",
            B: "Basic Syntax",
            C: "Database Design",
            D: "Cloud Computing"
          },
          answer: "B",
          explanation: "Understanding basic syntax is crucial for beginners."
        },
        {
          question: "What should you practice regularly?",
          options: {
            A: "Only reading theory",
            B: "Writing code and solving problems",
            C: "Watching tutorials",
            D: "Attending lectures"
          },
          answer: "B",
          explanation: "Practical coding experience is essential for learning."
        }
      ]);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  const handleAnswerSelect = (questionIndex, answer) => {
    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      handleSubmitQuiz();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    try {
      // Calculate score
      const score = questions.reduce((acc, question, index) => {
        return acc + (userAnswers[index] === question.answer ? 1 : 0);
      }, 0);

      const quizResults = {
        score,
        total: questions.length,
        percentage: Math.round((score / questions.length) * 100),
        answers: userAnswers,
        questions: questions.map((q, index) => ({
          ...q,
          userAnswer: userAnswers[index],
          isCorrect: userAnswers[index] === q.answer
        })),
        timeSpent: formatTime(timeSpent),
        documentId,
        userId: user?.user_id
      };

      setResults(quizResults);
      setQuizCompleted(true);

      // Submit results to backend
      await quizAPI.submitQuiz({
        documentId,
        results: quizResults
      });

      addNotification({
        type: 'success',
        title: 'Quiz Completed!',
        message: `You scored ${score}/${questions.length} (${quizResults.percentage}%)`
      });

    } catch (error) {
      console.error('Error submitting quiz:', error);
      addNotification({
        type: 'error',
        title: 'Submission Failed',
        message: 'Could not save quiz results'
      });
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setUserAnswers({});
    setQuizCompleted(false);
    setResults(null);
    setTimeSpent(0);
    setQuestions([]);
    setShowSettings(true);
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  if (loading || generating) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
        <span className="ml-4 text-gray-600">
          {generating ? 'Generating quiz questions...' : 'Loading...'}
        </span>
      </div>
    );
  }
  
  // Show settings screen before quiz
  if (showSettings && questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg border p-8">
          <div className="text-center mb-8">
            <div className="inline-block p-3 bg-primary-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Configure Your Quiz</h2>
            <p className="text-gray-600">Customize the quiz settings before you start</p>
          </div>

          <div className="space-y-6">
            {/* Number of Questions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Questions
              </label>
              <div className="grid grid-cols-5 gap-3">
                {[3, 5, 10, 15, 20].map((num) => (
                  <button
                    key={num}
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

            {/* Difficulty Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'easy', label: 'Easy', icon: '😊', color: 'green' },
                  { value: 'medium', label: 'Medium', icon: '🤔', color: 'yellow' },
                  { value: 'hard', label: 'Hard', icon: '🔥', color: 'red' }
                ].map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setDifficulty(level.value)}
                    className={`py-4 px-4 rounded-lg border-2 transition-all ${
                      difficulty === level.value
                        ? `border-${level.color}-600 bg-${level.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{level.icon}</div>
                    <div className={`font-semibold ${
                      difficulty === level.value ? `text-${level.color}-700` : 'text-gray-700'
                    }`}>
                      {level.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Quiz Configuration:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>Questions: {numQuestions} multiple-choice questions</li>
                    <li>Difficulty: {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</li>
                    <li>AI-powered question generation from your document</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex space-x-4">
            <button
              onClick={generateQuiz}
              disabled={generating}
              className="flex-1 bg-primary-600 text-white py-3 px-6 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-semibold flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>Start Quiz</span>
            </button>
            <button
              onClick={goToDashboard}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (quizCompleted && results) {
    return <QuizResults results={results} onRestart={restartQuiz} onDashboard={goToDashboard} />;
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Questions Available</h3>
        <p className="text-gray-500 mb-4">Could not generate quiz questions for this document.</p>
        <div className="space-x-4">
          <button
            onClick={generateQuiz}
            className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={goToDashboard}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Quiz Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Document Quiz</h1>
          <div className="text-sm text-gray-600">
            Time: {formatTime(timeSpent)}
          </div>
        </div>
        
        <QuizProgress
          current={currentQuestion + 1}
          total={questions.length}
        />
      </div>
      
      {/* Quiz Content */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <QuizQuestion
          question={currentQ}
          questionNumber={currentQuestion + 1}
          selectedAnswer={userAnswers[currentQuestion]}
          onAnswerSelect={(answer) => handleAnswerSelect(currentQuestion, answer)}
        />

        <div className="flex justify-between mt-8">
          <button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          
          <button
            onClick={handleNext}
            disabled={!userAnswers[currentQuestion]}
            className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {currentQuestion === questions.length - 1 ? 'Submit Quiz' : 'Next Question'}
          </button>
        </div>
      </div>

      {/* Quiz Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Quiz Tips</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>• Read each question carefully before answering</p>
              <p>• You can navigate between questions using Previous/Next buttons</p>
              <p>• Your progress is automatically saved</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
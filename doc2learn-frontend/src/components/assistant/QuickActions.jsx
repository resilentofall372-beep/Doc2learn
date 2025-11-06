// src/components/assistant/QuickActions.jsx
import React, { useState } from 'react';
import { assistantAPI } from '../../services/api';

const QuickActions = ({ documentId, userId }) => {
  const [activeAction, setActiveAction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const actions = [
    {
      id: 'summarize',
      name: 'Summarize',
      icon: '📝',
      description: 'Get a quick summary',
      color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
    },
    {
      id: 'explain',
      name: 'Explain Concept',
      icon: '💡',
      description: 'Understand a topic',
      color: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200',
    },
    {
      id: 'practice',
      name: 'Practice Problems',
      icon: '✍️',
      description: 'Test your knowledge',
      color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200',
    },
    {
      id: 'study-plan',
      name: 'Study Plan',
      icon: '📅',
      description: 'Get a personalized plan',
      color: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200',
    },
  ];
  
  const handleSummarize = async (type = 'brief') => {
    setLoading(true);
    setActiveAction('summarize');
    try {
      const response = await assistantAPI.summarizeDocument(documentId, type);
      setResult({
        type: 'summarize',
        data: response.data,
      });
    } catch (error) {
      console.error('Error summarizing:', error);
      setResult({
        type: 'error',
        message: 'Failed to generate summary',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleExplain = async (concept) => {
    if (!concept.trim()) return;
    
    setLoading(true);
    setActiveAction('explain');
    try {
      const response = await assistantAPI.explainConcept(documentId, concept);
      setResult({
        type: 'explain',
        data: response.data,
      });
    } catch (error) {
      console.error('Error explaining:', error);
      setResult({
        type: 'error',
        message: 'Failed to explain concept',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handlePractice = async (topic, num = 5) => {
    setLoading(true);
    setActiveAction('practice');
    try {
      const response = await assistantAPI.generatePractice(documentId, topic, num);
      setResult({
        type: 'practice',
        data: response.data,
      });
    } catch (error) {
      console.error('Error generating practice:', error);
      setResult({
        type: 'error',
        message: 'Failed to generate practice problems',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleStudyPlan = async (weakAreas, days = 7) => {
    setLoading(true);
    setActiveAction('study-plan');
    try {
      const response = await assistantAPI.createStudyPlan(documentId, userId, weakAreas, days);
      setResult({
        type: 'study-plan',
        data: response.data,
      });
    } catch (error) {
      console.error('Error creating study plan:', error);
      setResult({
        type: 'error',
        message: 'Failed to create study plan',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const renderResult = () => {
    if (!result) return null;
    
    if (result.type === 'error') {
      return (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{result.message}</p>
        </div>
      );
    }
    
    if (result.type === 'summarize') {
      return (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">📝 Summary</h4>
          <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap">
            {result.data.summary}
          </p>
          {result.data.key_points && result.data.key_points.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">Key Points:</p>
              <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                {result.data.key_points.map((point, idx) => (
                  <li key={idx}>• {point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }
    
    if (result.type === 'explain') {
      return (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
            💡 {result.data.concept}
          </h4>
          <div className="text-sm text-yellow-800 dark:text-yellow-300 whitespace-pre-wrap">
            {result.data.explanation}
          </div>
        </div>
      );
    }
    
    if (result.type === 'practice') {
      return (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg max-h-96 overflow-y-auto">
          <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
            ✍️ Practice Problems ({result.data.total})
          </h4>
          <div className="space-y-3">
            {result.data.problems.map((problem, idx) => (
              <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                  Question {idx + 1}:
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{problem.question}</p>
                <details className="mt-2">
                  <summary className="text-xs text-green-600 dark:text-green-400 cursor-pointer hover:underline">
                    Show hint
                  </summary>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{problem.hint}</p>
                </details>
                <details className="mt-1">
                  <summary className="text-xs text-green-600 dark:text-green-400 cursor-pointer hover:underline">
                    Show answer
                  </summary>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{problem.answer}</p>
                </details>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (result.type === 'study-plan') {
      return (
        <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg max-h-96 overflow-y-auto">
          <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
            📅 {result.data.duration_days}-Day Study Plan
          </h4>
          <div className="space-y-2">
            {result.data.plan.map((day, idx) => (
              <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700">
                <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                  Day {day.day}: {day.topic}
                </p>
                <ul className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-0.5">
                  {day.activities.map((activity, aidx) => (
                    <li key={aidx}>• {activity}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="space-y-4">
      {/* Quick Actions Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
          <span className="mr-2">⚡</span>
          Quick Actions
        </h3>
        
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                setActiveAction(action.id);
                setResult(null);
                
                // Simple prompts for each action
                if (action.id === 'summarize') {
                  handleSummarize('brief');
                } else if (action.id === 'explain') {
                  const concept = prompt('Enter concept to explain:');
                  if (concept) handleExplain(concept);
                } else if (action.id === 'practice') {
                  const topic = prompt('Enter topic for practice:', 'general');
                  if (topic) handlePractice(topic, 5);
                } else if (action.id === 'study-plan') {
                  const weakAreas = prompt('Enter weak areas (comma separated):', 'general concepts');
                  if (weakAreas) handleStudyPlan(weakAreas.split(',').map(a => a.trim()), 7);
                }
              }}
              disabled={loading}
              className={`w-full text-left p-3 rounded-lg transition ${action.color} hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
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
        
        {loading && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Processing...</p>
          </div>
        )}
        
        {renderResult()}
      </div>
      
      {/* Tips Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
          <span className="mr-2">💡</span>
          Tips
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Ask specific questions for better answers</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Request examples or analogies</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Use "Explain like I'm 5" for simple explanations</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Ask follow-up questions for clarity</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default QuickActions;

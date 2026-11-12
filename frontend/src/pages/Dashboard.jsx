import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { documentAPI, errorMessage, statsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../hooks/useAuth';
import DocumentUpload from '../components/document/DocumentUpload';
import DocumentList from '../components/document/DocumentList';
import StatsCard from '../components/dashboard/StatsCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

const EMPTY_STATS = {
  total_documents: 0,
  quizzes_taken: 0,
  average_score: 0,
  study_time_label: '0s',
  weakest_documents: [],
};

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useApp();
  const { user } = useAuth();

  const load = useCallback(async () => {
    try {
      const [docsRes, statsRes] = await Promise.all([documentAPI.getDocuments(), statsAPI.me()]);
      setDocuments(docsRes.data.documents || []);
      setStats(statsRes.data.stats || EMPTY_STATS);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load dashboard', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUploaded = (document) => {
    setDocuments((prev) => [document, ...prev]);
    setStats((prev) => ({ ...prev, total_documents: prev.total_documents + 1 }));
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`Delete "${document.filename}" and everything generated from it?`)) return;
    try {
      await documentAPI.deleteDocument(document._id);
      setDocuments((prev) => prev.filter((d) => d._id !== document._id));
      addNotification({ type: 'success', title: 'Deleted', message: `${document.filename} removed` });
      statsAPI.me().then((res) => setStats(res.data.stats)).catch(() => {});
    } catch (error) {
      addNotification({ type: 'error', title: 'Delete failed', message: errorMessage(error) });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg text-white p-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">Welcome back, {user?.name || 'Student'}!</h1>
            <p className="text-primary-100 text-lg">Upload notes, then quiz, review and chat about them.</p>
          </div>
          <Link
            to="/study-rooms"
            className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Live quiz rooms
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Documents" value={stats.total_documents} icon="📚" color="blue" />
        <StatsCard title="Quizzes taken" value={stats.quizzes_taken} icon="📝" color="green" />
        <StatsCard
          title="Average score"
          value={stats.quizzes_taken ? `${stats.average_score}%` : '—'}
          icon="🎯"
          color="purple"
        />
        <StatsCard title="Time in quizzes" value={stats.study_time_label} icon="⏱️" color="orange" />
      </div>

      {stats.weakest_documents?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-amber-900 mb-3">Worth another look</h2>
          <ul className="space-y-2">
            {stats.weakest_documents.map((row) => (
              <li key={row.document_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-amber-900">
                  <span className="font-medium">{row.filename}</span>
                  <span className="text-amber-700">
                    {' '}
                    · {row.average_score}% average over {row.attempts} attempt{row.attempts === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Link to={`/document/${row.document_id}/chat`} className="text-indigo-700 hover:underline">
                    Ask the tutor
                  </Link>
                  <Link to={`/document/${row.document_id}/quiz`} className="text-indigo-700 hover:underline">
                    Retry quiz
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-heading font-semibold text-gray-900 mb-4">Upload a document</h2>
        <DocumentUpload onUpload={handleUploaded} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-heading font-semibold text-gray-900">Your documents ({documents.length})</h2>
          {documents.length > 0 && (
            <Link
              to="/create-quiz-room"
              className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Host a live quiz
            </Link>
          )}
        </div>
        <DocumentList documents={documents} onDelete={handleDelete} />
      </div>
    </div>
  );
};

export default Dashboard;

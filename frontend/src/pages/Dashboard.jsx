import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, FileText, Library, ListChecks, Radio, Target } from 'lucide-react';
import { documentAPI, errorMessage, statsAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import DocumentUpload from '../components/document/DocumentUpload';
import DocumentList from '../components/document/DocumentList';
import { forgetDocument } from '../components/document/DocumentLayout';
import StatsCard from '../components/dashboard/StatsCard';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { PageLoader } from '../components/common/LoadingSpinner';

const EMPTY_STATS = { total_documents: 0, quizzes_taken: 0, average_score: 0, study_time_label: '0m', weakest_documents: [] };

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const { addNotification } = useApp();
  const { user } = useAuth();

  const refreshStats = useCallback(() => statsAPI.me().then((res) => setStats(res.data.stats)).catch(() => {}), []);

  useEffect(() => {
    Promise.all([documentAPI.getDocuments(), statsAPI.me()])
      .then(([docsRes, statsRes]) => {
        setDocuments(docsRes.data.documents || []);
        setStats(statsRes.data.stats || EMPTY_STATS);
      })
      .catch((error) => addNotification({ type: 'error', title: 'Could not load your library', message: errorMessage(error) }))
      .finally(() => setLoading(false));
  }, [addNotification]);

  const handleUploaded = (document) => {
    setDocuments((prev) => [document, ...prev]);
    setStats((prev) => ({ ...prev, total_documents: prev.total_documents + 1 }));
  };

  const handleDelete = async (document) => {
    if (!window.confirm(`Delete "${document.filename}"? Its quizzes, flashcards and chat history will be removed too.`)) return;
    try {
      await documentAPI.deleteDocument(document._id);
      forgetDocument(document._id);
      setDocuments((prev) => prev.filter((d) => d._id !== document._id));
      addNotification({ type: 'success', title: 'Document deleted', message: document.filename });
      refreshStats();
    } catch (error) {
      addNotification({ type: 'error', title: 'Delete failed', message: errorMessage(error) });
    }
  };

  if (loading) return <PageLoader />;

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Upload course material, then study it with the tutor, quizzes and flashcards."
        actions={
          documents.length > 0 && (
            <Link to="/create-quiz-room" className="btn btn-secondary">
              <Radio className="h-4 w-4" />
              Host live quiz
            </Link>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard title="Documents" value={stats.total_documents} icon={Library} />
        <StatsCard title="Quizzes taken" value={stats.quizzes_taken} icon={ListChecks} />
        <StatsCard
          title="Average score"
          value={stats.quizzes_taken ? `${stats.average_score}%` : '—'}
          icon={Target}
          hint={stats.quizzes_taken ? null : 'Take a quiz to see this'}
        />
        <StatsCard title="Time in quizzes" value={stats.study_time_label} icon={Clock} />
      </div>

      {stats.weakest_documents?.length > 0 && (
        <section className="card mt-6">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="card-title">Worth revisiting</h2>
            </div>
            <span className="muted text-xs">Lowest average quiz scores</span>
          </div>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {stats.weakest_documents.map((row) => (
              <li key={row.document_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <p className="min-w-0 basis-full truncate text-sm font-medium sm:flex-1 sm:basis-auto">{row.filename}</p>
                <span className={`badge ${row.average_score >= 70 ? 'badge-success' : row.average_score >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                  {row.average_score}% avg
                </span>
                <span className="muted text-xs">
                  {row.attempts} {row.attempts === 1 ? 'attempt' : 'attempts'}
                </span>
                <div className="ml-auto flex gap-1">
                  <Link to={`/document/${row.document_id}/chat`} className="btn btn-ghost btn-sm">Ask tutor</Link>
                  <Link to={`/document/${row.document_id}/quiz`} className="btn btn-secondary btn-sm">Retry quiz</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6">
        <div className="card-header">
          <h2 className="card-title">Library</h2>
          <span className="muted text-xs">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </span>
        </div>
        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <DocumentUpload onUpload={handleUploaded} compact={documents.length > 0} />
        </div>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload lecture notes, a textbook chapter or slides to get started."
          />
        ) : (
          <DocumentList documents={documents} onDelete={handleDelete} />
        )}
      </section>
    </div>
  );
};

export default Dashboard;

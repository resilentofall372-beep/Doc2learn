import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Clock, FileText, ListChecks, Target } from 'lucide-react';
import { documentAPI, errorMessage, projectAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import ProjectLayout from '../components/projects/ProjectLayout';
import DocumentUpload from '../components/document/DocumentUpload';
import DocumentList from '../components/document/DocumentList';
import StatsCard from '../components/dashboard/StatsCard';
import EmptyState from '../components/ui/EmptyState';

const EMPTY_STATS = { total_documents: 0, quizzes_taken: 0, average_score: 0, study_time_label: '0s', weakest_documents: [] };

const Content = ({ projectId, documents, setDocuments }) => {
  const [stats, setStats] = useState(EMPTY_STATS);
  const { addNotification } = useApp();

  const loadStats = useCallback(
    () => projectAPI.stats(projectId).then((res) => setStats(res.data.stats)).catch(() => {}),
    [projectId]
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleUploaded = (doc) => {
    setDocuments((prev) => [...prev, doc]);
    loadStats();
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.filename}"? Quizzes and flashcards made only from it will be removed too.`)) return;
    try {
      await documentAPI.deleteDocument(doc._id);
      // Doc numbers follow upload order, so renumber the remaining files.
      setDocuments((prev) => prev.filter((d) => d._id !== doc._id).map((d, i) => ({ ...d, number: i + 1 })));
      addNotification({ type: 'success', title: 'Document deleted', message: doc.filename });
      loadStats();
    } catch (error) {
      addNotification({ type: 'error', title: 'Delete failed', message: errorMessage(error) });
    }
  };

  return (
    <div className="space-y-6">
      {documents.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatsCard title="Documents" value={documents.length} icon={FileText} />
          <StatsCard title="Quizzes taken" value={stats.quizzes_taken} icon={ListChecks} />
          <StatsCard
            title="Average score"
            value={stats.quizzes_taken ? `${stats.average_score}%` : '—'}
            icon={Target}
            hint={stats.quizzes_taken ? null : 'Take a quiz to see this'}
          />
          <StatsCard title="Time in quizzes" value={stats.study_time_label} icon={Clock} />
        </div>
      )}

      {stats.weakest_documents?.length > 0 && (
        <section className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h2 className="card-title">Worth revisiting</h2>
            </div>
            <span className="muted text-xs">Lowest scores on single-document quizzes</span>
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
                <Link to={`/projects/${projectId}/quiz?document=${row.document_id}`} className="btn btn-secondary btn-sm ml-auto">
                  Retry quiz
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="card-header">
          <h2 className="card-title">Documents</h2>
          <span className="muted text-xs">The tutor, quizzes and flashcards use all of these</span>
        </div>
        <div className="border-b border-zinc-200 p-5 dark:border-zinc-800">
          <DocumentUpload projectId={projectId} onUpload={handleUploaded} compact={documents.length > 0} />
        </div>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload lecture notes, a textbook chapter or slides. You can add as many as you like."
          />
        ) : (
          <DocumentList projectId={projectId} documents={documents} onDelete={handleDelete} />
        )}
      </section>
    </div>
  );
};

const ProjectDocuments = () => {
  const { projectId } = useParams();
  return (
    <ProjectLayout needsDocuments={false}>
      {({ documents, setDocuments }) => <Content projectId={projectId} documents={documents} setDocuments={setDocuments} />}
    </ProjectLayout>
  );
};

export default ProjectDocuments;

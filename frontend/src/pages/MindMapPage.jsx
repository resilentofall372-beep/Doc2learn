import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Network, RefreshCw } from 'lucide-react';
import { errorMessage, mindmapAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import ProjectLayout from '../components/projects/ProjectLayout';
import ScopePicker from '../components/projects/ScopePicker';
import MindMapCanvas from '../components/mindmap/MindMapCanvas';
import StaleNotice from '../components/projects/StaleNotice';
import { newerDocuments } from '../utils/time';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner, { PageLoader } from '../components/common/LoadingSpinner';

const ConceptMap = ({ projectId, documents }) => {
  const { addNotification } = useApp();
  const [params, setParams] = useSearchParams();
  const wanted = params.get('document');
  const documentId = documents.some((d) => d._id === wanted) ? wanted : '';
  const [mindmap, setMindmap] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const setDocumentId = (id) => setParams(id ? { document: id } : {}, { replace: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mindmapAPI.getMindmap(projectId, documentId || null);
      setMindmap(res.data.mindmap);
      setGeneratedAt(res.data.generated_at || null);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load concept map', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [projectId, documentId, addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await mindmapAPI.generate({ projectId, documentId: documentId || null });
      setMindmap(res.data.mindmap);
      setGeneratedAt(res.data.generated_at || new Date().toISOString());
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not generate concept map', message: errorMessage(error) });
    } finally {
      setGenerating(false);
    }
  };

  const picker =
    documents.length > 1 ? (
      <div className="mb-6 max-w-sm">
        <ScopePicker id="map-scope" label="Map of" documents={documents} value={documentId} onChange={setDocumentId} />
      </div>
    ) : null;

  if (loading) return <PageLoader />;

  if (!mindmap) {
    return (
      <>
        {picker}
        <div className="card">
          <EmptyState
            icon={Network}
            title="No concept map yet"
            description="See how the main ideas in your documents connect to each other."
            action={
              <button type="button" onClick={generate} disabled={generating} className="btn btn-primary">
                {generating ? <LoadingSpinner size="small" /> : null}
                {generating ? 'Building map…' : 'Build concept map'}
              </button>
            }
          />
        </div>
      </>
    );
  }

  const missing = documentId ? [] : newerDocuments(documents, generatedAt);

  return (
    <>
      {picker}
      {missing.length > 0 && (
        <div className="mb-6">
          <StaleNotice what="map" documents={missing} onRegenerate={generate} busy={generating} />
        </div>
      )}
      <section className="card">
        <div className="card-header py-3">
          <h2 className="card-title">{mindmap.central_topic}</h2>
          <button type="button" onClick={generate} disabled={generating} className="btn btn-ghost btn-sm">
            {generating ? <LoadingSpinner size="small" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </button>
        </div>
        <div className="p-5">
          <MindMapCanvas mindmap={mindmap} />
        </div>
      </section>
    </>
  );
};

const MindMapPage = () => {
  const { projectId } = useParams();
  return <ProjectLayout>{({ documents }) => <ConceptMap projectId={projectId} documents={documents} />}</ProjectLayout>;
};

export default MindMapPage;

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Network, RefreshCw } from 'lucide-react';
import { errorMessage, mindmapAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import DocumentLayout from '../components/document/DocumentLayout';
import MindMapCanvas from '../components/mindmap/MindMapCanvas';
import EmptyState from '../components/ui/EmptyState';
import LoadingSpinner, { PageLoader } from '../components/common/LoadingSpinner';

const MindMapPage = () => {
  const { id: documentId } = useParams();
  const { addNotification } = useApp();
  const [mindmap, setMindmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await mindmapAPI.getMindmap(documentId);
      setMindmap(res.data.mindmap);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load concept map', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [documentId, addNotification]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await mindmapAPI.generate({ document_id: documentId });
      setMindmap(res.data.mindmap);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not generate concept map', message: errorMessage(error) });
    } finally {
      setGenerating(false);
    }
  };

  let body;
  if (loading) body = <PageLoader />;
  else if (!mindmap) {
    body = (
      <div className="card">
        <EmptyState
          icon={Network}
          title="No concept map yet"
          description="See how the main ideas in this document connect to each other."
          action={
            <button type="button" onClick={generate} disabled={generating} className="btn btn-primary">
              {generating ? <LoadingSpinner size="small" /> : null}
              {generating ? 'Building map…' : 'Build concept map'}
            </button>
          }
        />
      </div>
    );
  } else {
    body = (
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
    );
  }

  return <DocumentLayout>{body}</DocumentLayout>;
};

export default MindMapPage;

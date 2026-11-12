import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage, mindmapAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MindMapCanvas from '../components/mindmap/MindMapCanvas';

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
      addNotification({ type: 'error', title: 'Could not load mind map', message: errorMessage(error) });
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
      addNotification({ type: 'success', title: 'Mind map ready', message: 'Click a node to highlight it.' });
    } catch (error) {
      addNotification({ type: 'error', title: 'Generation failed', message: errorMessage(error) });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!mindmap) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="text-5xl mb-4">🧠</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No mind map yet</h3>
        <p className="text-gray-600 mb-6">Build a concept map of this document to see how its ideas connect.</p>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating…' : 'Generate mind map'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Concept map</h1>
        <p className="text-gray-600">How the ideas in this document relate to each other.</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <MindMapCanvas mindmap={mindmap} />
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
          >
            {generating ? <LoadingSpinner size="small" /> : null}
            <span>{generating ? 'Regenerating…' : 'Regenerate'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MindMapPage;

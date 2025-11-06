import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { documentAPI, mindmapAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import MindMapCanvas from '../components/mindmap/MindMapCanvas';

const MindMapPage = () => {
  const { id: documentId } = useParams();
  const [mindmap, setMindmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { addNotification } = useApp();

  useEffect(() => {
    loadMindmap();
  }, [documentId]);

  const loadMindmap = async () => {
    try {
      const response = await mindmapAPI.getMindmap(documentId);
      setMindmap(response.data.mindmap);
    } catch (error) {
      console.error('Error loading mindmap:', error);
      // Mindmap generation will happen on demand
    } finally {
      setLoading(false);
    }
  };

  const generateMindmap = async () => {
    try {
      setGenerating(true);
      
      // First, get the document text
      const docResponse = await documentAPI.getDocument(documentId);
      const document = docResponse.data.document || docResponse.data;
      const documentText = document.extracted_text || document.text || 'Sample document text';
      
      const response = await mindmapAPI.generate({
        text: documentText,
        document_id: documentId
      });
      
      setMindmap(response.data.mindmap);
      addNotification({
        type: 'success',
        title: 'Mind Map Generated',
        message: 'Your mind map is ready to explore!'
      });
    } catch (error) {
      console.error('Error generating mindmap:', error);
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: 'Could not generate mind map'
      });
      
      // Fallback sample mindmap
      setMindmap({
        central_topic: 'Document Summary',
        branches: [
          { 
            topic: 'Main Concepts',
            subtopics: ['Key Idea 1', 'Key Idea 2']
          },
          { 
            topic: 'Supporting Details',
            subtopics: ['Detail A', 'Detail B']
          },
          { 
            topic: 'Conclusions',
            subtopics: ['Summary Point']
          }
        ]
      });
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
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Mind Map Available</h3>
        <p className="text-gray-600 mb-6">
          Generate a mind map from your document to visualize concepts and relationships.
        </p>
        <button
          onClick={generateMindmap}
          disabled={generating}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating Mind Map...' : 'Generate Mind Map'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Concept Mind Map</h1>
        <p className="text-gray-600">
          Explore the relationships between concepts in your document.
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <MindMapCanvas mindmap={mindmap} />
        
        <div className="mt-6 flex justify-center">
          <button
            onClick={generateMindmap}
            disabled={generating}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
          >
            {generating ? (
              <>
                <LoadingSpinner size="small" />
                <span>Regenerating...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Regenerate Mind Map</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MindMapPage;
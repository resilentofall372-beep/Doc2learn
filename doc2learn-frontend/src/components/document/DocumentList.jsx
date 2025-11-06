// src/components/document/DocumentList.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const DocumentList = ({ documents }) => {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
        <p className="text-gray-500">Upload your first document to get started with learning.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {documents.map((doc) => (
        <div
          key={doc._id || doc.doc_id}
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {doc.filename}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Uploaded on {new Date(doc.uploaded_on).toLocaleDateString()}
              </p>
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center ml-4 flex-shrink-0">
              <span className="text-primary-600 font-bold text-sm">
                {doc.filename?.split('.').pop()?.toUpperCase() || 'FILE'}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              to={`/document/${doc._id || doc.doc_id}/chat`}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>🤖</span>
              <span>Chat with AI</span>
            </Link>
            
            <Link
              to={`/document/${doc._id || doc.doc_id}/quiz`}
              className="w-full bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors block text-center"
            >
              Take Quiz
            </Link>
            
            <Link
              to={`/document/${doc._id || doc.doc_id}/flashcards`}
              className="w-full bg-secondary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary-700 transition-colors block text-center"
            >
              Study Flashcards
            </Link>

            <Link
              to={`/document/${doc._id || doc.doc_id}/mindmap`}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors block text-center"
            >
              View Mind Map
            </Link>

            <button
              onClick={() => {/* Create room logic */}}
              className="w-full border border-primary-600 text-primary-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-50 transition-colors"
            >
              Create Study Room
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// MAKE SURE THIS EXPORT EXISTS
export default DocumentList;
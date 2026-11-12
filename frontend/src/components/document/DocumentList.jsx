import React from 'react';
import { Link } from 'react-router-dom';

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DocumentList = ({ documents, onDelete }) => {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📄</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
        <p className="text-gray-500">Upload lecture notes, a chapter, or slides to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {documents.map((doc) => (
        <div key={doc._id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate" title={doc.filename}>
                {doc.filename}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(doc.uploaded_on).toLocaleDateString()}
                {doc.page_count ? ` · ${doc.page_count} page${doc.page_count === 1 ? '' : 's'}` : ''}
                {doc.file_size ? ` · ${formatSize(doc.file_size)}` : ''}
              </p>
              {doc.quiz_count > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {doc.quiz_count} quiz{doc.quiz_count === 1 ? '' : 'zes'} generated
                </p>
              )}
            </div>
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center ml-4 flex-shrink-0">
              <span className="text-primary-600 font-bold text-xs uppercase">{doc.file_type || 'file'}</span>
            </div>
          </div>

          <div className="space-y-2 mt-auto">
            <Link
              to={`/document/${doc._id}/chat`}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors block text-center"
            >
              Chat with tutor
            </Link>
            <div className="grid grid-cols-3 gap-2">
              <Link
                to={`/document/${doc._id}/quiz`}
                className="bg-primary-600 text-white px-2 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors text-center"
              >
                Quiz
              </Link>
              <Link
                to={`/document/${doc._id}/flashcards`}
                className="bg-secondary-600 text-white px-2 py-2 rounded-md text-sm font-medium hover:bg-secondary-700 transition-colors text-center"
              >
                Flashcards
              </Link>
              <Link
                to={`/document/${doc._id}/mindmap`}
                className="bg-gray-600 text-white px-2 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors text-center"
              >
                Mind map
              </Link>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/create-quiz-room?document=${doc._id}`}
                className="flex-1 border border-primary-600 text-primary-600 px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-50 transition-colors text-center"
              >
                Host live quiz
              </Link>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(doc)}
                  className="border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm hover:bg-red-50 transition-colors"
                  title="Delete document"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DocumentList;

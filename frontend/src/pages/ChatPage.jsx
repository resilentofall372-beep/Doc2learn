import React from 'react';
import { useParams } from 'react-router-dom';
import DocumentLayout from '../components/document/DocumentLayout';
import ChatInterface from '../components/assistant/ChatInterface';
import QuickActions from '../components/assistant/QuickActions';

const ChatPage = () => {
  const { documentId } = useParams();
  return (
    <DocumentLayout>
      {(document) => (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ChatInterface documentId={documentId} document={document} />
          <QuickActions documentId={documentId} />
        </div>
      )}
    </DocumentLayout>
  );
};

export default ChatPage;

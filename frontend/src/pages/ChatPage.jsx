import React from 'react';
import { useParams } from 'react-router-dom';
import ProjectLayout from '../components/projects/ProjectLayout';
import ChatInterface from '../components/assistant/ChatInterface';
import QuickActions from '../components/assistant/QuickActions';

const ChatPage = () => {
  const { projectId } = useParams();
  return (
    <ProjectLayout>
      {({ project, documents }) => (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <ChatInterface projectId={projectId} project={project} documents={documents} />
          <QuickActions projectId={projectId} documents={documents} />
        </div>
      )}
    </ProjectLayout>
  );
};

export default ChatPage;

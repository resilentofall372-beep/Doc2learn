// src/pages/Dashboard.jsx - COMPLETE WITH EXPORT DEFAULT
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { documentAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../hooks/useAuth';
import DocumentUpload from '../components/document/DocumentUpload';
import DocumentList from '../components/document/DocumentList';
import StatsCard from '../components/dashboard/StatsCard';
import LoadingSpinner from '../components/common/LoadingSpinner';

const Dashboard = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalQuizzes: 0,
    averageScore: 0,
    studyTime: '0h'
  });
  const { addNotification } = useApp();
  const { user } = useAuth();

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    try {
      if (user?.user_id) {
        const response = await documentAPI.getDocuments(user.user_id);
        const docs = response.data.documents || [];
        setDocuments(docs);
        
        // Calculate stats
        setStats({
          totalDocuments: docs.length,
          totalQuizzes: docs.reduce((acc, doc) => acc + (doc.quiz_count || 0), 0),
          averageScore: 75, // Mock data
          studyTime: '12h' // Mock data
        });
      } else {
        // If no user, show empty state
        setDocuments([]);
        setStats({
          totalDocuments: 0,
          totalQuizzes: 0,
          averageScore: 0,
          studyTime: '0h'
        });
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load documents'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (newDocument) => {
    setDocuments(prev => [newDocument, ...prev]);
    setStats(prev => ({
      ...prev,
      totalDocuments: prev.totalDocuments + 1
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg text-white p-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">
              Welcome back, {user?.name || 'Student'}!
            </h1>
            <p className="text-primary-100 text-lg">
              Ready to continue your learning journey?
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link
              to="/rooms"
              className="bg-white text-primary-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Join Study Room
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Documents"
          value={stats.totalDocuments}
          icon="📚"
          color="blue"
        />
        <StatsCard
          title="Quizzes Taken"
          value={stats.totalQuizzes}
          icon="📝"
          color="green"
        />
        <StatsCard
          title="Average Score"
          value={`${stats.averageScore}%`}
          icon="🎯"
          color="purple"
        />
        <StatsCard
          title="Study Time"
          value={stats.studyTime}
          icon="⏱️"
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/rooms"
          className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow text-center"
        >
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">👥</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Study Rooms</h3>
          <p className="text-gray-600 text-sm">
            Collaborate with others in real-time study sessions
          </p>
        </Link>

        <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📈</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Progress</h3>
          <p className="text-gray-600 text-sm">
            Track your learning progress and achievements
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏆</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Achievements</h3>
          <p className="text-gray-600 text-sm">
            Unlock achievements as you learn and grow
          </p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-heading font-semibold text-gray-900 mb-4">
          Upload New Document
        </h2>
        <DocumentUpload onUpload={handleDocumentUpload} />
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-heading font-semibold text-gray-900">
            Your Documents ({documents.length})
          </h2>
          {documents.length > 0 && (
            <Link
              to="/rooms"
              className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              Create Study Room
            </Link>
          )}
        </div>
        <DocumentList documents={documents} />
      </div>
    </div>
  );
};

// ADD THIS EXPORT DEFAULT STATEMENT
export default Dashboard;
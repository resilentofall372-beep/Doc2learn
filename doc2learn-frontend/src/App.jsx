import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import NewDashboard from './pages/NewDashboard';
import QuizPage from './pages/QuizPage';
import FlashcardsPage from './pages/FlashcardsPage';
import MindMapPage from './pages/MindMapPage';
import ChatPage from './pages/ChatPage';
import StudyRooms from './pages/StudyRooms';
import RoomPage from './pages/RoomPage';
import CreateQuizRoom from './pages/CreateQuizRoom';
import JoinRoom from './pages/JoinRoom';
import NotFound from './pages/NotFound';
import LoadingSpinner from './components/common/LoadingSpinner';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route Component (redirect to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <Router>
            <Routes>
            {/* Public Routes - Only accessible when NOT logged in */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Layout>
                    <Login />
                  </Layout>
                </PublicRoute>
              } 
            />
            <Route 
              path="/signup" 
              element={
                <PublicRoute>
                  <Layout>
                    <Signup />
                  </Layout>
                </PublicRoute>
              } 
            />
            
            {/* Protected Routes - Only accessible when logged in */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/new-dashboard" 
              element={
                <ProtectedRoute>
                  <NewDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/document/:id/quiz" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <QuizPage />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/document/:id/flashcards" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <FlashcardsPage />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/document/:id/mindmap" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <MindMapPage />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/document/:documentId/chat" 
              element={
                <ProtectedRoute>
                  <ChatPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/study-rooms" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <StudyRooms />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/create-quiz-room" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateQuizRoom />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/join/:roomCode" 
              element={
                <Layout>
                  <JoinRoom />
                </Layout>
              } 
            />
            <Route 
              path="/room/:id" 
              element={
                <ProtectedRoute>
                  <SocketProvider>
                    <Layout>
                      <RoomPage />
                    </Layout>
                  </SocketProvider>
                </ProtectedRoute>
              } 
            />
            
            {/* Legacy route redirects */}
            <Route path="/rooms" element={<Navigate to="/study-rooms" replace />} />
            
            {/* Root path redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 Not Found Route */}
            <Route path="*" element={
              <Layout>
                <NotFound />
              </Layout>
            } />
          </Routes>
        </Router>
      </AppProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
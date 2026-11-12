import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { SocketProvider } from './contexts/SocketContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/common/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import { PageLoader } from './components/common/LoadingSpinner';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Projects from './pages/Projects';
import ProjectDocuments from './pages/ProjectDocuments';
import QuizPage from './pages/QuizPage';
import FlashcardsPage from './pages/FlashcardsPage';
import MindMapPage from './pages/MindMapPage';
import ChatPage from './pages/ChatPage';
import StudyRooms from './pages/StudyRooms';
import RoomPage from './pages/RoomPage';
import CreateQuizRoom from './pages/CreateQuizRoom';
import JoinRoom from './pages/JoinRoom';
import NotFound from './pages/NotFound';

// Pages only for signed-out visitors (login, signup).
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return !isAuthenticated ? children : <Navigate to="/projects" replace />;
};

const protectedPage = (element) => (
  <ProtectedRoute>
    <Layout>{element}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <Router>
            <Routes>
              {/* Public home page with Log in / Sign up (or Open projects / Log out when signed in). */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

              {/* A user's projects, and everything inside one. */}
              <Route path="/projects" element={protectedPage(<Projects />)} />
              <Route path="/projects/:projectId" element={protectedPage(<ProjectDocuments />)} />
              <Route path="/projects/:projectId/tutor" element={protectedPage(<ChatPage />)} />
              <Route path="/projects/:projectId/quiz" element={protectedPage(<QuizPage />)} />
              <Route path="/projects/:projectId/flashcards" element={protectedPage(<FlashcardsPage />)} />
              <Route path="/projects/:projectId/map" element={protectedPage(<MindMapPage />)} />

              <Route path="/study-rooms" element={protectedPage(<StudyRooms />)} />
              <Route path="/create-quiz-room" element={protectedPage(<CreateQuizRoom />)} />

              {/* Guests can join a live quiz by code without an account. */}
              <Route path="/join/:roomCode" element={<Layout><JoinRoom /></Layout>} />
              <Route
                path="/room/:id"
                element={
                  <SocketProvider>
                    <Layout>
                      <RoomPage />
                    </Layout>
                  </SocketProvider>
                }
              />

              {/* Old addresses from before projects existed. */}
              <Route path="/dashboard" element={<Navigate to="/projects" replace />} />
              <Route path="/document/*" element={<Navigate to="/projects" replace />} />
              <Route path="/rooms" element={<Navigate to="/study-rooms" replace />} />
              <Route path="*" element={<Layout><NotFound /></Layout>} />
            </Routes>
          </Router>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

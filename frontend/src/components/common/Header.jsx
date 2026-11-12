import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Updated import path
import ThemeToggle from './ThemeToggle';

const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="bg-white dark:bg-gray-800 shadow-lg border-b dark:border-gray-700 transition-all duration-300 sticky top-0 z-50 backdrop-blur-md bg-opacity-90 dark:bg-opacity-90">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo with enhanced styling */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 dark:from-indigo-500 dark:to-purple-500 rounded-xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
              <span className="text-white font-bold text-lg">📚</span>
            </div>
            <span className="text-2xl font-heading font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              Doc2Learn
            </span>
          </Link>

          {/* Navigation */}
          {isAuthenticated && (
            <nav className="hidden md:flex space-x-2">
              <Link
                to="/dashboard"
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${
                  isActive('/dashboard')
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                📊 Dashboard
              </Link>
              <Link
                to="/study-rooms"
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 ${
                  isActive('/study-rooms')
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                👥 Study Rooms
              </Link>
            </nav>
          )}

          {/* User Menu */}
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl border border-indigo-200 dark:border-indigo-700">
                <span className="text-lg">👤</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {user?.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                Logout 👋
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <Link
                to="/login"
                className="hidden sm:flex items-center space-x-1 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700 transform hover:scale-105"
              >
                <span>🔐</span>
                <span>Sign In</span>
              </Link>
              <Link
                to="/signup"
                className="flex items-center space-x-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <span>✨</span>
                <span>Sign Up Free</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NewDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Sample courses data - replace with actual API call
  const courses = [
    {
      id: 1,
      title: 'Introduction to Machine Learning',
      progress: 65,
      thumbnail: '🤖',
      lessons: 24,
      duration: '8 hours'
    },
    {
      id: 2,
      title: 'Web Development Fundamentals',
      progress: 45,
      thumbnail: '💻',
      lessons: 18,
      duration: '6 hours'
    },
    {
      id: 3,
      title: 'Data Structures and Algorithms',
      progress: 80,
      thumbnail: '📊',
      lessons: 32,
      duration: '12 hours'
    },
    {
      id: 4,
      title: 'Python Programming',
      progress: 30,
      thumbnail: '🐍',
      lessons: 20,
      duration: '10 hours'
    },
    {
      id: 5,
      title: 'Database Management',
      progress: 55,
      thumbnail: '🗄️',
      lessons: 16,
      duration: '7 hours'
    },
    {
      id: 6,
      title: 'Cloud Computing Basics',
      progress: 90,
      thumbnail: '☁️',
      lessons: 14,
      duration: '5 hours'
    }
  ];

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: '📊' },
    { id: 'homework', name: 'Homework', icon: '📝' },
    { id: 'schedule', name: 'Schedule', icon: '📅' },
    { id: 'courses', name: 'Courses', icon: '📚' },
    { id: 'chat', name: 'Chat', icon: '💬' }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredCourses = courses.filter(course =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate overall progress
  const overallProgress = Math.round(
    courses.reduce((acc, course) => acc + course.progress, 0) / courses.length
  );

  return (
    <div className="flex h-screen bg-[#000000] text-[#ffffff] overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#111111] flex flex-col border-r border-[#4865ff]/30 shadow-xl">
        {/* Logo */}
        <div className="p-6 border-b border-[#4865ff]/30">
          <div className="flex items-center gap-3">
            <div className="text-3xl transform hover:rotate-12 transition-transform duration-300">📚</div>
            <span className="text-xl font-bold text-[#ffffff] bg-gradient-to-r from-[#ffffff] to-[#4865ff] bg-clip-text text-transparent">
              Doc2Learn
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ${
                activeTab === item.id
                  ? 'bg-[#4865ff] text-[#ffffff] shadow-lg shadow-[#4865ff]/50 scale-105'
                  : 'text-[#ffffff]/80 hover:bg-[#4865ff]/20 hover:text-[#ffffff] hover:scale-102'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-semibold">{item.name}</span>
              {activeTab === item.id && (
                <span className="ml-auto text-xs">●</span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-[#4865ff]/30">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[#ffffff]/80 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 border border-transparent transition-all duration-300"
          >
            <span className="text-xl">🚪</span>
            <span className="font-semibold">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-[#111111] border-b border-[#4865ff]/30 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            {/* Search Bar */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <span className="text-[#4865ff] text-xl">🔍</span>
                </div>
                <input
                  type="text"
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#000000] border border-[#4865ff]/40 rounded-xl pl-12 pr-4 py-3 text-[#ffffff] placeholder-[#ffffff]/50 focus:outline-none focus:border-[#4865ff] focus:ring-2 focus:ring-[#4865ff]/30 transition-all"
                />
              </div>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-4 ml-6">
              <div className="text-right">
                <div className="text-sm font-semibold text-[#ffffff]">
                  {user?.name || user?.email || 'Student'}
                </div>
                <div className="text-xs text-[#4865ff]">Premium Member</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4865ff] to-[#6b85ff] flex items-center justify-center text-xl font-bold shadow-lg shadow-[#4865ff]/50 border-2 border-[#4865ff]/30 cursor-pointer hover:scale-110 transition-transform">
                {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Navbar */}
        <div className="bg-[#111111] border-b border-[#4865ff]/30 px-6 py-3">
          <div className="flex items-center gap-6">
            <button className="text-[#ffffff] hover:text-[#4865ff] transition-colors font-semibold pb-2 border-b-2 border-[#4865ff]">
              All Courses
            </button>
            <button className="text-[#ffffff]/60 hover:text-[#4865ff] transition-colors font-semibold pb-2 border-b-2 border-transparent hover:border-[#4865ff]/50">
              In Progress
            </button>
            <button className="text-[#ffffff]/60 hover:text-[#4865ff] transition-colors font-semibold pb-2 border-b-2 border-transparent hover:border-[#4865ff]/50">
              Completed
            </button>
            <button className="text-[#ffffff]/60 hover:text-[#4865ff] transition-colors font-semibold pb-2 border-b-2 border-transparent hover:border-[#4865ff]/50">
              Favorites ⭐
            </button>
          </div>
        </div>

        {/* Main Content with Right Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Courses Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <h1 className="text-3xl font-bold text-[#ffffff] mb-6">My Courses</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  className="bg-[#111111] border border-[#4865ff]/30 rounded-xl p-6 hover:border-[#4865ff] hover:shadow-lg hover:shadow-[#4865ff]/20 transition-all duration-300 cursor-pointer group"
                >
                  {/* Course Thumbnail */}
                  <div className="w-16 h-16 bg-[#4865ff]/10 rounded-xl flex items-center justify-center text-4xl mb-4 group-hover:bg-[#4865ff]/20 group-hover:scale-110 transition-all duration-300">
                    {course.thumbnail}
                  </div>

                  {/* Course Title */}
                  <h3 className="text-lg font-semibold text-[#ffffff] mb-3 line-clamp-2">
                    {course.title}
                  </h3>

                  {/* Course Info */}
                  <div className="flex items-center gap-4 text-sm text-[#ffffff]/60 mb-4">
                    <span className="flex items-center gap-1">
                      <span className="text-[#4865ff]">📖</span> {course.lessons} lessons
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-[#4865ff]">⏱️</span> {course.duration}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm text-[#ffffff]/80 mb-2">
                      <span className="font-medium">Progress</span>
                      <span className="font-bold text-[#4865ff]">{course.progress}%</span>
                    </div>
                    <div className="h-2.5 bg-[#000000] rounded-full overflow-hidden border border-[#4865ff]/20">
                      <div
                        className="h-full bg-gradient-to-r from-[#4865ff] to-[#6b85ff] rounded-full transition-all duration-500 shadow-lg shadow-[#4865ff]/30"
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button className="w-full mt-4 bg-[#4865ff] hover:bg-[#5875ff] text-[#ffffff] py-2.5 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-[#4865ff]/40 hover:scale-[1.02]">
                    Continue Learning →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar - Learning Progress */}
          <div className="w-80 bg-[#111111] border-l border-[#4865ff]/30 p-6 overflow-y-auto">
            <h2 className="text-xl font-bold text-[#ffffff] mb-6 flex items-center gap-2">
              <span className="text-2xl">📈</span> Learning Progress
            </h2>

            {/* Overall Progress Card */}
            <div className="bg-gradient-to-br from-[#4865ff]/20 to-[#4865ff]/5 border border-[#4865ff]/40 rounded-xl p-6 mb-6 shadow-lg shadow-[#4865ff]/10">
              <div className="text-center mb-4">
                <div className="text-6xl font-bold text-[#4865ff] mb-2 drop-shadow-lg">
                  {overallProgress}%
                </div>
                <div className="text-sm text-[#ffffff]/80 font-medium">Overall Progress</div>
              </div>
              <div className="h-3 bg-[#000000] rounded-full overflow-hidden border border-[#4865ff]/30">
                <div
                  className="h-full bg-gradient-to-r from-[#4865ff] to-[#6b85ff] rounded-full transition-all duration-500 shadow-lg shadow-[#4865ff]/50"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3 mb-6">
              <div className="bg-[#000000] border border-[#4865ff]/30 rounded-xl p-4 hover:border-[#4865ff]/60 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[#ffffff]/70 text-sm font-medium">Total Courses</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📚</span>
                    <span className="text-2xl font-bold text-[#4865ff]">{courses.length}</span>
                  </div>
                </div>
              </div>
              <div className="bg-[#000000] border border-[#4865ff]/30 rounded-xl p-4 hover:border-[#4865ff]/60 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[#ffffff]/70 text-sm font-medium">Completed</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <span className="text-2xl font-bold text-[#4865ff]">
                      {courses.filter(c => c.progress === 100).length}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-[#000000] border border-[#4865ff]/30 rounded-xl p-4 hover:border-[#4865ff]/60 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-[#ffffff]/70 text-sm font-medium">In Progress</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🔄</span>
                    <span className="text-2xl font-bold text-[#4865ff]">
                      {courses.filter(c => c.progress > 0 && c.progress < 100).length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <h3 className="text-lg font-semibold text-[#ffffff] mb-4 flex items-center gap-2">
              <span>⚡</span> Recent Activity
            </h3>
            <div className="space-y-3 mb-6">
              <div className="bg-[#000000] border border-[#4865ff]/30 rounded-lg p-3 hover:border-[#4865ff]/60 transition-all cursor-pointer">
                <div className="text-sm text-[#ffffff] font-medium mb-1 flex items-center gap-2">
                  <span className="text-[#4865ff]">✓</span> Completed Lesson 12
                </div>
                <div className="text-xs text-[#ffffff]/60">Machine Learning • 2 hours ago</div>
              </div>
              <div className="bg-[#000000] border border-[#4865ff]/30 rounded-lg p-3 hover:border-[#4865ff]/60 transition-all cursor-pointer">
                <div className="text-sm text-[#ffffff] font-medium mb-1 flex items-center gap-2">
                  <span className="text-[#4865ff]">🚀</span> Started New Course
                </div>
                <div className="text-xs text-[#ffffff]/60">Cloud Computing • Yesterday</div>
              </div>
              <div className="bg-[#000000] border border-[#4865ff]/30 rounded-lg p-3 hover:border-[#4865ff]/60 transition-all cursor-pointer">
                <div className="text-sm text-[#ffffff] font-medium mb-1 flex items-center gap-2">
                  <span className="text-[#4865ff]">🏆</span> Earned Achievement
                </div>
                <div className="text-xs text-[#ffffff]/60">Quick Learner • 2 days ago</div>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <h3 className="text-lg font-semibold text-[#ffffff] mb-4 flex items-center gap-2">
              <span>⏰</span> Upcoming Deadlines
            </h3>
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-[#4865ff]/10 to-transparent border-l-4 border-[#4865ff] rounded-lg p-3 hover:from-[#4865ff]/20 transition-all cursor-pointer">
                <div className="text-sm text-[#ffffff] font-medium mb-1">
                  📝 Submit Assignment
                </div>
                <div className="text-xs text-[#ffffff]/60">Due in 2 days</div>
              </div>
              <div className="bg-gradient-to-r from-[#4865ff]/10 to-transparent border-l-4 border-[#4865ff] rounded-lg p-3 hover:from-[#4865ff]/20 transition-all cursor-pointer">
                <div className="text-sm text-[#ffffff] font-medium mb-1">
                  🧪 Complete Quiz
                </div>
                <div className="text-xs text-[#ffffff]/60">Due in 5 days</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewDashboard;

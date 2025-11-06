// src/pages/StudyRooms.jsx - UPDATED
import React, { useState, useEffect } from 'react';
import { roomAPI } from '../services/api'; // This should work now
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const StudyRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joiningRoom, setJoiningRoom] = useState('');
  const { addNotification } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await roomAPI.getRooms();
      setRooms(response.data.rooms || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load study rooms'
      });
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    try {
      setCreatingRoom(true);
      
      const roomData = {
        user_id: user?.user_id || 'default-user',
        document_id: 'sample-document-id', // You can modify this to use actual document ID
        room_name: `${user?.name || 'User'}'s Study Room`,
        max_members: 4
      };

      const response = await roomAPI.create(roomData);

      addNotification({
        type: 'success',
        title: 'Room Created',
        message: `Room ${response.data.room_id} created successfully!`
      });

      fetchRooms(); // Refresh the list
      
      // Optionally redirect to the new room
      // navigate(`/room/${response.data.room_id}`);

    } catch (error) {
      console.error('Error creating room:', error);
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: error.response?.data?.error || 'Could not create study room'
      });
    } finally {
      setCreatingRoom(false);
    }
  };

  const joinRoom = async (roomId) => {
    try {
      setJoiningRoom(roomId);
      
      const joinData = {
        room_id: roomId,
        user_id: user?.user_id || 'default-user',
        user_name: user?.name || 'Anonymous'
      };

      const response = await roomAPI.join(joinData);

      addNotification({
        type: 'success',
        title: 'Joined Room',
        message: `You have joined room ${roomId}`
      });

      // Redirect to room page
      navigate(`/room/${roomId}`);

    } catch (error) {
      console.error('Error joining room:', error);
      addNotification({
        type: 'error',
        title: 'Join Failed',
        message: error.response?.data?.error || 'Could not join study room'
      });
    } finally {
      setJoiningRoom('');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Study Rooms</h1>
        <p className="text-gray-600">
          Collaborate with others in real-time study sessions
        </p>
      </div>

      {/* Create Room Section */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Start a New Collaborative Quiz</h2>
            <p className="text-gray-600">
              Create a quiz room and invite others to compete in real-time
            </p>
          </div>
          <button
            onClick={() => navigate('/create-quiz-room')}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors mt-4 md:mt-0 flex items-center space-x-2"
          >
            <span className="text-xl">🎮</span>
            <span>Create Quiz Room</span>
          </button>
        </div>
      </div>

      {/* Rooms List */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Rooms</h2>
        
        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Rooms</h3>
            <p className="text-gray-500">Create the first study room to get started with collaboration.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div
                key={room.room_id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {room.room_name || `Room ${room.room_id}`}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Created by {room.created_by || 'Unknown'}
                    </p>
                  </div>
                  <div className="bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full">
                    {room.members?.length || 0}/{room.max_members || 4} members
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => joinRoom(room.room_id)}
                    disabled={joiningRoom === room.room_id || (room.members?.length || 0) >= (room.max_members || 4)}
                    className="w-full bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {joiningRoom === room.room_id ? 'Joining...' : 'Join Room'}
                  </button>
                  
                  <div className="text-xs text-gray-500">
                    {room.members?.length || 0} people studying together
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRooms;
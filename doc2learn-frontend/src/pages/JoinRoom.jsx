// src/pages/JoinRoom.jsx - Participant joins room with custom name
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { roomAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const avatarEmojis = ['😊', '😎', '🤓', '🎓', '🌟', '🚀', '💡', '🎯', '🔥', '⚡', '🎨', '🎭'];

const JoinRoom = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useApp();
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [roomInfo, setRoomInfo] = useState(null);
  const [participantName, setParticipantName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('😊');

  useEffect(() => {
    fetchRoomInfo();
  }, [roomCode]);

  const fetchRoomInfo = async () => {
    try {
      setLoading(true);
      const response = await roomAPI.getRoomByCode(roomCode);
      
      if (response.data.success) {
        setRoomInfo(response.data.room);
        
        // Check if room is full
        if (response.data.room.is_full) {
          addNotification({
            type: 'error',
            title: 'Room Full',
            message: 'This room has reached maximum capacity'
          });
        }
        
        // Check if quiz already started
        if (response.data.room.quiz_state !== 'lobby') {
          addNotification({
            type: 'warning',
            title: 'Quiz In Progress',
            message: 'This quiz has already started'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching room:', error);
      addNotification({
        type: 'error',
        title: 'Room Not Found',
        message: 'This room code is invalid or has expired'
      });
      setTimeout(() => navigate('/study-rooms'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    
    if (!participantName.trim()) {
      addNotification({
        type: 'error',
        title: 'Name Required',
        message: 'Please enter your name to join'
      });
      return;
    }
    
    if (participantName.trim().length < 2) {
      addNotification({
        type: 'error',
        title: 'Invalid Name',
        message: 'Name must be at least 2 characters'
      });
      return;
    }
    
    try {
      setJoining(true);
      
      const joinData = {
        room_code: roomCode,
        participant_name: participantName.trim(),
        participant_id: `participant_${Date.now()}`,
        avatar: selectedAvatar
      };
      
      const response = await roomAPI.join(joinData);
      
      if (response.data.success) {
        addNotification({
          type: 'success',
          title: 'Joined Successfully',
          message: `Welcome to ${roomInfo.room_name}!`
        });
        
        // Store participant info in localStorage
        localStorage.setItem('participant_info', JSON.stringify({
          participant_id: joinData.participant_id,
          participant_name: joinData.participant_name,
          avatar: joinData.avatar
        }));
        
        // Navigate to room lobby
        navigate(`/room/${response.data.room.room_id}`, {
          state: {
            participantInfo: joinData,
            roomCode: roomCode
          }
        });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      addNotification({
        type: 'error',
        title: 'Join Failed',
        message: error.response?.data?.error || 'Could not join room'
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-gray-600">Loading room information...</p>
      </div>
    );
  }

  if (!roomInfo) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Room Not Found</h2>
        <p className="text-gray-600 mb-6">This room code is invalid or has expired</p>
        <button
          onClick={() => navigate('/study-rooms')}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Go to Study Rooms
        </button>
      </div>
    );
  }

  const canJoin = !roomInfo.is_full && roomInfo.quiz_state === 'lobby';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Room Info Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎮</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {roomInfo.room_name}
            </h1>
            <p className="text-gray-600">
              Hosted by <span className="font-semibold">{roomInfo.host_name}</span>
            </p>
          </div>

          {/* Quiz Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">❓</div>
              <div className="text-sm text-gray-600">Questions</div>
              <div className="text-lg font-bold text-gray-900">{roomInfo.num_questions}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">⏱️</div>
              <div className="text-sm text-gray-600">Time/Q</div>
              <div className="text-lg font-bold text-gray-900">{roomInfo.time_per_question}s</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-sm text-gray-600">Difficulty</div>
              <div className="text-lg font-bold text-gray-900 capitalize">{roomInfo.difficulty}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-1">👥</div>
              <div className="text-sm text-gray-600">Players</div>
              <div className="text-lg font-bold text-gray-900">
                {roomInfo.participants_count}/{roomInfo.max_participants}
              </div>
            </div>
          </div>

          {/* Join Form */}
          {canJoin ? (
            <form onSubmit={handleJoinRoom} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg"
                  autoFocus
                />
                <p className="mt-2 text-sm text-gray-500">
                  This name will be visible to other participants
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Choose Your Avatar
                </label>
                <div className="grid grid-cols-6 gap-3">
                  {avatarEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`text-4xl p-3 rounded-lg border-2 transition-all transform hover:scale-110 ${
                        selectedAvatar === emoji
                          ? 'border-primary-500 bg-primary-50 scale-110'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Preview:</p>
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">{selectedAvatar}</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {participantName || 'Your Name'}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={joining || !participantName.trim()}
                className="w-full bg-primary-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {joining ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner size="small" />
                    <span className="ml-2">Joining...</span>
                  </span>
                ) : (
                  'Join Quiz Room'
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-8">
              {roomInfo.is_full ? (
                <>
                  <div className="text-5xl mb-4">😕</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Room is Full</h3>
                  <p className="text-gray-600">
                    This room has reached maximum capacity ({roomInfo.max_participants} players)
                  </p>
                </>
              ) : roomInfo.quiz_state !== 'lobby' ? (
                <>
                  <div className="text-5xl mb-4">⏱️</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Quiz In Progress</h3>
                  <p className="text-gray-600">
                    This quiz has already started. You cannot join now.
                  </p>
                </>
              ) : null}
              <button
                onClick={() => navigate('/study-rooms')}
                className="mt-6 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Find Another Room
              </button>
            </div>
          )}
        </div>

        {/* Room Code Display */}
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Room Code</p>
          <p className="text-3xl font-bold text-primary-600 tracking-wider font-mono">
            {roomCode}
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinRoom;

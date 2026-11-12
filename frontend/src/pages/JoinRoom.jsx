import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

const AVATARS = ['😊', '😎', '🤓', '🎓', '🌟', '🚀', '💡', '🎯', '🔥', '⚡', '🎨', '🦉'];

const JoinRoom = () => {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useApp();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(AVATARS[0]);

  const load = useCallback(async () => {
    try {
      const res = await roomAPI.getRoomByCode(roomCode);
      setRoom(res.data.room);
      // Already in this room (e.g. page refresh)? Go straight back in.
      const existing = roomIdentity.load(res.data.room.room_id);
      if (existing) navigate(`/room/${res.data.room.room_id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'This room code is invalid or has expired'));
    } finally {
      setLoading(false);
    }
  }, [roomCode, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const join = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      addNotification({ type: 'error', title: 'Name needed', message: 'At least 2 characters.' });
      return;
    }
    setJoining(true);
    try {
      const res = await roomAPI.join({ room_code: roomCode, participant_name: name.trim(), avatar });
      const { room: joined, participant_id, participant_token } = res.data;
      roomIdentity.save(joined.room_id, { participant_id, participant_token, is_host: false });
      navigate(`/room/${joined.room_id}`);
    } catch (err) {
      addNotification({ type: 'error', title: 'Could not join', message: errorMessage(err) });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="flex flex-col justify-center items-center h-64 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Room not found</h2>
        <p className="text-gray-600 mb-6">{error}</p>
        <button type="button" onClick={() => navigate('/study-rooms')} className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700">
          Browse rooms
        </button>
      </div>
    );
  }

  const canJoin = !room.is_full && room.quiz_state === 'lobby';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 mb-1">Room code</p>
          <p className="text-4xl font-bold text-primary-600 tracking-widest font-mono mb-4">{room.room_code}</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{room.room_name}</h1>
          <p className="text-gray-600">Hosted by <span className="font-semibold">{room.host_name}</span></p>
          {room.document_name && <p className="text-sm text-gray-400 mt-1">Questions from: {room.document_name}</p>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-center">
          {[
            ['Questions', room.num_questions],
            ['Per question', `${room.time_per_question}s`],
            ['Difficulty', room.difficulty],
            ['Players', `${room.participants_count}/${room.max_participants}`],
          ].map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">{label}</div>
              <div className="text-lg font-bold text-gray-900 capitalize">{value}</div>
            </div>
          ))}
        </div>

        {canJoin ? (
          <form onSubmit={join} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Your display name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={30}
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Avatar</label>
              <div className="grid grid-cols-6 gap-3">
                {AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    className={`text-3xl p-3 rounded-lg border-2 transition-all ${avatar === emoji ? 'border-primary-500 bg-primary-50 scale-110' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={joining || name.trim().length < 2}
              className="w-full bg-primary-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {joining ? 'Joining…' : 'Join room'}
            </button>
          </form>
        ) : (
          <div className="text-center py-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{room.is_full ? 'Room is full' : 'Quiz already started'}</h3>
            <p className="text-gray-600">Ask the host for a new room, or browse open lobbies.</p>
            <button type="button" onClick={() => navigate('/study-rooms')} className="mt-6 bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-800">
              Browse rooms
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinRoom;

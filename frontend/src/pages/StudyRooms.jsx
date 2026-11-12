import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, roomAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

const StudyRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const { addNotification } = useApp();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await roomAPI.getRooms();
      setRooms(res.data.rooms || []);
    } catch (error) {
      addNotification({ type: 'error', title: 'Could not load rooms', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Live quiz rooms</h1>
        <p className="text-gray-600">Host a quiz from one of your documents, or join a friend's room with a code.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Host a quiz</h2>
            <p className="text-gray-600 text-sm">Pick a document, set the pace, share the code. Faster correct answers score more.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/create-quiz-room')}
            className="mt-4 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create a room
          </button>
        </div>
        <form
          className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-between"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) navigate(`/join/${code.trim().toUpperCase()}`);
          }}
        >
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Join with a code</h2>
            <p className="text-gray-600 text-sm">Six characters, from the host's screen.</p>
          </div>
          <div className="mt-4 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="A7K3M9"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-mono tracking-widest uppercase focus:ring-2 focus:ring-primary-500"
            />
            <button type="submit" className="bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-900 transition-colors">
              Join
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Open lobbies</h2>
        {rooms.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No rooms are waiting for players right now.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div key={room.room_id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{room.room_name}</h3>
                    <p className="text-sm text-gray-500">Hosted by {room.host_name}</p>
                    {room.document_name && <p className="text-xs text-gray-400 truncate">{room.document_name}</p>}
                  </div>
                  <span className="bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                    {room.participants_count}/{room.max_participants}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {room.num_questions} questions · {room.time_per_question}s each · {room.difficulty}
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/join/${room.room_code}`)}
                  disabled={room.is_full}
                  className="w-full bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {room.is_full ? 'Full' : `Join ${room.room_code}`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRooms;

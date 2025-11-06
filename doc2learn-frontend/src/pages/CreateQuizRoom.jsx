// src/pages/CreateQuizRoom.jsx - Host creates and configures quiz room
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomAPI, documentAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

const CreateQuizRoom = () => {
  const navigate = useNavigate();
  const { addNotification } = useApp();
  const { user } = useAuth();
  
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1); // 1: Settings, 2: Document Upload
  
  // Room settings
  const [roomName, setRoomName] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [difficulty, setDifficulty] = useState('medium');
  const [maxParticipants, setMaxParticipants] = useState(20);
  
  // Document upload
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentId, setDocumentId] = useState(null);

  const handleDocumentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setDocumentFile(file);
    
    try {
      setUploadingDocument(true);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user?.user_id || 'default-host');
      
      const response = await documentAPI.uploadDocument(formData);
      
      if (response.data.success) {
        setDocumentId(response.data.document_id);
        addNotification({
          type: 'success',
          title: 'Document Uploaded',
          message: 'Document processed successfully!'
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      addNotification({
        type: 'error',
        title: 'Upload Failed',
        message: 'Could not upload document'
      });
      setDocumentFile(null);
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      addNotification({
        type: 'error',
        title: 'Room Name Required',
        message: 'Please enter a name for your quiz room'
      });
      return;
    }

    try {
      setCreating(true);
      
      const roomData = {
        host_id: user?.user_id || `host_${Date.now()}`,
        host_name: user?.name || roomName || 'Quiz Master',
        room_name: roomName.trim(),
        document_id: documentId,
        num_questions: numQuestions,
        time_per_question: timePerQuestion,
        difficulty: difficulty,
        max_participants: maxParticipants
      };
      
      console.log('🎮 Creating room with data:', roomData);
      
      const response = await roomAPI.create(roomData);
      
      if (response.data.success) {
        const { room_id, room_code, share_link } = response.data;
        
        addNotification({
          type: 'success',
          title: 'Room Created!',
          message: `Room code: ${room_code}`
        });
        
        // Store host info
        localStorage.setItem('host_info', JSON.stringify({
          room_id: room_id,
          room_code: room_code,
          host_id: roomData.host_id,
          host_name: roomData.host_name
        }));
        
        // Navigate to room lobby (host view)
        navigate(`/room/${room_id}`, {
          state: {
            isHost: true,
            roomCode: room_code,
            shareLink: share_link
          }
        });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      addNotification({
        type: 'error',
        title: 'Creation Failed',
        message: error.response?.data?.error || 'Could not create quiz room'
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Create Quiz Room
          </h1>
          <p className="text-gray-600">
            Set up your collaborative quiz session
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center items-center mb-8">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
              step === 1 ? 'bg-primary-600 text-white' : 'bg-green-500 text-white'
            }`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className="w-24 h-1 bg-gray-300 mx-2"></div>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
              step === 2 ? 'bg-primary-600 text-white' : 'bg-gray-300 text-gray-600'
            }`}>
              2
            </div>
          </div>
        </div>

        {/* Step 1: Quiz Settings */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              ⚙️ Quiz Configuration
            </h2>

            {/* Room Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g., Math Quiz Battle"
                maxLength={50}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Number of Questions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Questions: <span className="text-primary-600 font-bold">{numQuestions}</span>
              </label>
              <input
                type="range"
                min="3"
                max="50"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>3</span>
                <span>25</span>
                <span>50</span>
              </div>
            </div>

            {/* Time Per Question */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Per Question: <span className="text-primary-600 font-bold">{timePerQuestion}s</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {[10, 15, 20, 30, 45, 60].map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setTimePerQuestion(time)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      timePerQuestion === time
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {time}s
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'easy', label: 'Easy', emoji: '😊', color: 'green' },
                  { value: 'medium', label: 'Medium', emoji: '🎯', color: 'yellow' },
                  { value: 'hard', label: 'Hard', emoji: '🔥', color: 'red' }
                ].map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setDifficulty(level.value)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      difficulty === level.value
                        ? `border-${level.color}-500 bg-${level.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-3xl mb-1">{level.emoji}</div>
                    <div className="font-semibold">{level.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Max Participants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Participants: <span className="text-primary-600 font-bold">{maxParticipants}</span>
              </label>
              <input
                type="range"
                min="2"
                max="100"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>2</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Next Button */}
            <div className="flex space-x-4 pt-4">
              <button
                onClick={() => navigate('/study-rooms')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!roomName.trim()}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Upload Document
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Document Upload */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📄 Upload Quiz Document
            </h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors">
              {!documentFile ? (
                <div>
                  <div className="text-6xl mb-4">📁</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Upload a Document
                  </h3>
                  <p className="text-gray-600 mb-4">
                    PDF, DOCX, TXT, or Image files supported
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={handleDocumentUpload}
                      className="hidden"
                    />
                    <span className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 cursor-pointer inline-block transition-colors">
                      Choose File
                    </span>
                  </label>
                </div>
              ) : uploadingDocument ? (
                <div>
                  <LoadingSpinner size="large" />
                  <p className="mt-4 text-gray-600">Processing document...</p>
                </div>
              ) : (
                <div>
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {documentFile.name}
                  </h3>
                  <p className="text-gray-600 mb-2">Document uploaded successfully!</p>
                  {documentId && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-600">Document ID:</p>
                      <p className="text-sm font-mono text-green-700">{documentId}</p>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setDocumentFile(null);
                      setDocumentId(null);
                    }}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Upload Different File
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateRoom}
                disabled={creating || uploadingDocument}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  <span className="flex items-center justify-center">
                    <LoadingSpinner size="small" />
                    <span className="ml-2">Creating Room...</span>
                  </span>
                ) : (
                  '🎮 Create Quiz Room'
                )}
              </button>
            </div>

            <p className="text-center text-sm text-gray-500">
              You can also create the room without a document and add questions manually
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateQuizRoom;

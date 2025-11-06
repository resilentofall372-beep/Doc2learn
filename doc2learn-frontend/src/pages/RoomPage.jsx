import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { roomAPI } from '../services/api';
import { useApp } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import QuizLobby from '../components/room/QuizLobby';
import LiveQuiz from '../components/room/LiveQuiz';
import QuizResults from '../components/room/QuizResults';

const RoomPage = () => {
  const { id: roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { addNotification } = useApp();
  
  // Get participant info from location state or localStorage
  const participantInfo = location.state?.participantInfo || 
    JSON.parse(localStorage.getItem('participant_info') || '{}');
  
  const hostInfo = location.state?.isHost ? 
    JSON.parse(localStorage.getItem('host_info') || '{}') : null;
  
  const isHost = location.state?.isHost || hostInfo?.room_id === roomId;

  // State
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [quizState, setQuizState] = useState('lobby'); // lobby, in_progress, completed
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [hasAnswered, setHasAnswered] = useState(false);

  // WebSocket setup
  const socket = useSocket();

  useEffect(() => {
    fetchRoomData();
  }, [roomId]);

  useEffect(() => {
    if (!socket || !room) return;

    console.log('🔌 Setting up WebSocket listeners...');

    // Join room via socket
    socket.emit('join_room', {
      room_id: roomId,
      participant_id: participantInfo.participant_id || hostInfo?.host_id,
      participant_name: participantInfo.participant_name || hostInfo?.host_name
    });

    // Socket event listeners
    socket.on('participant_joined', handleParticipantJoined);
    socket.on('participant_left', handleParticipantLeft);
    socket.on('quiz_started', handleQuizStarted);
    socket.on('answer_submitted', handleAnswerSubmitted);
    socket.on('leaderboard_update', handleLeaderboardUpdate);
    socket.on('next_question', handleReceiveNextQuestion);
    socket.on('quiz_completed', handleQuizCompleted);

    return () => {
      console.log('🔌 Cleaning up WebSocket listeners...');
      socket.off('participant_joined', handleParticipantJoined);
      socket.off('participant_left', handleParticipantLeft);
      socket.off('quiz_started', handleQuizStarted);
      socket.off('answer_submitted', handleAnswerSubmitted);
      socket.off('leaderboard_update', handleLeaderboardUpdate);
      socket.off('next_question', handleReceiveNextQuestion);
      socket.off('quiz_completed', handleQuizCompleted);
      
      socket.emit('leave_room', {
        room_id: roomId,
        participant_id: participantInfo.participant_id || hostInfo?.host_id,
        participant_name: participantInfo.participant_name || hostInfo?.host_name
      });
    };
  }, [socket, room, roomId]);

  const fetchRoomData = async () => {
    try {
      setLoading(true);
      const response = await roomAPI.getRoom(roomId);
      
      if (response.data.success) {
        const roomData = response.data.room;
        setRoom(roomData);
        setParticipants(roomData.participants || []);
        setQuizState(roomData.quiz_state || 'lobby');
        setQuestions(roomData.questions || []);
        setCurrentQuestionIndex(roomData.current_question_index || 0);
      }
    } catch (error) {
      console.error('Error fetching room:', error);
      addNotification({
        type: 'error',
        title: 'Room Not Found',
        message: 'This room does not exist or has been closed'
      });
      setTimeout(() => navigate('/study-rooms'), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Socket event handlers
  const handleParticipantJoined = (data) => {
    console.log('👤 Participant joined:', data);
    setParticipants(data.participants || []);
    addNotification({
      type: 'info',
      title: 'New Participant',
      message: data.message
    });
  };

  const handleParticipantLeft = (data) => {
    console.log('👋 Participant left:', data);
    setParticipants(data.participants || []);
    addNotification({
      type: 'info',
      title: 'Participant Left',
      message: data.message
    });
  };

  const handleQuizStarted = (data) => {
    console.log('🎮 Quiz started:', data);
    setQuizState('in_progress');
    setQuestions(data.question ? [data.question] : []);
    setCurrentQuestionIndex(0);
    setHasAnswered(false);
    addNotification({
      type: 'success',
      title: 'Quiz Started!',
      message: `Get ready for ${data.total_questions} questions!`
    });
  };

  const handleAnswerSubmitted = (data) => {
    console.log('✅ Answer submitted:', data);
    // Update visual feedback that someone answered
  };

  const handleLeaderboardUpdate = (data) => {
    console.log('📊 Leaderboard update:', data);
    setParticipants(data.leaderboard || []);
  };

  const handleReceiveNextQuestion = (data) => {
    console.log('➡️ Next question:', data);
    setCurrentQuestionIndex(data.question_index);
    setQuestions(prev => [...prev, data.question]);
    setHasAnswered(false);
  };

  const handleQuizCompleted = (data) => {
    console.log('🏁 Quiz completed:', data);
    setQuizState('completed');
    setParticipants(data.leaderboard || []);
    addNotification({
      type: 'success',
      title: 'Quiz Complete!',
      message: 'Check out the final results!'
    });
  };

  // Actions
  const handleStartQuiz = (quizQuestions) => {
    if (!socket) {
      addNotification({
        type: 'error',
        title: 'Connection Error',
        message: 'Not connected to server'
      });
      return;
    }

    console.log('🎮 Starting quiz with questions:', quizQuestions);
    
    socket.emit('start_quiz', {
      room_id: roomId,
      questions: quizQuestions,
      host_id: hostInfo?.host_id || participantInfo.participant_id
    });
  };

  const handleSubmitAnswer = (answerData) => {
    if (!socket || hasAnswered) return;

    console.log('📝 Submitting answer:', answerData);
    setHasAnswered(true);

    socket.emit('submit_answer', {
      room_id: roomId,
      participant_id: participantInfo.participant_id || hostInfo?.host_id,
      question_index: currentQuestionIndex,
      selected_answer: answerData.selected_answer,
      answer_time: answerData.answer_time,
      max_time: answerData.max_time
    });
  };

  const handleNextQuestion = () => {
    if (!socket || !isHost) return;

    console.log('➡️ Moving to next question');
    
    socket.emit('next_question', {
      room_id: roomId
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-gray-600">Loading room...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Room Not Found</h2>
        <p className="text-gray-600 mb-6">This room does not exist or has been closed</p>
        <button
          onClick={() => navigate('/study-rooms')}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Go to Study Rooms
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      {/* Lobby */}
      {quizState === 'lobby' && (
        <QuizLobby
          room={room}
          isHost={isHost}
          onStartQuiz={handleStartQuiz}
          participantInfo={participantInfo}
        />
      )}

      {/* Live Quiz */}
      {quizState === 'in_progress' && questions[currentQuestionIndex] && (
        <LiveQuiz
          room={room}
          currentQuestion={questions[currentQuestionIndex]}
          currentQuestionIndex={currentQuestionIndex}
          totalQuestions={room.num_questions}
          onSubmitAnswer={handleSubmitAnswer}
          hasAnswered={hasAnswered}
          participants={participants}
          isHost={isHost}
          onNextQuestion={handleNextQuestion}
        />
      )}

      {/* Results */}
      {quizState === 'completed' && (
        <QuizResults
          room={room}
          participants={participants}
          totalQuestions={room.num_questions}
          isHost={isHost}
        />
      )}
    </div>
  );
};

export default RoomPage;
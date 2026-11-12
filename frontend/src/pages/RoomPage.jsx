import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { errorMessage, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useApp } from '../contexts/AppContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import QuizLobby from '../components/room/QuizLobby';
import LiveQuiz from '../components/room/LiveQuiz';
import QuizResults from '../components/room/QuizResults';

const RoomPage = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useApp();
  const { socket, isConnected } = useSocket();

  const identity = roomIdentity.load(roomId);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [quizState, setQuizState] = useState('lobby');
  const [question, setQuestion] = useState(null); // {question_index, question, total_questions}
  const [lastResult, setLastResult] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [review, setReview] = useState([]);
  const joinedRef = useRef(false);

  const isHost = Boolean(identity?.is_host) || (room && identity && room.host_id === identity.participant_id);

  const credentials = useCallback(
    () => ({ room_id: roomId, participant_id: identity?.participant_id, participant_token: identity?.participant_token }),
    [roomId, identity?.participant_id, identity?.participant_token]
  );

  useEffect(() => {
    if (!identity) {
      // Never joined this room in this browser: send them through the join page.
      roomAPI
        .getRoom(roomId)
        .then((res) => navigate(`/join/${res.data.room.room_code}`, { replace: true }))
        .catch(() => navigate('/study-rooms', { replace: true }));
      return;
    }
    roomAPI
      .getRoom(roomId)
      .then((res) => {
        const data = res.data.room;
        setRoom(data);
        setParticipants(data.participants || []);
        setQuizState(data.quiz_state);
        if (data.quiz_state === 'in_progress' && data.questions?.length) {
          setQuestion({
            question_index: data.current_question_index,
            question: data.questions[data.current_question_index],
            total_questions: data.questions.length,
          });
        }
      })
      .catch((error) => {
        addNotification({ type: 'error', title: 'Room unavailable', message: errorMessage(error) });
        navigate('/study-rooms');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    if (!socket || !identity || !room) return undefined;

    const onJoined = ({ room: fresh }) => {
      setParticipants(fresh.participants || []);
      setQuizState(fresh.quiz_state);
    };
    const onParticipants = ({ participants: list, message }) => {
      setParticipants(list || []);
      if (message) addNotification({ type: 'info', title: 'Room', message });
    };
    const onRoomClosed = () => {
      addNotification({ type: 'info', title: 'Room closed', message: 'The host ended this room.' });
      roomIdentity.clear(roomId);
      navigate('/study-rooms');
    };
    const onQuestion = (payload) => {
      setQuizState('in_progress');
      setQuestion(payload);
      setHasAnswered(false);
      setLastResult(null);
    };
    const onAnswerResult = (result) => setLastResult(result);
    const onLeaderboard = ({ leaderboard }) => setParticipants(leaderboard || []);
    const onCompleted = ({ leaderboard, questions }) => {
      setQuizState('completed');
      setParticipants(leaderboard || []);
      setReview(questions || []);
    };
    const onError = ({ message }) => addNotification({ type: 'error', title: 'Room error', message });

    socket.on('joined', onJoined);
    socket.on('participant_joined', onParticipants);
    socket.on('participant_left', onParticipants);
    socket.on('room_closed', onRoomClosed);
    socket.on('quiz_started', onQuestion);
    socket.on('next_question', onQuestion);
    socket.on('answer_result', onAnswerResult);
    socket.on('leaderboard_update', onLeaderboard);
    socket.on('quiz_completed', onCompleted);
    socket.on('error', onError);

    const join = () => socket.emit('join_room', credentials());
    if (socket.connected) join();
    socket.on('connect', join); // also re-joins after a reconnect
    joinedRef.current = true;

    return () => {
      socket.off('joined', onJoined);
      socket.off('participant_joined', onParticipants);
      socket.off('participant_left', onParticipants);
      socket.off('room_closed', onRoomClosed);
      socket.off('quiz_started', onQuestion);
      socket.off('next_question', onQuestion);
      socket.off('answer_result', onAnswerResult);
      socket.off('leaderboard_update', onLeaderboard);
      socket.off('quiz_completed', onCompleted);
      socket.off('error', onError);
      socket.off('connect', join);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, room?.room_id]);

  const startQuiz = (questions) => socket?.emit('start_quiz', { ...credentials(), questions });
  const submitAnswer = ({ selected_answer }) => {
    if (hasAnswered || !question) return;
    setHasAnswered(true);
    socket?.emit('submit_answer', { ...credentials(), question_index: question.question_index, selected_answer });
  };
  const nextQuestion = () => socket?.emit('next_question', credentials());
  const leave = async () => {
    try {
      await roomAPI.leave(credentials());
    } catch {
      /* leaving is best-effort */
    }
    roomIdentity.clear(roomId);
    navigate('/study-rooms');
  };

  if (loading || !room) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <LoadingSpinner size="large" />
        <p className="mt-4 text-gray-600">Loading room…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4 text-sm">
        <span className={`px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {isConnected ? 'Connected' : 'Reconnecting…'}
        </span>
        <button type="button" onClick={leave} className="text-red-600 hover:underline">
          {isHost ? 'Close room' : 'Leave room'}
        </button>
      </div>

      {quizState === 'lobby' && (
        <QuizLobby room={{ ...room, participants }} isHost={isHost} onStartQuiz={startQuiz} />
      )}

      {quizState === 'in_progress' && question && (
        <LiveQuiz
          room={room}
          currentQuestion={question.question}
          currentQuestionIndex={question.question_index}
          totalQuestions={question.total_questions}
          onSubmitAnswer={submitAnswer}
          hasAnswered={hasAnswered}
          lastResult={lastResult}
          participants={participants}
          isHost={isHost}
          onNextQuestion={nextQuestion}
        />
      )}

      {quizState === 'completed' && (
        <QuizResults room={room} participants={participants} totalQuestions={review.length || room.num_questions} isHost={isHost} review={review} />
      )}

      {quizState === 'closed' && (
        <div className="text-center py-12 text-gray-600">This room has been closed by the host.</div>
      )}
    </div>
  );
};

export default RoomPage;

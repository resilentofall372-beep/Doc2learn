import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { errorMessage, roomAPI } from '../services/api';
import { roomIdentity } from '../services/socket';
import { useApp } from '../contexts/AppContext';
import { LogOut } from 'lucide-react';
import { PageLoader } from '../components/common/LoadingSpinner';
import QuizLobby from '../components/room/QuizLobby';
import LiveQuiz from '../components/room/LiveQuiz';
import RoomResults from '../components/room/RoomResults';

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
        if (data.quiz_state === 'completed') setReview(data.questions || []);
        if (data.quiz_state === 'in_progress' && data.questions?.length) {
          setQuestion({
            question_index: data.current_question_index,
            question: data.questions[data.current_question_index],
            total_questions: data.questions.length,
            question_started_at: data.question_started_at,
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
    // Joins show up in the player list itself; only departures get a toast.
    const onParticipants = ({ participants: list }) => setParticipants(list || []);
    const onParticipantLeft = ({ participants: list, message }) => {
      setParticipants(list || []);
      if (message) addNotification({ type: 'info', title: 'Player left', message });
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
    socket.on('participant_left', onParticipantLeft);
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
      socket.off('participant_left', onParticipantLeft);
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

  if (loading || !room) return <PageLoader label="Loading quiz…" />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{room.room_name}</h1>
          <p className="muted mt-0.5 flex items-center gap-2 text-xs">
            {quizState === 'completed' ? (
              <span>Finished</span>
            ) : (
              <>
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'animate-pulse bg-amber-500'}`} />
                {isConnected ? (quizState === 'lobby' ? 'Waiting for players' : 'Live') : 'Reconnecting…'}
              </>
            )}
            <span>·</span>
            <span className="font-mono">{room.room_code}</span>
            {isHost && (
              <>
                <span>·</span>
                <span>You are hosting</span>
              </>
            )}
          </p>
        </div>
        <button type="button" onClick={leave} className="btn btn-secondary btn-sm">
          <LogOut className="h-3.5 w-3.5" />
          {quizState === 'completed' ? (isHost ? 'Close room' : 'Leave') : isHost ? 'End quiz' : 'Leave'}
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
          startedAt={question.question_started_at}
        />
      )}

      {quizState === 'completed' && (
        <RoomResults room={room} participants={participants} totalQuestions={review.length || room.num_questions} isHost={isHost} review={review} />
      )}

      {quizState === 'closed' && (
        <div className="card muted px-6 py-12 text-center text-sm">The host has ended this quiz.</div>
      )}
    </div>
  );
};

export default RoomPage;

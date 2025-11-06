import React, { createContext, useContext, useEffect, useState } from 'react';
import socketService from '../services/socket';
import { useAuth } from '../hooks/useAuth'; // ✅ Use only one import

// ✅ Export the context itself
export const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomUsers, setRoomUsers] = useState([]);
  const [roomMessages, setRoomMessages] = useState([]);
  const { user } = useAuth();

  const connectToRoom = (roomId) => {
    if (!roomId) return;

    const socketInstance = socketService.connect(roomId);
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('✅ Connected to room:', roomId);
      setIsConnected(true);
      
      // Join room with user data
      socketInstance.emit('join_room', {
        roomId,
        user: {
          id: user?.user_id,
          name: user?.name,
          email: user?.email
        }
      });
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Disconnected from room');
      setIsConnected(false);
      setRoomUsers([]);
      setRoomMessages([]);
    });

    socketInstance.on('user_joined', (data) => {
      console.log('User joined:', data);
      setRoomUsers(prev => {
        const userExists = prev.find(u => u.id === data.user.id);
        if (!userExists) {
          return [...prev, data.user];
        }
        return prev;
      });
      
      setRoomMessages(prev => [...prev, {
        type: 'system',
        message: `${data.user.name} joined the room`,
        timestamp: new Date().toISOString()
      }]);
    });

    socketInstance.on('user_left', (data) => {
      console.log('User left:', data);
      setRoomUsers(prev => prev.filter(u => u.id !== data.userId));
      
      setRoomMessages(prev => [...prev, {
        type: 'system',
        message: `${data.userName} left the room`,
        timestamp: new Date().toISOString()
      }]);
    });

    socketInstance.on('room_users', (users) => {
      setRoomUsers(users);
    });

    socketInstance.on('receive_message', (message) => {
      setRoomMessages(prev => [...prev, {
        ...message,
        timestamp: new Date().toISOString()
      }]);
    });

    socketInstance.on('start_quiz', (data) => {
      // Handle quiz start event
      console.log('Quiz started:', data);
    });

    socketInstance.on('submit_answer', (data) => {
      // Handle answer submission
      console.log('Answer submitted:', data);
    });

    socketInstance.on('flip_flashcard', (data) => {
      // Handle flashcard flip
      console.log('Flashcard flipped:', data);
    });

    return socketInstance;
  };

  const disconnectFromRoom = () => {
    if (socket) {
      socketService.disconnect();
      setSocket(null);
      setIsConnected(false);
      setRoomUsers([]);
      setRoomMessages([]);
    }
  };

  const sendMessage = (message) => {
    if (socket && isConnected) {
      socket.emit('send_message', {
        message,
        user: {
          id: user?.user_id,
          name: user?.name
        },
        timestamp: new Date().toISOString()
      });
    }
  };

  const startQuiz = (quizData) => {
    if (socket && isConnected) {
      socket.emit('start_quiz', quizData);
    }
  };

  const submitAnswer = (answerData) => {
    if (socket && isConnected) {
      socket.emit('submit_answer', answerData);
    }
  };

  const flipFlashcard = (flashcardData) => {
    if (socket && isConnected) {
      socket.emit('flip_flashcard', flashcardData);
    }
  };

  useEffect(() => {
    return () => {
      disconnectFromRoom();
    };
  }, []);

  const value = {
    socket,
    isConnected,
    roomUsers,
    roomMessages,
    connectToRoom,
    disconnectFromRoom,
    sendMessage,
    startQuiz,
    submitAnswer,
    flipFlashcard
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
// Socket.IO connection factory. The server address defaults to the page origin,
// which Vite proxies to the backend in development; the hosted build sets VITE_SOCKET_URL.
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

export const createSocket = () =>
  io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

/** Per-room participant credentials live in localStorage so a refresh keeps you in the room. */
const key = (roomId) => `doc2learn.room.${roomId}`;

export const roomIdentity = {
  save: (roomId, identity) => {
    try {
      localStorage.setItem(key(roomId), JSON.stringify(identity));
    } catch {
      /* storage unavailable; the user can rejoin by code */
    }
  },
  load: (roomId) => {
    try {
      return JSON.parse(localStorage.getItem(key(roomId)) || 'null');
    } catch {
      return null;
    }
  },
  clear: (roomId) => {
    try {
      localStorage.removeItem(key(roomId));
    } catch {
      /* ignore */
    }
  },
};

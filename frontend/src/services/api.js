// Single HTTP client for the Doc2Learn API.
// In development Vite proxies /api to the backend; in Docker nginx does the same,
// so the default base URL is relative and works in both.
import axios from 'axios';
import { storage } from './storage';
import { STORAGE_KEYS } from '../utils/constants';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // generation calls can take a while
});

api.interceptors.request.use((config) => {
  const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && storage.get(STORAGE_KEYS.AUTH_TOKEN)) {
      // Token expired or revoked: drop the session and send the user to login.
      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(STORAGE_KEYS.USER_DATA);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from any axios error. */
export const errorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.error || error?.message || fallback;

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const documentAPI = {
  uploadDocument: (formData) =>
    api.post('/document/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getDocuments: () => api.get('/document/'),
  getDocument: (documentId) => api.get(`/document/${documentId}`),
  deleteDocument: (documentId) => api.delete(`/document/${documentId}`),
  generateQuiz: ({ document_id, num_questions, difficulty, focus }) =>
    api.post('/document/generate-quiz', { document_id, num_questions, difficulty, focus }),
  generateFlashcards: ({ document_id, num_cards }) =>
    api.post('/document/generate-flashcards', { document_id, num_cards }),
  generateMindmap: ({ document_id }) => api.post('/document/generate-mindmap', { document_id }),
};

export const quizAPI = {
  submitQuiz: ({ quiz_id, answers, time_spent_seconds }) =>
    api.post('/quiz/submit', { quiz_id, answers, time_spent_seconds }),
  getQuiz: (quizId) => api.get(`/quiz/${quizId}`),
  getDocumentAttempts: (documentId) => api.get(`/quiz/document/${documentId}`),
};

export const flashcardsAPI = {
  generate: documentAPI.generateFlashcards,
  getFlashcards: (documentId) => api.get(`/flashcards/document/${documentId}`),
};

export const mindmapAPI = {
  generate: documentAPI.generateMindmap,
  getMindmap: (documentId) => api.get(`/mindmap/document/${documentId}`),
};

export const assistantAPI = {
  chat: (documentId, question) => api.post('/assistant/chat', { document_id: documentId, question }),
  explainConcept: (documentId, concept) => api.post('/assistant/explain', { document_id: documentId, concept }),
  generatePractice: (documentId, topic, numProblems = 5) =>
    api.post('/assistant/practice', { document_id: documentId, topic, num_problems: numProblems }),
  summarizeDocument: (documentId, summaryType = 'brief') =>
    api.post('/assistant/summarize', { document_id: documentId, summary_type: summaryType }),
  createStudyPlan: (documentId, weakAreas, days = 7) =>
    api.post('/assistant/study-plan', { document_id: documentId, weak_areas: weakAreas, days }),
  getChatHistory: (documentId) => api.get(`/assistant/chat/history/${documentId}`),
  clearChat: (sessionId) => api.post('/assistant/chat/clear', { session_id: sessionId }),
};

export const statsAPI = {
  me: () => api.get('/stats/me'),
};

export const roomAPI = {
  create: (data) => api.post('/room/create', data),
  join: (data) => api.post('/room/join', data),
  getRooms: () => api.get('/room/rooms'),
  getRoom: (roomId) => api.get(`/room/${roomId}`),
  getRoomByCode: (roomCode) => api.get(`/room/code/${roomCode}`),
  leave: (data) => api.post('/room/leave', data),
};

export default api;

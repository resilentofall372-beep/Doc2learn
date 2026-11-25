// Single HTTP client for the Doc2Learn API.
// In development Vite proxies /api to the backend, so the default base URL is
// relative; the hosted build sets VITE_API_BASE_URL to the Render API.
import axios from 'axios';
import { storage } from './storage';
import { STORAGE_KEYS } from '../utils/constants';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

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
      // Token expired or revoked (e.g. logged out on another device): drop the session.
      storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      storage.remove(STORAGE_KEYS.USER_DATA);
      if (!['/login', '/signup', '/'].includes(window.location.pathname)) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from any axios error. */
export const errorMessage = (error, fallback = 'Something went wrong') =>
  error?.response?.data?.error || error?.message || fallback;

/** Request body for a scope: the whole project, or one document in it. */
const scope = (projectId, documentId) => ({ project_id: projectId, ...(documentId ? { document_id: documentId } : {}) });

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const projectAPI = {
  list: () => api.get('/projects/'),
  create: (data) => api.post('/projects/', data),
  get: (projectId) => api.get(`/projects/${projectId}`),
  update: (projectId, data) => api.patch(`/projects/${projectId}`, data),
  remove: (projectId) => api.delete(`/projects/${projectId}`),
  stats: (projectId) => api.get(`/projects/${projectId}/stats`),
  /** Topic progress, cards due, next step, quiz stats and the saved study plan. */
  overview: (projectId) => api.get(`/projects/${projectId}/overview`),
};

export const documentAPI = {
  upload: (projectId, file) => {
    const form = new FormData();
    form.append('project_id', projectId);
    form.append('file', file);
    return api.post('/document/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  paste: (projectId, title, text) => api.post('/document/paste', { project_id: projectId, title, text }),
  deleteDocument: (documentId) => api.delete(`/document/${documentId}`),
  generateQuiz: ({ projectId, documentId, topicId, num_questions, difficulty, focus }) =>
    api.post('/document/generate-quiz', {
      ...scope(projectId, documentId),
      ...(topicId ? { topic_id: topicId } : {}),
      num_questions,
      difficulty,
      focus,
    }),
  generateFlashcards: ({ projectId, documentId, topicId, num_cards }) =>
    api.post('/document/generate-flashcards', {
      ...scope(projectId, documentId),
      ...(topicId ? { topic_id: topicId } : {}),
      num_cards,
    }),
  generateMindmap: ({ projectId, documentId }) => api.post('/document/generate-mindmap', scope(projectId, documentId)),
};

export const quizAPI = {
  submitQuiz: ({ quiz_id, answers, time_spent_seconds }) =>
    api.post('/quiz/submit', { quiz_id, answers, time_spent_seconds }),
};

export const flashcardsAPI = {
  generate: documentAPI.generateFlashcards,
  getFlashcards: (projectId, documentId, topicId) =>
    api.get('/flashcards/', { params: { ...scope(projectId, documentId), ...(topicId ? { topic_id: topicId } : {}) } }),
  /** Rate a card: 'again' | 'hard' | 'good' | 'easy'. Schedules its next review. */
  review: (projectId, card, rating, documentId) =>
    api.post('/flashcards/review', { project_id: projectId, card, rating, ...(documentId ? { document_id: documentId } : {}) }),
  /** Cards due now (optionally for one topic). `total` counts all of them. */
  due: (projectId, topicId, limit = 100) =>
    api.get('/flashcards/due', { params: { project_id: projectId, limit, ...(topicId ? { topic_id: topicId } : {}) } }),
};

/** A project's topic outline. */
export const topicsAPI = {
  get: (projectId) => api.get('/topics/', { params: { project_id: projectId } }),
  /** mode 'update' folds in new documents (or builds the first outline); 'rebuild' starts over. */
  build: (projectId, mode = 'update') => api.post('/topics/build', { project_id: projectId, mode }),
  save: (projectId, topics) => api.put('/topics/', { project_id: projectId, topics }),
};

export const mindmapAPI = {
  generate: documentAPI.generateMindmap,
  getMindmap: (projectId, documentId) => api.get('/mindmap/', { params: scope(projectId, documentId) }),
};

export const assistantAPI = {
  chat: (projectId, question) => api.post('/assistant/chat', { project_id: projectId, question }),
  explainConcept: (projectId, documentId, concept) =>
    api.post('/assistant/explain', { ...scope(projectId, documentId), concept }),
  generatePractice: (projectId, documentId, topic, numProblems = 5) =>
    api.post('/assistant/practice', { ...scope(projectId, documentId), topic, num_problems: numProblems }),
  summarize: (projectId, documentId, summaryType = 'brief') =>
    api.post('/assistant/summarize', { ...scope(projectId, documentId), summary_type: summaryType }),
  createStudyPlan: (projectId, documentId, weakAreas, days = 7) =>
    api.post('/assistant/study-plan', { ...scope(projectId, documentId), weak_areas: weakAreas, days }),
  markPlanDay: (projectId, day, done = true) => api.post(`/assistant/study-plan/${projectId}/done`, { day, done }),
  getChatHistory: (projectId) => api.get(`/assistant/chat/history/${projectId}`),
  clearChat: (sessionId) => api.post('/assistant/chat/clear', { session_id: sessionId }),
};

export const healthAPI = {
  get: () => api.get('/health'),
};

export const statsAPI = {
  /** What to do today across projects. */
  today: () => api.get('/stats/today'),
};

export const roomAPI = {
  create: (data) => api.post('/room/create', data),
  join: (data) => api.post('/room/join', data),
  /** Your own open rooms (rooms are never listed to anyone else). */
  getRooms: () => api.get('/room/rooms'),
  getRoom: (roomId) => api.get(`/room/${roomId}`),
  getRoomByCode: (roomCode) => api.get(`/room/code/${roomCode}`),
  leave: (data) => api.post('/room/leave', data),
  /** Host only: questions are generated and kept on the server. */
  generateQuestions: (roomId, credentials) => api.post(`/room/${roomId}/questions`, credentials),
  /** Host only: replace the invite code; people already inside stay. */
  newCode: (roomId, credentials) => api.post(`/room/${roomId}/new-code`, credentials),
};

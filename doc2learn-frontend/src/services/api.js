// src/services/api.js - COMPLETE WITH ALL EXPORTS
import axios from 'axios';

// Use environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

console.log('🔗 API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`🚀 Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Response received from: ${response.config.url}`, response.status);
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data
    });
    
    return Promise.reject(error);
  }
);

// Document API
export const documentAPI = {
  uploadDocument: (formData) => {
    return api.post('/document/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000,
    });
  },
  
  getDocuments: (userId) => {
    return api.get(`/document/user/${userId}`);
  },
  
  getDocument: (documentId) => {
    return api.get(`/document/${documentId}`);
  },
  
  generateQuiz: (data) => {
    return api.post('/document/generate-quiz', data);
  },
  
  generateFlashcards: (data) => {
    return api.post('/document/generate-flashcards', data);
  },
  
  generateMindmap: (data) => {
    return api.post('/document/generate-mindmap', data);
  },
  
  askQuestion: (data) => {
    return api.post('/document/ask', data);
  },
};

// Quiz API
export const quizAPI = {
  submitQuiz: (data) => {
    return api.post('/quiz/submit', data);
  },
  
  getQuiz: (quizId) => {
    return api.get(`/quiz/${quizId}`);
  },
  
  getDocumentQuizzes: (documentId) => {
    return api.get(`/quiz/document/${documentId}`);
  },
};

// Room API - ADD THIS MISSING EXPORT
export const roomAPI = {
  create: (data) => {
    return api.post('/room/create', data);
  },
  
  join: (data) => {
    return api.post('/room/join', data);
  },
  
  getRooms: () => {
    return api.get('/room/rooms');
  },
  
  getRoom: (roomId) => {
    return api.get(`/room/${roomId}`);
  },
  
  getRoomByCode: (roomCode) => {
    return api.get(`/room/code/${roomCode}`);
  },
  
  uploadQuestions: (data) => {
    return api.post('/room/upload-questions', data);
  },
  
  leave: (data) => {
    return api.post('/room/leave', data);
  },
  
  getStats: () => {
    return api.get('/room/stats');
  },
};

// Flashcards API
export const flashcardsAPI = {
  generate: (data) => {
    return api.post('/document/generate-flashcards', data);
  },
  
  getFlashcards: (documentId) => {
    return api.get(`/flashcards/document/${documentId}`);
  },
};

// Mindmap API
export const mindmapAPI = {
  generate: (data) => {
    return api.post('/document/generate-mindmap', data);
  },
  
  getMindmap: (documentId) => {
    return api.get(`/mindmap/document/${documentId}`);
  },
};

// AI Assistant API
export const assistantAPI = {
  chat: (documentId, userId, question) => {
    return api.post('/assistant/chat', { document_id: documentId, user_id: userId, question });
  },
  
  explainConcept: (documentId, concept) => {
    return api.post('/assistant/explain', { document_id: documentId, concept });
  },
  
  generatePractice: (documentId, topic, numProblems = 5) => {
    return api.post('/assistant/practice', { document_id: documentId, topic, num_problems: numProblems });
  },
  
  summarizeDocument: (documentId, summaryType = 'brief') => {
    return api.post('/assistant/summarize', { document_id: documentId, summary_type: summaryType });
  },
  
  createStudyPlan: (documentId, userId, weakAreas, days = 7) => {
    return api.post('/assistant/study-plan', { document_id: documentId, user_id: userId, weak_areas: weakAreas, days });
  },
  
  getChatHistory: (documentId, userId) => {
    return api.get(`/assistant/chat/history/${documentId}/${userId}`);
  },
  
  clearChat: (sessionId) => {
    return api.post('/assistant/chat/clear', { session_id: sessionId });
  },
};

// Auth API
export const authAPI = {
  verifyToken: (token) => {
    return api.post('/auth/verify-token', { token });
  },
  
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },
  
  register: (userData) => {
    return api.post('/auth/register', userData);
  },
};

export default api;
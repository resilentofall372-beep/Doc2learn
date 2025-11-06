// src/utils/constants.js - UPDATED
export const APP_CONFIG = {
  APP_NAME: import.meta.env.VITE_APP_NAME || 'Doc2Learn',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  SOCKET_URL: import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000',
};

export const QUIZ_PREFERENCES = {
  DEFAULT_NUM_QUESTIONS: 5,
  DEFAULT_DIFFICULTY: 'medium',
  DIFFICULTY_LEVELS: ['easy', 'medium', 'hard'],
  QUESTION_TYPES: ['multiple_choice', 'true_false', 'short_answer'],
  DEFAULT_TIME_PER_QUESTION: 60, // seconds
};

export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB
  ALLOWED_FILE_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/jpg'
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.pptx', '.txt', '.jpg', '.jpeg', '.png']
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'user',
  RECENT_DOCUMENTS: 'recentDocuments'
};
export const QUIZ_PREFERENCES = {
  QUESTION_COUNTS: [3, 5, 10, 15, 20],
};

export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB, matches the backend limit
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.pptx', '.txt', '.md', '.jpg', '.jpeg', '.png'],
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'doc2learn.token',
  USER_DATA: 'doc2learn.user',
};

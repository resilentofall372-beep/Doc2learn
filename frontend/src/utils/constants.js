export const QUIZ_PREFERENCES = {
  QUESTION_COUNTS: [3, 5, 10, 15, 20],
};

/** Quiz difficulty, the same everywhere (practice quizzes and live quizzes). */
export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy', hint: 'Recall' },
  { value: 'medium', label: 'Medium', hint: 'Understanding' },
  { value: 'hard', label: 'Hard', hint: 'Analysis' },
];

/** "1 quiz", "3 quizzes". */
export const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 16 * 1024 * 1024, // 16MB, matches the backend limit
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.pptx', '.txt', '.md', '.jpg', '.jpeg', '.png'],
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'doc2learn.token',
  USER_DATA: 'doc2learn.user',
};

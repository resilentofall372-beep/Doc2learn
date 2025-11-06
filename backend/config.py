# backend/config.py - UPDATED
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'doc2learn-secret-key')
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/doc2learn')
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', 'dummy-key-for-now')
    
    # OpenAI settings
    OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o-mini')
    OPENAI_MAX_TOKENS = int(os.environ.get('OPENAI_MAX_TOKENS', 2000))
    
    # Quiz settings
    DEFAULT_NUM_QUESTIONS = 5
    DEFAULT_DIFFICULTY = 'medium'
    DEFAULT_TIME_PER_QUESTION = 60  # seconds
    
    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'pdf', 'docx', 'pptx', 'txt', 'jpg', 'jpeg', 'png'}

    if not OPENAI_API_KEY or OPENAI_API_KEY == 'dummy-key-for-now':
        print("⚠️ WARNING: OPENAI_API_KEY not found or using dummy key")
    
    if not MONGO_URI:
        print("⚠️ WARNING: MONGO_URI not found, using default local MongoDB")
"""Configuration, read from environment variables (and a local .env file)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
    # Sessions last a day; logging out revokes every token for the user immediately.
    JWT_EXPIRES_HOURS = int(os.environ.get("JWT_EXPIRES_HOURS", "24"))
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/doc2learn")

    CORS_ORIGINS = _csv(
        os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://localhost:8080",
        )
    )

    # Address other devices use to reach the app (for quiz invite links). Optional.
    PUBLIC_URL = os.environ.get("PUBLIC_URL", "").strip().rstrip("/")

    # LLM access goes through OpenRouter (OpenAI-compatible API).
    # LLM_* names are preferred; the OPENROUTER_* names still work as a fallback.
    LLM_API_KEY = os.environ.get("LLM_API_KEY") or os.environ.get("OPENROUTER_API_KEY", "")
    LLM_BASE_URL = os.environ.get("LLM_BASE_URL") or os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    LLM_MODEL = os.environ.get("LLM_MODEL", "gemini-3.1-flash-lite")
    LLM_TEMPERATURE = float(os.environ.get("LLM_TEMPERATURE", "0.4"))
    LLM_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "2500"))
    # Tried in order when the main model is overloaded, slow, retired or returns nothing.
    LLM_FALLBACK_MODELS = _csv(os.environ.get("LLM_FALLBACK_MODELS", ""))
    # Per-model timeout; kept short so a stuck model falls through to the next one quickly.
    LLM_TIMEOUT_SECONDS = int(os.environ.get("LLM_TIMEOUT_SECONDS", "45"))

    # Retrieval
    EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    EMBEDDINGS_ENABLED = os.environ.get("EMBEDDINGS_ENABLED", "true").lower() == "true"
    CHUNK_SIZE_CHARS = int(os.environ.get("CHUNK_SIZE_CHARS", "900"))
    CHUNK_OVERLAP_CHARS = int(os.environ.get("CHUNK_OVERLAP_CHARS", "150"))

    # Uploads
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_BYTES", str(16 * 1024 * 1024)))
    ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx", "txt", "md", "jpg", "jpeg", "png"}
    MAX_DOCUMENT_CHARS = int(os.environ.get("MAX_DOCUMENT_CHARS", "400000"))


class TestConfig(Config):
    TESTING = True
    SECRET_KEY = "test-secret"
    EMBEDDINGS_ENABLED = False
    LLM_API_KEY = "test-key"

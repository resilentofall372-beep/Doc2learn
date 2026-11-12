FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FASTEMBED_CACHE_PATH=/models

# tesseract gives OCR for images and scanned PDFs
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model so the first upload is fast. Set to "false"
# to skip (the app falls back to keyword retrieval if the model is missing).
ARG PREFETCH_EMBEDDINGS=true
RUN if [ "$PREFETCH_EMBEDDINGS" = "true" ]; then \
      python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"; \
    fi

COPY . .

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS http://localhost:5000/api/health || exit 1

CMD ["gunicorn", "-k", "gthread", "--threads", "32", "-w", "1", "-b", "0.0.0.0:5000", "--timeout", "180", "run:app"]

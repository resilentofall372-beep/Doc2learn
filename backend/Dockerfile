FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FASTEMBED_CACHE_PATH=/models

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
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

# Pre-download the Indra OCR weights (images and scanned PDF pages) so the
# first scanned upload doesn't wait on a download.
RUN python -c "import indra_ocr; indra_ocr.load(threads=1)"

COPY . .

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -fsS "http://localhost:${PORT:-5000}/api/health" || exit 1

# Hosts like Render set $PORT; locally it stays 5000.
CMD ["sh", "-c", "exec gunicorn -k gthread --threads 32 -w 1 -b 0.0.0.0:${PORT:-5000} --timeout 180 run:app"]

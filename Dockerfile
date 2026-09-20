# =============================================================
# FinancIAs — Multi-stage Dockerfile (no docker-compose needed)
# =============================================================
#
# Build:
#   docker build -t financias .
#
# Run PostgreSQL first:
#   docker run -d --name financias-db \
#     -e POSTGRES_DB=financias \
#     -e POSTGRES_USER=financias \
#     -e POSTGRES_PASSWORD=financias \
#     -v financias-pgdata:/var/lib/postgresql/data \
#     -p 5432:5432 \
#     postgres:17-alpine
#
# Then run the app:
#   docker run -p 8000:8000 \
#     -e DB_HOST=host.docker.internal \
#     -e DB_NAME=financias \
#     -e DB_USER=financias \
#     -e DB_PASSWORD=financias \
#     -e SECRET_KEY=$(python -c "import secrets;print(secrets.token_urlsafe(50))") \
#     financias
#
# Or with Docker network (recommended):
#   docker network create financias-net
#   docker run -d --name financias-db --network financias-net \
#     -e POSTGRES_DB=financias \
#     -e POSTGRES_USER=financias \
#     -e POSTGRES_PASSWORD=financias \
#     -v financias-pgdata:/var/lib/postgresql/data \
#     postgres:17-alpine
#   docker run -p 8000:8000 --network financias-net \
#     -e DB_HOST=financias-db \
#     -e SECRET_KEY=tu-clave-segura \
#     financias
#
# =============================================================

# -----------------------------------------------
# Stage 1: Build frontend (Vite + React)
# -----------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# -----------------------------------------------
# Stage 2: Python backend + serve frontend
# -----------------------------------------------
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (libpq for psycopg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Copy built frontend into Django's static directory
COPY --from=frontend-builder /frontend/dist /app/frontend-dist

# Set working directory to Django project
WORKDIR /app/backend

# Create necessary directories
RUN mkdir -p logs uploads media

# -----------------------------------------------
# Environment defaults (override at runtime)
# -----------------------------------------------
ENV DEBUG=False
ENV SECRET_KEY=change-me-in-production-generate-a-real-key
ENV ALLOWED_HOSTS=*
ENV PORT=8000
ENV GUNICORN_WORKERS=2

# PostgreSQL defaults
ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_NAME=financias
ENV DB_USER=financias
ENV DB_PASSWORD=financias

# Expose port
EXPOSE 8000

# Start the app
ENTRYPOINT ["/app/entrypoint.sh"]

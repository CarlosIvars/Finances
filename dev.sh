#!/usr/bin/env bash
set -e

echo "=========================================="
echo "🚀 Starting FinancIAs (Django + React)"
echo "=========================================="

# Find virtualenv
if [ -d "venv_app" ]; then
    VENV_PATH="venv_app"
elif [ -d "venv" ]; then
    VENV_PATH="venv"
elif [ -d "venv_finance" ]; then
    VENV_PATH="venv_finance"
else
    VENV_PATH=""
fi

if [ -n "$VENV_PATH" ]; then
    echo "📦 Activating environment: $VENV_PATH"
    source "$VENV_PATH/bin/activate" 2>/dev/null || source "$VENV_PATH/Scripts/activate" 2>/dev/null || true
fi

echo "⚙️  Applying database migrations..."
python backend/manage.py migrate --noinput 2>/dev/null || python3 backend/manage.py migrate --noinput

echo "🐍 Starting Django backend -> http://localhost:8000"
(cd backend && python manage.py runserver 0.0.0.0:8000) &
BACKEND_PID=$!

echo "⚛️  Starting React frontend -> http://localhost:5173"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "🛑 Stopping Django (PID $BACKEND_PID) and React (PID $FRONTEND_PID)..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

wait $BACKEND_PID $FRONTEND_PID

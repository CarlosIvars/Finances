#!/bin/bash
set -e

echo "=== FinancIAs — Starting up ==="

# Create logs directory
mkdir -p /app/backend/logs

# Wait for PostgreSQL to be ready
if [ "$DB_ENGINE" != "sqlite3" ]; then
    echo ">>> Waiting for PostgreSQL at ${DB_HOST:-localhost}:${DB_PORT:-5432}..."
    for i in $(seq 1 30); do
        if python -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
try:
    s.connect(('${DB_HOST:-localhost}', ${DB_PORT:-5432}))
    s.close()
    exit(0)
except:
    exit(1)
" 2>/dev/null; then
            echo "  PostgreSQL is ready!"
            break
        fi
        echo "  Attempt $i/30 — waiting..."
        sleep 2
    done
fi

# Run migrations
echo ">>> Running migrations..."
python manage.py migrate --noinput

# Collect static files (frontend dist + Django admin)
echo ">>> Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if it doesn't exist
echo ">>> Ensuring admin user exists..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@financias.app', 'admin')
    print('  Created default admin user (admin/admin)')
else:
    print('  Admin user already exists')
"

echo ">>> Starting Gunicorn on port ${PORT:-8000}..."
exec gunicorn backend.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers ${GUNICORN_WORKERS:-2} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -

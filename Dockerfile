# Generic Excel Dashboarding Tool — production container
FROM python:3.12-slim

# Run as non-root for compliance (no privileged container).
RUN useradd --create-home --uid 10001 appuser
WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV PORT=8050 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER appuser
EXPOSE 8050

# gunicorn serves the Dash WSGI server object `app:server`.
# Threads keep file parsing responsive without extra memory of more workers.
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 2 --threads 4 --timeout 120 app:server"]

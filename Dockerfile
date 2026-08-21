FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend, runtime adapters, and the canonical dashboard served by app.main.
COPY backend/ ./backend/
COPY modules/ ./modules/
COPY swarm/ ./swarm/
COPY config/ ./config/
COPY dashboard/ ./dashboard/

# Set working directory
WORKDIR /app/backend

# Expose port
EXPOSE 5200

# Run
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5200"]

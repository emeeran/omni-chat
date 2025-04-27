#!/bin/bash

# Set error handling
set -e

# Create data directories if they don't exist
mkdir -p data/chats
mkdir -p data/uploads
mkdir -p data/documents/chunks
mkdir -p logs

# Log file
LOGFILE="logs/server_$(date +%Y%m%d_%H%M%S).log"
touch $LOGFILE

# Helper function for logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOGFILE
}

log "Starting OmniChat backend initialization..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    log "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
log "Installing requirements..."
pip install -r requirements.txt

# Check for missing dependencies
log "Checking for required dependencies..."
python -c "import flask, flask_cors, dotenv, requests, psutil" || {
    log "ERROR: Missing critical dependencies. Please check requirements.txt and try again."
    exit 1
}

# Kill any existing Flask processes
log "Checking for existing Flask processes..."
pkill -f "flask run" || true
sleep 1

# Define port options
PORTS=(5000 5001 5002 5003 5004 5005)
PORT=${PORT:-5000}

# Function to verify server is running
verify_server() {
    local port=$1
    log "Verifying server is running on port $port..."

    # Give the server time to start
    sleep 3

    # Test connection to server
    curl -s http://localhost:$port/api/health > /dev/null
    return $?
}

# Function to start server on given port
start_server() {
    local port=$1
    log "Starting OmniChat API server on port $port..."
    export FLASK_APP=app.py
    export FLASK_ENV=development
    export PORT=$port

    # Run Flask with detailed error logging enabled
    flask run --host=0.0.0.0 --port=$port --no-reload > >(tee -a $LOGFILE) 2>&1 &

    # Store PID
    SERVER_PID=$!
    log "Server started with PID $SERVER_PID"

    # Verify server started correctly
    if ! verify_server $port; then
        log "ERROR: Server failed to start properly on port $port."
        log "Checking server process status..."
        if kill -0 $SERVER_PID 2>/dev/null; then
            log "Process is still running but not responding. Trying to log error output..."
            kill -15 $SERVER_PID
        else
            log "Process has already terminated. See log output below:"
            tail -n 30 $LOGFILE
        fi
        return 1
    fi

    log "Server verified running on port $port"
    return 0
}

# Try primary port first
log "Starting OmniChat API server..."
start_server $PORT
status=$?

# If primary port fails, try alternatives
if [ $status -ne 0 ]; then
    for alt_port in "${PORTS[@]}"; do
        # Skip the port we already tried
        if [ "$alt_port" == "$PORT" ]; then
            continue
        fi
        log "Port $PORT failed, trying port $alt_port..."
        start_server $alt_port
        status=$?
        if [ $status -eq 0 ]; then
            break
        fi
    done
fi

if [ $status -eq 0 ]; then
    log "Server started successfully!"
    log "API is now available at http://localhost:$PORT"

    # Keep the script running and check server health periodically
    log "Press Ctrl+C to stop the server"

    # Check server health every 30 seconds
    while true; do
        sleep 30
        if ! curl -s http://localhost:$PORT/api/health > /dev/null; then
            log "WARNING: Server health check failed. The server may have stopped responding."
            if ! kill -0 $SERVER_PID 2>/dev/null; then
                log "ERROR: Server process has terminated unexpectedly."
                tail -n 30 $LOGFILE
                exit 1
            fi
        fi
    done
else
    log "ERROR: Failed to start server on any port. Check the logs for details."
    log "Common issues:"
    log "1. Missing Python dependencies"
    log "2. Port conflicts"
    log "3. Permission issues"
    log "4. Import errors in the Python code"

    log "Checking Flask app for errors..."
    export FLASK_APP=app.py
    flask routes || log "Failed to check Flask routes, app has errors"

    log "Server failed to start. See logs for details."
    exit $status
fi
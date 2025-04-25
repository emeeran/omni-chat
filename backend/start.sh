#!/bin/bash

# Create data directory if it doesn't exist
mkdir -p data/chats

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Kill any existing Flask processes
echo "Checking for existing Flask processes..."
pkill -f "flask run" || true
sleep 1

# Define port options
PORTS=(5000 5001 5002 5003 5004 5005)
PORT=${PORT:-5000}

# Function to start server on given port
start_server() {
    local port=$1
    echo "Starting OmniChat API server on port $port..."
    export FLASK_APP=app.py
    export FLASK_ENV=development
    export PORT=$port
    flask run --host=0.0.0.0 --port=$port
    return $?
}

# Try primary port first
echo "Starting OmniChat API server..."
start_server $PORT
status=$?

# If primary port fails, try alternatives
if [ $status -ne 0 ]; then
    for alt_port in "${PORTS[@]}"; do
        # Skip the port we already tried
        if [ "$alt_port" == "$PORT" ]; then
            continue
        fi
        echo "Port $PORT is in use, trying port $alt_port..."
        start_server $alt_port
        status=$?
        if [ $status -eq 0 ]; then
            break
        fi
    done
fi

echo "Server exited with status $status"
exit $status 
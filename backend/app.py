import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# Import routes after app is created
from routes import api_routes

# Register blueprints
app.register_blueprint(api_routes)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "OmniChat API is running"})

if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_ENV') == 'development', port=5000) 
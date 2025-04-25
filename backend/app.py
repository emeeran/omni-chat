import os
from flask import Flask, jsonify, request, redirect
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

@app.route('/', methods=['GET'])
def root():
    return redirect('/health')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "OmniChat API is running"})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=os.environ.get('FLASK_ENV') == 'development', host='0.0.0.0', port=port) 
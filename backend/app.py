# backend/app.py - FIXED STABLE VERSION
from flask import Flask, jsonify
from flask_socketio import SocketIO
from flask_cors import CORS
from backend.routes.auth import auth_bp
from backend.routes.document import document_bp
from backend.routes.quiz import quiz_bp
from backend.routes.room import room_bp
from backend.routes.mindmap import mindmap_bp
from backend.routes.flashcards import flashcards_bp
from backend.routes.assistant import assistant_bp  # AI Study Assistant
# from backend.routes.battles import battles_bp  # Temporarily disabled - needs nlp_service implementation
from backend.models.database import db_instance
from backend.services.socket_service import socketio
import backend.config as config
import os

app = Flask(__name__)
app.config.from_object(config.Config)

# Disable Flask debug features that cause auto-restart
app.config['DEBUG'] = False
app.config['PROPAGATE_EXCEPTIONS'] = True

# Enhanced CORS configuration
CORS(app, 
     origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
     supports_credentials=True)

# Initialize database FIRST
print("🔄 Initializing database...")
db_instance.init_app(app)

# Initialize socketio
socketio.init_app(app, 
                 cors_allowed_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
                 logger=False,  # Disable socketio logging to reduce noise
                 engineio_logger=False)

# Register blueprints
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(document_bp, url_prefix='/api/document')
app.register_blueprint(quiz_bp, url_prefix='/api/quiz')
app.register_blueprint(room_bp, url_prefix='/api/room')
app.register_blueprint(mindmap_bp, url_prefix='/api/mindmap')
app.register_blueprint(flashcards_bp, url_prefix='/api/flashcards')
app.register_blueprint(assistant_bp, url_prefix='/api/assistant')  # AI Study Assistant
# app.register_blueprint(battles_bp, url_prefix='/api/battles')  # Temporarily disabled

# Test endpoint to check if backend is working
@app.route('/api/test', methods=['GET'])
def test_endpoint():
    return jsonify({
        'status': 'success', 
        'message': 'Backend is running!',
        'database_connected': db_instance.is_connected(),
        'timestamp': str(datetime.utcnow())
    })

@app.route('/api/test-db', methods=['GET'])
def test_db():
    try:
        db = db_instance.get_db()
        if db is not None and db_instance.is_connected():
            return jsonify({
                'status': 'success', 
                'message': 'Database connected and working'
            })
        else:
            return jsonify({
                'status': 'error', 
                'message': 'Database not connected'
            }), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/')
def health_check():
    return {'status': 'healthy', 'message': 'Doc2Learn API running'}

if __name__ == '__main__':
    from datetime import datetime
    
    # Create uploads directory if it doesn't exist
    os.makedirs('uploads', exist_ok=True)
    
    print("=" * 50)
    print("🚀 Starting Doc2Learn backend server...")
    print("📡 Server: http://localhost:5000")
    print("🔍 Test: http://localhost:5000/api/test")
    print("⏰ Started at:", datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))
    print("=" * 50)
    
    if not db_instance.is_connected():
        print("❌ WARNING: Starting server without database connection")
        print("💡 Files will be processed but not stored in database")
    else:
        print("✅ Database: Connected successfully")
    
    # Run with debug=False to prevent auto-restart issues
    socketio.run(app, 
                 debug=False,  # Changed from True to False
                 host='0.0.0.0', 
                 port=5000, 
                 allow_unsafe_werkzeug=True)
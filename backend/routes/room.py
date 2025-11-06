# backend/routes/room.py - ENHANCED FOR COLLABORATIVE QUIZ
from flask import Blueprint, request, jsonify
from datetime import datetime
import uuid
import random
import string
from backend.models.database import db_instance, Collections
from bson import ObjectId

room_bp = Blueprint('room', __name__)

# Store active rooms in memory (in production, use Redis)
active_rooms = {}

def generate_room_code():
    """Generate a unique 6-character room code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@room_bp.route('/create', methods=['POST'])
def create_room():
    try:
        data = request.json
        host_id = data.get('host_id') or data.get('user_id')
        host_name = data.get('host_name', 'Host')
        document_id = data.get('document_id', None)
        room_name = data.get('room_name', 'Quiz Room')
        
        # Quiz settings
        num_questions = data.get('num_questions', 10)
        time_per_question = data.get('time_per_question', 30)  # seconds
        difficulty = data.get('difficulty', 'medium')
        max_participants = data.get('max_participants', 20)
        
        if not host_id:
            return jsonify({'error': 'host_id is required'}), 400
        
        # Generate unique room code and ID
        room_code = generate_room_code()
        room_id = str(uuid.uuid4())[:12]
        
        print(f"\n{'='*50}")
        print(f"🎮 CREATING COLLABORATIVE QUIZ ROOM")
        print(f"{'='*50}")
        print(f"🔑 Room Code: {room_code}")
        print(f"📝 Room ID: {room_id}")
        print(f"👤 Host: {host_name} ({host_id})")
        print(f"❓ Questions: {num_questions}")
        print(f"⏱️  Time per question: {time_per_question}s")
        print(f"🎯 Difficulty: {difficulty}")
        print(f"{'='*50}\n")
        
        # Create room object
        room = {
            'room_id': room_id,
            'room_code': room_code,
            'room_name': room_name,
            'host_id': host_id,
            'host_name': host_name,
            'document_id': document_id,
            
            # Quiz settings
            'num_questions': num_questions,
            'time_per_question': time_per_question,
            'difficulty': difficulty,
            'max_participants': max_participants,
            
            # Participants
            'participants': [{
                'id': host_id,
                'name': host_name,
                'is_host': True,
                'score': 0,
                'answers': [],
                'joined_at': datetime.utcnow().isoformat()
            }],
            
            # Quiz state
            'quiz_state': 'lobby',  # lobby, in_progress, completed
            'current_question_index': 0,
            'questions': [],
            'question_start_time': None,
            
            # Metadata
            'created_at': datetime.utcnow().isoformat(),
            'is_active': True,
            'share_link': f'/join/{room_code}'
        }
        
        # Store in memory
        active_rooms[room_id] = room
        active_rooms[room_code] = room  # Also store by code for easy lookup
        
        # Store in MongoDB
        db = db_instance.get_db()
        if db is not None:
            room_data = room.copy()
            room_data['created_at'] = datetime.utcnow()
            db[Collections.ROOMS].insert_one(room_data)
        
        return jsonify({
            'success': True,
            'room_id': room_id,
            'room_code': room_code,
            'room': room,
            'share_link': f'http://localhost:5173/join/{room_code}',
            'message': f'Room created! Share code: {room_code}'
        })
        
    except Exception as e:
        print(f"❌ Error creating room: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@room_bp.route('/join', methods=['POST'])
def join_room():
    try:
        data = request.json
        room_code = data.get('room_code') or data.get('room_id')
        participant_name = data.get('participant_name') or data.get('user_name', 'Anonymous')
        participant_id = data.get('participant_id') or data.get('user_id') or str(uuid.uuid4())[:8]
        avatar = data.get('avatar', '😊')
        
        if not room_code:
            return jsonify({'error': 'room_code is required'}), 400
        
        # Find room by code or ID
        room = active_rooms.get(room_code)
        if not room:
            # Try to find by room_id if code not found
            room = next((r for r in active_rooms.values() if r.get('room_id') == room_code), None)
        
        if not room:
            return jsonify({'error': 'Room not found or expired'}), 404
        
        # Check if room is full
        if len(room['participants']) >= room['max_participants']:
            return jsonify({'error': 'Room is full'}), 400
        
        # Check if quiz already started
        if room['quiz_state'] != 'lobby':
            return jsonify({'error': 'Quiz already in progress'}), 400
        
        # Check if participant already joined
        existing = next((p for p in room['participants'] if p['id'] == participant_id), None)
        if existing:
            existing['name'] = participant_name
            existing['avatar'] = avatar
        else:
            # Add new participant
            room['participants'].append({
                'id': participant_id,
                'name': participant_name,
                'avatar': avatar,
                'is_host': False,
                'score': 0,
                'answers': [],
                'joined_at': datetime.utcnow().isoformat()
            })
        
        print(f"✅ {participant_name} joined room {room['room_code']} ({len(room['participants'])} participants)")
        
        return jsonify({
            'success': True,
            'room': room,
            'participant_id': participant_id,
            'message': f'{participant_name} joined successfully!'
        })
        
    except Exception as e:
        print(f"❌ Error joining room: {str(e)}")
        return jsonify({'error': str(e)}), 500

@room_bp.route('/<room_id>', methods=['GET'])
def get_room(room_id):
    try:
        # Try to find by room_id or room_code
        room = active_rooms.get(room_id)
        if not room:
            room = next((r for r in active_rooms.values() if r.get('room_id') == room_id or r.get('room_code') == room_id), None)
        
        if not room:
            # Try database
            db = db_instance.get_db()
            if db is not None:
                room_doc = db[Collections.ROOMS].find_one({'$or': [{'room_id': room_id}, {'room_code': room_id}]})
                if room_doc:
                    room_doc['_id'] = str(room_doc['_id'])
                    return jsonify({
                        'success': True,
                        'room': room_doc
                    })
            
            return jsonify({'error': 'Room not found'}), 404
        
        return jsonify({
            'success': True,
            'room': room
        })
        
    except Exception as e:
        print(f"❌ Error getting room: {str(e)}")
        return jsonify({'error': str(e)}), 500

@room_bp.route('/code/<room_code>', methods=['GET'])
def get_room_by_code(room_code):
    """Get room info by room code (for join page)"""
    try:
        room = active_rooms.get(room_code)
        
        if not room:
            return jsonify({'error': 'Room not found or expired'}), 404
        
        # Return limited info for join page
        return jsonify({
            'success': True,
            'room': {
                'room_code': room['room_code'],
                'room_name': room['room_name'],
                'host_name': room['host_name'],
                'num_questions': room['num_questions'],
                'time_per_question': room['time_per_question'],
                'difficulty': room['difficulty'],
                'participants_count': len(room['participants']),
                'max_participants': room['max_participants'],
                'is_full': len(room['participants']) >= room['max_participants'],
                'quiz_state': room['quiz_state']
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting room by code: {str(e)}")
        return jsonify({'error': str(e)}), 500

@room_bp.route('/upload-questions', methods=['POST'])
def upload_questions():
    """Host uploads document and generates quiz questions"""
    try:
        data = request.json
        room_id = data.get('room_id')
        questions = data.get('questions', [])
        
        room = active_rooms.get(room_id)
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        # Store questions in room
        room['questions'] = questions[:room['num_questions']]  # Limit to configured number
        room['quiz_ready'] = True
        
        print(f"📚 Questions uploaded to room {room['room_code']}: {len(room['questions'])} questions")
        
        return jsonify({
            'success': True,
            'message': f'{len(room["questions"])} questions ready',
            'questions_count': len(room['questions'])
        })
        
    except Exception as e:
        print(f"❌ Error uploading questions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@room_bp.route('/rooms', methods=['GET'])
def get_rooms():
    try:
        # Get active rooms from memory and database
        active_rooms_list = list(active_rooms.values())
        
        # Also get rooms from database
        db_rooms = list(db_instance.get_db()[Collections.ROOMS].find({'is_active': True}))
        for room in db_rooms:
            room['_id'] = str(room['_id'])
        
        # Combine and remove duplicates
        all_rooms = active_rooms_list + db_rooms
        unique_rooms = []
        seen_room_ids = set()
        
        for room in all_rooms:
            room_id = room.get('room_id')
            if room_id and room_id not in seen_room_ids:
                seen_room_ids.add(room_id)
                unique_rooms.append(room)
        
        return jsonify({
            'success': True,
            'rooms': unique_rooms
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@room_bp.route('/leave', methods=['POST'])
def leave_room():
    try:
        data = request.json
        room_id = data.get('room_id')
        participant_id = data.get('participant_id') or data.get('user_id')
        
        room = active_rooms.get(room_id)
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        # Remove participant
        room['participants'] = [p for p in room['participants'] if p['id'] != participant_id]
        
        # Remove room if empty or host left
        if not room['participants'] or any(p['id'] == participant_id and p['is_host'] for p in room['participants']):
            # Clean up room
            if room.get('room_code') in active_rooms:
                del active_rooms[room['room_code']]
            if room_id in active_rooms:
                del active_rooms[room_id]
            
            # Update database
            db = db_instance.get_db()
            if db is not None:
                db[Collections.ROOMS].update_one(
                    {'room_id': room_id},
                    {'$set': {'is_active': False, 'ended_at': datetime.utcnow()}}
                )
        
        return jsonify({
            'success': True,
            'message': 'Left room successfully'
        })
        
    except Exception as e:
        print(f"❌ Error leaving room: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Helper function to get active room count
@room_bp.route('/stats', methods=['GET'])
def get_room_stats():
    """Get statistics about active rooms"""
    try:
        unique_rooms = {}
        for room_key, room in active_rooms.items():
            room_id = room.get('room_id')
            if room_id and room_id not in unique_rooms:
                unique_rooms[room_id] = room
        
        total_participants = sum(len(room.get('participants', [])) for room in unique_rooms.values())
        
        return jsonify({
            'success': True,
            'stats': {
                'active_rooms': len(unique_rooms),
                'total_participants': total_participants,
                'rooms_in_lobby': len([r for r in unique_rooms.values() if r.get('quiz_state') == 'lobby']),
                'rooms_in_progress': len([r for r in unique_rooms.values() if r.get('quiz_state') == 'in_progress'])
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500